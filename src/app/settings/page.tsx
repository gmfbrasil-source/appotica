'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CreditCard, Loader2, Plus, Check, X, Pencil, Trash2, Download, Upload, FileSpreadsheet, MessageSquare, Save, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import SidebarMenu from '@/components/SidebarMenu';
import { companyInfo } from '@/lib/format';

const BACKUP_TABLES = [
  'customers', 'products', 'payment_methods', 'service_orders',
  'prescriptions', 'financial_records', 'cash_closing', 'message_templates'
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

  // Accordion states
  const [openPayments, setOpenPayments] = useState(true);
  const [openMessages, setOpenMessages] = useState(true);
  const [openBackup, setOpenBackup] = useState(true);

  // Message template states
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({ title: '', message: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

  useEffect(() => {
    fetchMethods();
    fetchTemplates();
  }, []);

  async function fetchMethods() {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    if (!profile?.shop_id) { setLoading(false); return; }
    const { data } = await supabase.from('payment_methods').select('*').eq('shop_id', profile.shop_id).order('name');
    if (data) setMethods(data);
    setLoading(false);
  }

  async function fetchTemplates() {
    setTemplatesLoading(true);
    const { data } = await supabase.from('message_templates').select('*').order('stage');
    if (data) setTemplates(data);
    setTemplatesLoading(false);
  }

  async function handleSaveTemplate() {
    if (!editingTemplate) return;
    setSavingTemplate(true);
    setTemplateError('');
    setTemplateSuccess('');

    try {
      const { error } = await supabase
        .from('message_templates')
        .update({ title: templateForm.title, message: templateForm.message, updated_at: new Date().toISOString() })
        .eq('id', editingTemplate.id);

      if (error) throw error;
      setTemplateSuccess('Mensagem salva com sucesso!');
      setEditingTemplate(null);
      fetchTemplates();
      setTimeout(() => setTemplateSuccess(''), 3000);
    } catch (err: any) {
      setTemplateError(err.message || 'Erro ao salvar mensagem.');
    } finally {
      setSavingTemplate(false);
    }
  }

  function renderPreview(msg: string) {
    return msg
      .replace(/\{cliente\}/g, 'Maria Silva')
      .replace(/\{numero\}/g, '001/2026')
      .replace(/\{produto\}/g, 'Armadura + Lentes')
      .replace(/\{valor\}/g, 'R$ 1.250,00')
      .replace(/\{prazo\}/g, '10 dias úteis')
      .replace(/\{loja\}/g, companyInfo.nomeFantasia);
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
          financial_records: 'Financeiro', cash_closing: 'Fechamentos de Caixa',
          message_templates: 'Mensagens de Aviso'
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
            financeiro: 'financial_records', 'fechamentos de caixa': 'cash_closing',
            'mensagens de aviso': 'message_templates'
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
        'financial_records', 'cash_closing', 'message_templates'
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

      <SidebarMenu />

      {/* HEADER ESCURO */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-5 md:p-6 mb-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Sistema</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Configurações</h1>
            <p className="text-gray-400 text-sm mt-1">
              Formas de pagamento, mensagens de aviso e backup de dados
            </p>
          </div>
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

      {/* ─── FORMAS DE PAGAMENTO (ACCORDION) ─────────────────── */}
      <div className="mt-8 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setOpenPayments(!openPayments)}
          className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl"><CreditCard size={18} className="text-blue-600" /></div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Formas de Pagamento</h2>
              <p className="text-xs text-gray-400">{methods.length} metodo(s) cadastrado(s)</p>
            </div>
          </div>
          {openPayments ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>
        {openPayments && (
          <div className="px-5 md:px-6 pb-5 md:pb-6">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { setEditingId(null); setFormData({ name: '', fee_percent: '', max_installments: '1', is_card: false, active: true, fee_by_installment: {} }); setShowForm(true); }}
                className="bg-gray-900 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <Plus size={16} /> Novo Metodo
              </button>
            </div>
            {loading ? (
              <div className="text-center py-10 text-gray-500"><Loader2 className="animate-spin mx-auto mb-2" size={24} /> Carregando...</div>
            ) : (
              <div className="space-y-3">
                {methods.map((m) => (
                  <div key={m.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${m.is_card ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{m.name}</p>
                          <p className="text-xs text-gray-500">
                            {m.is_card ? `Taxas: ${m.fee_by_installment ? `${Object.keys(m.fee_by_installment).length} faixas` : `${m.fee_percent}%`} | ${m.max_installments > 1 ? `Ate ${m.max_installments}x` : 'A vista'}` : (m.max_installments > 1 ? `Ate ${m.max_installments}x` : 'A vista')}
                            {!m.active && <span className="text-red-500 ml-2">Inativo</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(m)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-white transition-colors">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-white transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {methods.length === 0 && <p className="text-center text-gray-500 py-6">Nenhum metodo de pagamento cadastrado.</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── MENSAGENS DE AVISO (ACCORDION) ──────────────────── */}
      <div className="mt-8 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setOpenMessages(!openMessages)}
          className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl"><MessageSquare size={18} className="text-amber-600" /></div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Mensagens de Aviso</h2>
              <p className="text-xs text-gray-400">{templates.length} template(s) configurado(s)</p>
            </div>
          </div>
          {openMessages ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>
        {openMessages && (
          <div className="px-5 md:px-6 pb-5 md:pb-6">
            <p className="text-xs text-gray-500 mb-4">
              Variaveis: {'{cliente}'} {'{numero}'} {'{produto}'} {'{valor}'} {'{prazo}'} {'{loja}'}
            </p>

            {templateSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-700 font-medium flex items-center gap-2">
                <Check size={16} className="shrink-0" /> {templateSuccess}
              </div>
            )}
            {templateError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 font-medium flex items-center gap-2">
                <X size={16} className="shrink-0" /> {templateError}
              </div>
            )}

            {templatesLoading ? (
              <div className="text-center py-8 text-gray-500"><Loader2 className="animate-spin mx-auto mb-2" size={20} /> Carregando...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-3">Nenhum template encontrado.</p>
                <button
                  onClick={async () => {
                    await supabase.rpc('create_default_message_templates');
                    fetchTemplates();
                  }}
                  className="px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors"
                >
                  Criar Mensagens Padrao
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((t) => {
                  const stageColors: Record<string, string> = {
                    created: 'bg-blue-100 text-blue-600',
                    preparing: 'bg-amber-100 text-amber-600',
                    ready: 'bg-green-100 text-green-600',
                    delivered: 'bg-purple-100 text-purple-600',
                    overdue: 'bg-red-100 text-red-600',
                  };
                  const stageLabels: Record<string, string> = {
                    created: 'Criada', preparing: 'Em Preparo', ready: 'Pronta',
                    delivered: 'Entregue', overdue: 'Atraso',
                  };

                  return (
                    <div key={t.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${stageColors[t.stage] || 'bg-gray-100 text-gray-600'}`}>
                            {stageLabels[t.stage] || t.stage}
                          </span>
                          <span className="font-bold text-gray-800 text-sm">{t.title}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setPreviewTemplate(previewTemplate === t.id ? null : t.id)}
                            className="text-gray-400 hover:text-green-600 p-1.5 rounded-lg hover:bg-green-50 transition-colors"
                            title="Preview"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => { setEditingTemplate(t); setTemplateForm({ title: t.title, message: t.message }); }}
                            className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                      </div>

                      {previewTemplate === t.id && (
                        <div className="bg-white rounded-xl p-3 border border-gray-200 mb-2 text-sm text-gray-700 leading-relaxed">
                          {renderPreview(t.message)}
                        </div>
                      )}

                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{t.message}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {editingTemplate && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Editar Mensagem</h3>
                    <button onClick={() => setEditingTemplate(null)} className="text-gray-500 hover:text-gray-700">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Titulo</label>
                      <input
                        type="text"
                        value={templateForm.title}
                        onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-gray-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Mensagem</label>
                      <textarea
                        value={templateForm.message}
                        onChange={(e) => setTemplateForm({ ...templateForm, message: e.target.value })}
                        rows={5}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-gray-950 text-sm leading-relaxed resize-none"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        Variaveis: {'{cliente}'} {'{numero}'} {'{produto}'} {'{valor}'} {'{prazo}'} {'{loja}'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Preview</label>
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {renderPreview(templateForm.message)}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setEditingTemplate(null)}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveTemplate}
                        disabled={savingTemplate}
                        className="flex-1 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {savingTemplate ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── BACKUP DE DADOS (ACCORDION) ───────────────────── */}
      <div className="mt-8 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setOpenBackup(!openBackup)}
          className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl"><FileSpreadsheet size={18} className="text-blue-600" /></div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Backup de Dados</h2>
              <p className="text-xs text-gray-400">Exportar ou importar dados da loja</p>
            </div>
          </div>
          {openBackup ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>
        {openBackup && (
          <div className="px-5 md:px-6 pb-5 md:pb-6">
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
                <p><strong>Importar (edicao em massa):</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Exporte os dados primeiro (.xls)</li>
                  <li>Abra no Excel, faca as alteracoes desejadas</li>
                  <li>No Excel: <strong>Arquivo &gt; Salvar como &gt; CSV (UTF-8) (.csv)</strong></li>
                  <li>Importe o .csv de volta -- o sistema atualizara os registros existentes e criara novos</li>
                </ol>
                <p className="text-xs text-amber-600 mt-2">Importante: mantenha a primeira linha (cabecalho das colunas) inalterada.</p>
              </div>
            </details>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
