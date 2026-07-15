'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CreditCard, Loader2, Plus, Check, X, Pencil, Trash2, Download, Upload, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

const BACKUP_TABLES = [
  'customers', 'products', 'payment_methods', 'service_orders',
  'prescriptions', 'financial_records', 'cash_closing'
] as const;

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  // ─── EXPORT (HTML/.xls) ──────────────────────────────────

  async function handleExport() {
    setExporting(true);
    try {
      const shop_id = await getShopId();
      if (!shop_id) { alert('Erro: loja não identificada.'); return; }

      let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
  h1 { color: #1e3a5f; font-size: 20px; margin: 0 0 4px 0; }
  .sub { color: #888; font-size: 12px; margin-bottom: 20px; }
  h2 { background: #e8f0fe; color: #1e3a5f; font-size: 14px; padding: 8px 12px;
       border-radius: 4px; margin: 24px 0 8px 0; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 8px;
          page-break-inside: avoid; }
  th { background: #f0f4f8; color: #555; font-size: 11px; padding: 6px 8px;
       text-align: left; border: 1px solid #dde3ed; white-space: nowrap; }
  td { font-size: 11px; padding: 5px 8px; border: 1px solid #e5eaf0;
       color: #333; }
  tr:nth-child(even) { background: #fafbfc; }
  .vazio { color: #aaa; font-style: italic; padding: 12px; }
  .footer { margin-top: 30px; font-size: 10px; color: #bbb; text-align: center;
            border-top: 1px solid #eee; padding-top: 12px; }
</style></head><body>
<h1>Backup de Dados</h1>
<div class="sub">Estyllus Otica &mdash; Gerado em ${new Date().toLocaleString('pt-BR')}</div>\n`;

      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('shop_id', shop_id)
          .order('created_at', { ascending: true });

        const labelMap: Record<string, string> = {
          customers: 'Clientes', products: 'Produtos', payment_methods: 'Formas de Pagamento',
          service_orders: 'Ordens de Servico', prescriptions: 'Prescricoes',
          financial_records: 'Financeiro', cash_closing: 'Fechamentos de Caixa'
        };

        html += `<h2>${labelMap[table] || table}</h2>\n`;

        if (error || !data || data.length === 0) {
          html += `<p class="vazio">Nenhum registro.</p>\n`;
          continue;
        }

        const columns = Object.keys(data[0]);
        html += '<table><thead><tr>' + columns.map(c => `<th>${escHtml(c)}</th>`).join('') + '</tr></thead><tbody>\n';

        for (const row of data) {
          html += '<tr>' + columns.map(c => {
            let val = row[c];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'object') val = JSON.stringify(val);
            return `<td>${escHtml(String(val))}</td>`;
          }).join('') + '</tr>\n';
        }
        html += '</tbody></table>\n';
      }

      html += `<div class="footer">Backup gerado automaticamente pelo sistema.</div>\n</body></html>`;

      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_estyllus_${new Date().toISOString().slice(0, 10)}.xls`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Erro ao exportar: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  // ─── IMPORT (HTML .xls ou CSV) ──────────────────────────

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const shop_id = await getShopId();
      if (!shop_id) { alert('Erro: loja não identificada.'); return; }

      let sections: Record<string, { columns: string[]; rows: string[][] }> = {};

      // Detect format: HTML (.xls) or CSV
      const isHtml = text.trim().startsWith('<') && (text.includes('<table') || text.includes('<html'));

      if (isHtml) {
        // Parse HTML tables
        const tableRegex = /<h2[^>]*>(.*?)<\/h2>\s*<table[\s\S]*?<\/table>/gi;
        let match;
        while ((match = tableRegex.exec(text)) !== null) {
          const tableName = match[1].trim().toLowerCase();
          const tableHtml = match[0];

          const tableMap: Record<string, string> = {
            clientes: 'customers', produtos: 'products', 'formas de pagamento': 'payment_methods',
            'ordens de servico': 'service_orders', prescricoes: 'prescriptions',
            financeiro: 'financial_records', 'fechamentos de caixa': 'cash_closing'
          };
          const dbTable = tableMap[tableName] || tableName;

          const ths = [...tableHtml.matchAll(/<th[^>]*>(.*?)<\/th>/gi)].map(m => m[1].trim());
          const trs = [...tableHtml.matchAll(/<tbody[\s\S]*?<\/tbody>/gi)];
          const rows: string[][] = [];
          if (trs.length > 0) {
            const cells = [...trs[0][0].matchAll(/<td[^>]*>(.*?)<\/td>/gi)];
            let row: string[] = [];
            for (const c of cells) {
              row.push(c[1].trim());
              if (row.length === ths.length) { rows.push(row); row = []; }
            }
            if (row.length > 0) rows.push(row);
          }
          sections[dbTable] = { columns: ths, rows };
        }
      } else {
        // Parse CSV sections (existing logic)
        const lines = text.split('\n');
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
      }

      const foundTables = Object.keys(sections);
      if (foundTables.length === 0) {
        setImportResult('Nenhuma seção de dados encontrada no arquivo.');
        return;
      }

      // Import order
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
            if (col.toLowerCase() === 'shop_id') { obj[col] = shop_id; }
            else { obj[col] = row[i] ?? null; }
          });
          return obj;
        });

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
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-8 pb-24">

      {/* HEADER ESCURO */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-5 md:p-6 mb-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Sistema</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Configurações</h1>
            <p className="text-gray-400 text-sm mt-1">
              Formas de pagamento e backup de dados
            </p>
          </div>
          <button
            onClick={() => { setEditingId(null); setFormData({ name: '', fee_percent: '', max_installments: '1', is_card: false, active: true, fee_by_installment: {} }); setShowForm(true); }}
            className="bg-white text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-lg shadow-white/10"
          >
            <Plus size={18} /> Novo Método
          </button>
        </div>
      </div>

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
            <div key={m.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
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
      <div className="mt-8 bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 rounded-xl"><FileSpreadsheet size={18} className="text-blue-600" /></div>
          <h2 className="text-lg font-extrabold text-gray-900">Backup de Dados</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Exporte ou importe os dados da sua loja em formato .xls (Excel) ou .csv.
        </p>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {exporting ? 'Exportando...' : 'Exportar Dados'}
          </button>

          <label className={`flex items-center gap-2 px-5 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors cursor-pointer shadow-sm ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {importing ? 'Importando...' : 'Importar Planilha'}
            <input type="file" accept=".csv,.xls" onChange={handleImport} disabled={importing} className="hidden" />
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
            <p><strong>Exportar:</strong> Gera um arquivo .xls com todos os dados organizados em tabelas. Abra no Excel ou Google Sheets.</p>
            <p><strong>Importar (edição em massa):</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Exporte os dados primeiro (.xls)</li>
              <li>Abra no Excel, faça as alterações desejadas</li>
              <li>No Excel: <strong>Arquivo &gt; Salvar como &gt; CSV (UTF-8) (.csv)</strong></li>
              <li>Importe o .csv de volta — o sistema atualizará os registros existentes e criará novos</li>
            </ol>
            <p className="text-xs text-amber-600 mt-2">Importante: mantenha a primeira linha (cabeçalho das colunas) inalterada.</p>
          </div>
        </details>
      </div>
      </div>
    </div>
  );
}
