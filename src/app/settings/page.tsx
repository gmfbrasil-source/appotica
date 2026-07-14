'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CreditCard, Loader2, Plus, Check, X, Pencil, Trash2, Download, Upload, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

const BACKUP_TABLES = [
  'customers', 'products', 'payment_methods', 'service_orders',
  'prescriptions', 'financial_records', 'cash_closing'
] as const;

function csvVal(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r'))
    return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let i = 0, current = '';
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i += 2; }
        else { inQuotes = false; i++; }
      } else { current += ch; i++; }
    } else {
      if (ch === ',') { result.push(current); current = ''; i++; }
      else if (ch === '"') { inQuotes = true; i++; }
      else if (ch === '\r') { i++; }
      else { current += ch; i++; }
    }
  }
  result.push(current);
  return result;
}

export default function SettingsPage() {
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{ name: string; fee_percent: string; max_installments: string; is_card: boolean; active: boolean; fee_by_installment: Record<string, string> }>({
    name: '', fee_percent: '', max_installments: '1', is_card: false, active: true, fee_by_installment: {}
  });

  // Backup states
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    fetchMethods();
  }, []);

  async function fetchMethods() {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    if (!profile?.shop_id) { setLoading(false); return; }
    const { data } = await supabase.from('payment_methods').select('*').eq('shop_id', profile.shop_id).order('name');
    if (data) setMethods(data);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    if (!profile?.shop_id) return;

    const feeByInst: Record<string, number> = {};
    for (const [k, v] of Object.entries(formData.fee_by_installment)) {
      const num = parseFloat(v);
      if (!isNaN(num)) feeByInst[k] = num;
    }

    const payload: any = {
      shop_id: profile.shop_id,
      name: formData.name,
      fee_percent: parseFloat(formData.fee_percent) || 0,
      max_installments: parseInt(formData.max_installments) || 1,
      is_card: formData.is_card,
      active: formData.active,
    };
    if (Object.keys(feeByInst).length > 0) payload.fee_by_installment = feeByInst;

    if (editingId) {
      await supabase.from('payment_methods').update(payload).eq('id', editingId);
    } else {
      await supabase.from('payment_methods').insert([payload]);
    }

    setEditingId(null);
    setShowForm(false);
    setFormData({ name: '', fee_percent: '', max_installments: '1', is_card: false, active: true, fee_by_installment: {} });
    fetchMethods();
  }

  function startEdit(method: any) {
    setEditingId(method.id);
    const fb = method.fee_by_installment || {};
    const feeByInst: Record<string, string> = {};
    for (const [k, v] of Object.entries(fb)) feeByInst[k] = String(v);
    setFormData({
      name: method.name,
      fee_percent: String(method.fee_percent),
      max_installments: String(method.max_installments),
      is_card: method.is_card,
      active: method.active,
      fee_by_installment: feeByInst,
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este método de pagamento?')) return;
    await supabase.from('payment_methods').delete().eq('id', id);
    fetchMethods();
  }

  async function getShopId(): Promise<string | null> {
    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    return profile?.shop_id || null;
  }

  // ─── EXPORT ──────────────────────────────────────────────

  async function handleExport() {
    setExporting(true);
    try {
      const shop_id = await getShopId();
      if (!shop_id) { alert('Erro: loja não identificada.'); return; }

      let csv = '# Backup de Dados - Estyllus Otica\n';
      csv += `# Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;

      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('shop_id', shop_id)
          .order('created_at', { ascending: true });

        if (error) {
          console.warn(`Erro ao exportar ${table}:`, error.message);
          continue;
        }
        if (!data || data.length === 0) {
          csv += `##### ${table}\n# (sem registros)\n\n`;
          continue;
        }

        const columns = Object.keys(data[0]);
        csv += `##### ${table}\n`;
        csv += columns.map(c => csvVal(c)).join(',') + '\n';
        for (const row of data) {
          csv += columns.map(c => csvVal(row[c])).join(',') + '\n';
        }
        csv += '\n';
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_estyllus_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Erro ao exportar: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  // ─── IMPORT ──────────────────────────────────────────────

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const shop_id = await getShopId();
      if (!shop_id) { alert('Erro: loja não identificada.'); return; }

      // Parse sections
      const lines = text.split('\n');
      const sections: Record<string, { columns: string[]; rows: string[][] }> = {};
      let currentTable = '';
      let currentColumns: string[] = [];

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('##### ')) {
          currentTable = line.slice(6).trim();
          sections[currentTable] = { columns: [], rows: [] };
          currentColumns = [];
        } else if (line.startsWith('#')) {
          continue;
        } else if (currentTable && line) {
          const parsed = parseCSVLine(line);
          if (currentColumns.length === 0) {
            currentColumns = parsed;
            sections[currentTable].columns = parsed;
          } else {
            if (parsed.length === currentColumns.length) {
              sections[currentTable].rows.push(parsed);
            }
          }
        }
      }

      // Validation
      const foundTables = Object.keys(sections);
      if (foundTables.length === 0) {
        setImportResult('Nenhuma seção de dados encontrada no arquivo.');
        return;
      }

      // Import order: parents first, then dependents
      const order: string[] = [
        'customers', 'products', 'payment_methods',
        'service_orders', 'prescriptions',
        'financial_records', 'cash_closing'
      ];

      let totalImported = 0;
      const errors: string[] = [];

      for (const table of order) {
        const section = sections[table];
        if (!section || section.rows.length === 0) continue;

        const rows = section.rows.map(row => {
          const obj: any = { shop_id };
          section.columns.forEach((col, i) => {
            if (col === 'shop_id') { obj[col] = shop_id; }
            else { obj[col] = row[i] ?? null; }
          });
          return obj;
        });

        // Upsert in batches of 50
        for (let i = 0; i < rows.length; i += 50) {
          const batch = rows.slice(i, i + 50);
          const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
          if (error) {
            errors.push(`${table} (lote ${Math.floor(i / 50) + 1}): ${error.message}`);
          } else {
            totalImported += batch.length;
          }
        }
      }

      let resultMsg = `${totalImported} registro(s) importados com sucesso.`;
      if (errors.length > 0) {
        resultMsg += `\n\n${errors.length} erro(s):\n` + errors.join('\n');
      }
      setImportResult(resultMsg);
      fetchMethods();
    } catch (err: any) {
      setImportResult('Erro ao importar: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900">Configurações</h1>
        </div>
        <button
          onClick={() => { setEditingId(null); setFormData({ name: '', fee_percent: '', max_installments: '1', is_card: false, active: true, fee_by_installment: {} }); setShowForm(true); }}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-6">Gerencie as formas de pagamento da sua loja.</p>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editingId ? 'Editar' : 'Novo'} Método</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-950" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Taxa (%)</label>
                  <input type="number" step="0.01" min="0" className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-950" value={formData.fee_percent} onChange={(e) => setFormData({...formData, fee_percent: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Máx. Parcelas</label>
                  <input type="number" min="1" max="120" className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-950" value={formData.max_installments} onChange={(e) => setFormData({...formData, max_installments: e.target.value})} />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.is_card} onChange={(e) => setFormData({...formData, is_card: e.target.checked})} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700">É cartão? (recebe integral + taxa)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.active} onChange={(e) => setFormData({...formData, active: e.target.checked})} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700">Ativo</span>
                </label>
              </div>

              {formData.is_card && parseInt(formData.max_installments || '1') > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Taxas por Parcela (%)</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[...Array(parseInt(formData.max_installments) || 1)].map((_, i) => {
                      const inst = i + 1;
                      return (
                        <div key={inst} className="flex items-center gap-1">
                          <span className="text-[11px] text-gray-500 w-5 shrink-0">{inst}x</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0"
                            className="w-full p-1.5 border border-gray-300 rounded-lg text-sm text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.fee_by_installment[String(inst)] ?? ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              fee_by_installment: { ...formData.fee_by_installment, [String(inst)]: e.target.value }
                            })}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                Salvar
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500"><Loader2 className="animate-spin mx-auto mb-2" size={24} /> Carregando...</div>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => (
            <div key={m.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${m.is_card ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-500">
                      {m.is_card ? `Taxas: ${m.fee_by_installment ? `${Object.keys(m.fee_by_installment).length} faixas` : `${m.fee_percent}%`} | ${m.max_installments > 1 ? `Até ${m.max_installments}x` : 'À vista'}` : (m.max_installments > 1 ? `Até ${m.max_installments}x` : 'À vista')}
                      {!m.active && <span className="text-red-500 ml-2">Inativo</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(m)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {methods.length === 0 && <p className="text-center text-gray-500 py-10">Nenhum método de pagamento cadastrado.</p>}
        </div>
      )}

      {/* ─── BACKUP DE DADOS ──────────────────────────────── */}
      <div className="mt-10 pt-8 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <FileSpreadsheet size={22} className="text-blue-600" />
          <h2 className="text-xl font-extrabold text-gray-900">Backup de Dados</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Exporte todos os dados da sua loja em formato CSV (abre no Excel) ou importe uma planilha para atualizações em massa.
        </p>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {exporting ? 'Exportando...' : 'Exportar Dados'}
          </button>

          <label className={`flex items-center gap-2 px-5 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors cursor-pointer ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {importing ? 'Importando...' : 'Importar Planilha'}
            <input type="file" accept=".csv" onChange={handleImport} disabled={importing} className="hidden" />
          </label>
        </div>

        {importResult && (
          <div className={`mt-4 p-4 rounded-xl text-sm whitespace-pre-line ${
            importResult.includes('Erro') || importResult.includes('erro')
              ? 'bg-red-50 text-red-700 border border-red-100'
              : 'bg-green-50 text-green-700 border border-green-100'
          }`}>
            {importResult}
          </div>
        )}

        <details className="mt-6">
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 font-medium">
            Como usar o backup
          </summary>
          <div className="mt-3 text-sm text-gray-600 space-y-2 bg-gray-50 rounded-xl p-4">
            <p><strong>Exportar:</strong> Gera um arquivo .csv com todos os dados da sua loja. Abra no Excel ou Google Sheets para visualizar.</p>
            <p><strong>Importar (edição em massa):</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Exporte os dados primeiro</li>
              <li>Abra o .csv no Excel e faça as alterações desejadas</li>
              <li>Salve como .csv (mantendo a estrutura das colunas)</li>
              <li>Importe o arquivo de volta — o sistema atualizará os registros existentes e criará novos</li>
            </ol>
            <p className="text-xs text-amber-600 mt-2">Importante: não renomeie as colunas nem remova o cabeçalho `##### nomedatabela` de cada seção.</p>
          </div>
        </details>
      </div>
    </div>
  );
}
