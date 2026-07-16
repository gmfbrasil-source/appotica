'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Plus, ArrowUpCircle, ArrowDownCircle, Calendar, Trash2, Search, Check, AlertCircle, CheckCircle, Printer, X, FileText } from 'lucide-react';
import UserMenu from '@/components/UserMenu';

function getLocalDate(date?: Date): string {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('T')[0].split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

export default function FinancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Income' | 'Expense'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Pending' | 'Paid'>('all');
  
  // Estados para o formulário
  const [formData, setFormData] = useState({
    type: 'Income',
    description: '',
    amount: '',
    due_date: getLocalDate(),
    status: 'Pending'
  });

  // Estados para recorrência
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceCount, setRecurrenceCount] = useState(1);

  // Filtros por período e relatório
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [relatorioTipo, setRelatorioTipo] = useState<'analitico' | 'sintetico'>('sintetico');

  // Estados para o fornecedor (Despesas)
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierCnpj, setSupplierCnpj] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get('type');
    const statusParam = params.get('status');
    const dateStartParam = params.get('dateStart');
    const dateEndParam = params.get('dateEnd');
    if (typeParam === 'Income' || typeParam === 'Expense') setFilterType(typeParam);
    if (statusParam === 'Pending' || statusParam === 'Paid') setFilterStatus(statusParam);
    if (dateStartParam) setFilterDateStart(dateStartParam);
    if (dateEndParam) setFilterDateEnd(dateEndParam);
    fetchRecords();
    fetchCustomers();
  }, []);

  async function fetchRecords() {
    setLoading(true);
    const { data, error } = await supabase
      .from('financial_records')
      .select('*, customers(name, cnpj), service_orders(os_number)')
      .order('due_date', { ascending: true });
    
    if (!error) setRecords(data || []);
    setLoading(false);
  }

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });
    
    if (!error) setCustomers(data || []);
  }

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();

    const { data: profile } = await supabase
      .from('profiles')
      .select('shop_id')
      .single();

    if (!profile?.shop_id) {
      alert('Erro: Você não está vinculado a nenhuma ótica.');
      return;
    }

    const baseAmount = parseFloat(formData.amount);
    const count = recurrenceEnabled ? recurrenceCount : 1;
    const baseDate = new Date(formData.due_date);
    const inserts = [];

    for (let i = 0; i < count; i++) {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      const desc = count > 1
        ? `${formData.description} (${i + 1}/${count})`
        : formData.description;

      inserts.push({
        type: formData.type,
        description: desc,
        amount: baseAmount,
        due_date: getLocalDate(dueDate),
        status: i === 0 ? formData.status : 'Pending',
        payment_date: i === 0 && formData.status === 'Paid' ? getLocalDate() : null,
        customer_id: formData.type === 'Expense' ? selectedCustomerId : null,
        shop_id: profile.shop_id
      });
    }

    const { error } = await supabase
      .from('financial_records')
      .insert(inserts);
    
    if (!error) {
      setShowForm(false);
      resetForm();
      fetchRecords();
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
  }

  async function handleDeleteRecord(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Deseja realmente excluir este lançamento financeiro?')) return;

    const { error } = await supabase
      .from('financial_records')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchRecords();
    } else {
      alert('Erro ao excluir: ' + error.message);
    }
  }

  async function handleMarkAsPaid(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const { error } = await supabase
      .from('financial_records')
      .update({ status: 'Paid', payment_date: getLocalDate() })
      .eq('id', id);

    if (!error) {
      fetchRecords();
    } else {
      alert('Erro ao marcar como pago: ' + error.message);
    }
  }

  async function handleQuickAddSupplier() {
    if (!supplierSearch.trim()) {
      alert('Por favor, digite o nome do fornecedor antes de adicionar.');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('shop_id')
      .single();

    if (!profile?.shop_id) {
      alert('Erro: Você não está vinculado a nenhuma ótica.');
      return;
    }

    // Cria o fornecedor na tabela de clientes
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert([{
        name: supplierSearch,
        cnpj: supplierCnpj,
        shop_id: profile.shop_id
      }])
      .select()
      .single();

    if (error) {
      alert('Erro ao cadastrar fornecedor: ' + error.message);
    } else {
      alert('Fornecedor cadastrado e selecionado com sucesso!');
      await fetchCustomers();
      setSelectedCustomerId(newCustomer.id);
      setSupplierSearch(newCustomer.name);
      setSupplierCnpj(newCustomer.cnpj || '');
      setShowSuggestions(false);
    }
  }

  function resetForm() {
    setFormData({
      type: 'Income',
      description: '',
      amount: '',
      due_date: getLocalDate(),
      status: 'Pending'
    });
    setSupplierSearch('');
    setSupplierCnpj('');
    setSelectedCustomerId(null);
    setShowSuggestions(false);
    setRecurrenceEnabled(false);
    setRecurrenceCount(1);
  }

  // Filtra as sugestões de fornecedor com base na pesquisa
  const filteredSuggestions = supplierSearch
    ? customers.filter(c => 
        c.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
        (c.cnpj && c.cnpj.includes(supplierSearch))
      )
    : [];

  const totalReceivable = records
    .filter((r: any) => r.type === 'Income' && r.status === 'Pending')
    .reduce((acc: number, r: any) => acc + r.amount, 0);

  const totalPayable = records
    .filter((r: any) => r.type === 'Expense' && r.status === 'Pending')
    .reduce((acc: number, r: any) => acc + r.amount, 0);

  const filteredRecords = records.filter((r: any) => {
    const matchText = !searchQuery || 
      r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === 'all' || r.type === filterType;
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchDate = (!filterDateStart || r.due_date >= filterDateStart) &&
                      (!filterDateEnd || r.due_date <= filterDateEnd);
    return matchText && matchType && matchStatus && matchDate;
  });

  const filteredIncome = filteredRecords
    .filter(r => r.type === 'Income')
    .reduce((acc: number, r: any) => acc + r.amount, 0);

  const filteredExpense = filteredRecords
    .filter(r => r.type === 'Expense')
    .reduce((acc: number, r: any) => acc + r.amount, 0);

  const filteredBalance = filteredIncome - filteredExpense;

  function handlePrintReport() {
    const w = window.open('', '_blank');
    if (!w) return;

    const periodo = `${filterDateStart ? parseLocalDate(filterDateStart).toLocaleDateString('pt-BR') : 'Início'} até ${filterDateEnd ? parseLocalDate(filterDateEnd).toLocaleDateString('pt-BR') : 'Hoje'}`;
    const incomePending = filteredRecords.filter(r => r.type === 'Income' && r.status === 'Pending');
    const incomePaid = filteredRecords.filter(r => r.type === 'Income' && r.status === 'Paid');
    const expensePending = filteredRecords.filter(r => r.type === 'Expense' && r.status === 'Pending');
    const expensePaid = filteredRecords.filter(r => r.type === 'Expense' && r.status === 'Paid');

    const linha = (label: string, val: number, color: string) =>
      `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:12px">${label}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:${color};font-size:12px">R$ ${val.toFixed(2).replace('.', ',')}</td></tr>`;

    const recordRow = (r: any) => {
      const cor = r.type === 'Income' ? '#16a34a' : '#dc2626';
      const statusLabel = r.status === 'Paid' ? (r.type === 'Income' ? 'Recebido' : 'Pago') : 'Pendente';
      const statusCor = r.status === 'Paid' ? (r.type === 'Income' ? '#16a34a' : '#dc2626') : '#ea580c';
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;color:#333">${r.description}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;color:#666">${parseLocalDate(r.due_date).toLocaleDateString('pt-BR')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;color:#666">${r.customers?.name || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:${cor};font-size:12px">R$ ${r.amount.toFixed(2).replace('.', ',')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;font-size:10px;color:${statusCor};font-weight:bold">${statusLabel}</td>
      </tr>`;
    };

    function total(arr: any[]) { return arr.reduce((s: number, r: any) => s + r.amount, 0); }
    const ip = total(incomePending), ipd = total(incomePaid);
    const ep = total(expensePending), epd = total(expensePaid);
    const realized = ipd - epd;
    const projected = (ipd + ip) - (epd + ep);

    let bodyHtml = '';

    if (relatorioTipo === 'sintetico') {
      bodyHtml = `
        <h2 style="color:#2563eb;margin:0 0 4px 0">CONTAS A RECEBER</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          ${linha('A Receber (Pendente)', ip, '#16a34a')}
          ${linha('Recebido (Pago)', ipd, '#16a34a')}
          <tr><td style="padding:4px 8px;font-size:11px;color:#888">Parcelas</td><td style="padding:4px 8px;text-align:right;font-size:11px;color:#888">${incomePending.length} pendente(s) / ${incomePaid.length} paga(s)</td></tr>
        </table>
        <h2 style="color:#dc2626;margin:0 0 4px 0">CONTAS A PAGAR</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          ${linha('A Pagar (Pendente)', ep, '#dc2626')}
          ${linha('Pago', epd, '#dc2626')}
          <tr><td style="padding:4px 8px;font-size:11px;color:#888">Parcelas</td><td style="padding:4px 8px;text-align:right;font-size:11px;color:#888">${expensePending.length} pendente(s) / ${expensePaid.length} paga(s)</td></tr>
        </table>
        <h2 style="color:#6b7280;margin:16px 0 4px 0;text-align:center">SALDO DO PERÍODO</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
          ${linha('Realizado (Recebido - Pago)', realized, realized >= 0 ? '#2563eb' : '#dc2626')}
          ${linha('Projetado (Todas as contas)', projected, projected >= 0 ? '#6366f1' : '#ea580c')}
        </table>`;
    } else {
      const incomeList = filteredRecords.filter(r => r.type === 'Income').map(recordRow).join('');
      const expenseList = filteredRecords.filter(r => r.type === 'Expense').map(recordRow).join('');
      bodyHtml = `
        ${incomeList ? `<h2 style="color:#16a34a;margin:0 0 4px 0">CONTAS A RECEBER</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead><tr style="background:#f0fdf4;font-size:10px;color:#166534">
            <th style="padding:6px 8px;text-align:left">Descrição</th>
            <th style="padding:6px 8px;text-align:left">Vencimento</th>
            <th style="padding:6px 8px;text-align:left">Cliente</th>
            <th style="padding:6px 8px;text-align:right">Valor</th>
            <th style="padding:6px 8px;text-align:center">Status</th>
          </tr></thead>
          <tbody>${incomeList}</tbody>
        </table>` : ''}
        ${expenseList ? `<h2 style="color:#dc2626;margin:0 0 4px 0">CONTAS A PAGAR</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead><tr style="background:#fef2f2;font-size:10px;color:#991b1b">
            <th style="padding:6px 8px;text-align:left">Descrição</th>
            <th style="padding:6px 8px;text-align:left">Vencimento</th>
            <th style="padding:6px 8px;text-align:left">Fornecedor</th>
            <th style="padding:6px 8px;text-align:right">Valor</th>
            <th style="padding:6px 8px;text-align:center">Status</th>
          </tr></thead>
          <tbody>${expenseList}</tbody>
        </table>` : ''}
        ${!incomeList && !expenseList ? '<p style="text-align:center;color:#999;font-size:13px;padding:40px 0">Nenhum lançamento no período.</p>' : ''}`;
    }

    w.document.write(`
      <html>
      <head><title>Relatório Financeiro</title>
      <style>
        @page { margin: 10mm; }
        body { font-family:Arial,Helvetica,sans-serif; color:#333; padding:0; margin:0; }
        h1 { font-size:18px; color:#1e3a5f; margin:0 0 4px 0; }
        .periodo { font-size:12px; color:#888; margin-bottom:20px; }
        h2 { font-size:14px; margin-top:20px; }
        table { page-break-inside: avoid; }
        .total-geral { margin-top:24px; border-top:2px solid #333; padding-top:12px; text-align:right; font-size:14px; font-weight:bold; }
        .footer { margin-top:30px; font-size:10px; color:#aaa; text-align:center; border-top:1px solid #ddd; padding-top:8px; }
      </style>
      </head>
      <body>
        <h1>Relatório de Contas a Pagar e a Receber</h1>
        <div class="periodo">Período: ${periodo} &mdash; ${filteredRecords.length} registro(s)</div>
        ${bodyHtml}
        <div class="footer">Relatório gerado em ${new Date().toLocaleString('pt-BR')}</div>
      </body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24">

      {/* USER MENU - TOPO */}
      <div className="flex justify-end mb-3">
        <UserMenu light />
      </div>

      {/* HEADER ESCURO */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-5 md:p-6 mb-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Financeiro</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Contas a Pagar e Receber</h1>
            <p className="text-gray-400 text-sm mt-1">
              Gerencie suas movimentações financeiras
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-white text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-lg shadow-white/10"
          >
            <Plus size={18} /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* CARDS RESUMO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-green-50 rounded-lg"><ArrowUpCircle size={14} className="text-green-600" /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">A Receber</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-green-600 mb-1">{formatCurrency(totalReceivable)}</p>
          <p className="text-[10px] text-gray-400">Recebimentos pendentes</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-red-50 rounded-lg"><ArrowDownCircle size={14} className="text-red-600" /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">A Pagar</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-red-600 mb-1">{formatCurrency(totalPayable)}</p>
          <p className="text-[10px] text-gray-400">Despesas pendentes</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-blue-50 rounded-lg"><ArrowUpCircle size={14} className="text-blue-600" /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Receitas Filtradas</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-blue-600 mb-1">{formatCurrency(filteredIncome)}</p>
          <p className="text-[10px] text-gray-400">Período selecionado</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-amber-50 rounded-lg"><ArrowDownCircle size={14} className="text-amber-600" /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Despesas Filtradas</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-amber-600 mb-1">{formatCurrency(filteredExpense)}</p>
          <p className="text-[10px] text-gray-400">Período selecionado</p>
        </div>
      </div>

      {/* SALDO DOS FILTROS */}
      <div className={`p-4 rounded-2xl mb-6 flex items-center justify-between border ${
        filteredBalance >= 0
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
          : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
      }`}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Saldo dos Filtros</p>
          <p className={`text-xl font-black ${filteredBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(filteredBalance)}
          </p>
        </div>
        <div className="text-right text-[11px] leading-relaxed text-gray-500">
          <p>Receitas <span className="font-bold text-green-600">{formatCurrency(filteredIncome)}</span></p>
          <p>Despesas <span className="font-bold text-red-600">{formatCurrency(filteredExpense)}</span></p>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4">Lançar Movimentação</h2>
            <form onSubmit={handleAddRecord} className="space-y-4">
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-4">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, type: 'Income'})}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${formData.type === 'Income' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                >
                  Receita
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, type: 'Expense'})}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${formData.type === 'Expense' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                >
                  Despesa
                </button>
              </div>

              {/* Se for Despesa, mostra campos de Fornecedor / CNPJ */}
              {formData.type === 'Expense' && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase">Informações do Fornecedor</p>
                  
                  {/* Nome do Fornecedor (com sugestões/busca) */}
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Buscar ou Nome do Fornecedor</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input 
                          type="text" 
                          placeholder="Digite o nome para buscar..."
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 pr-8"
                          value={supplierSearch}
                          onChange={(e) => {
                            setSupplierSearch(e.target.value);
                            setSelectedCustomerId(null); // Limpa id antigo
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                        />
                        {selectedCustomerId && (
                          <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500" size={16} />
                        )}
                      </div>
                      
                      {/* Botão de rápido cadastro (+) */}
                      <button
                        type="button"
                        onClick={handleQuickAddSupplier}
                        title="Cadastrar novo fornecedor"
                        className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>

                    {/* Caixa de Autocomplete/Sugestões */}
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto">
                        {filteredSuggestions.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setSupplierSearch(c.name);
                              setSupplierCnpj(c.cnpj || '');
                              setShowSuggestions(false);
                            }}
                            className="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 text-sm"
                          >
                            <p className="font-semibold text-gray-800">{c.name}</p>
                            {c.cnpj && <p className="text-xs text-gray-500">CNPJ: {c.cnpj}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CNPJ do Fornecedor */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">CNPJ do Fornecedor</label>
                    <input 
                      type="text" 
                      placeholder="00.000.000/0000-00"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
                      value={supplierCnpj}
                      onChange={(e) => setSupplierCnpj(e.target.value)}
                    />
                  </div>

                  {!selectedCustomerId && supplierSearch && (
                    <p className="text-[10px] text-amber-600 flex items-center gap-1">
                      <AlertCircle size={12} /> Clique no "+" para salvar este fornecedor para o futuro.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento</label>
                  <input 
                    type="date" 
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  />
                </div>
              </div>

              {/* RECORRÊNCIA */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recurrenceEnabled}
                    onChange={(e) => setRecurrenceEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Lançamento Recorrente</span>
                </label>
                {recurrenceEnabled && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Repetir por</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="120"
                        required
                        className="w-20 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 text-center"
                        value={recurrenceCount}
                        onChange={(e) => setRecurrenceCount(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                      <span className="text-sm text-gray-500">meses</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Serão criados {recurrenceCount} lançamentos com vencimento mensal.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)}
                  className="flex-1 p-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 p-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FILTROS */}
      <div className="bg-white p-4 md:p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por descrição ou fornecedor..."
            className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            {(['all', 'Income', 'Expense'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  filterType === t
                    ? t === 'Income' ? 'bg-green-500 text-white shadow-sm'
                      : t === 'Expense' ? 'bg-red-500 text-white shadow-sm'
                      : 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'Income' ? 'Receitas' : 'Despesas'}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            {(['all', 'Pending', 'Paid'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  filterStatus === s
                    ? s === 'Paid' ? 'bg-blue-500 text-white shadow-sm'
                      : s === 'Pending' ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s === 'all' ? 'Todos' : s === 'Paid' ? 'Pagos' : 'Pendentes'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-200">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={filterDateStart}
              onChange={(e) => setFilterDateStart(e.target.value)}
              className="p-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
              title="Data início"
            />
            <span className="text-xs text-gray-400">até</span>
            <input
              type="date"
              value={filterDateEnd}
              onChange={(e) => setFilterDateEnd(e.target.value)}
              className="p-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
              title="Data fim"
            />
          </div>
          {(filterDateStart || filterDateEnd) && (
            <button
              onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); }}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              Limpar datas
            </button>
          )}
          <button
            onClick={() => setShowReportModal(true)}
            disabled={filteredRecords.length === 0}
            className="ml-auto flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <FileText size={14} /> Gerar Relatório
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando financeiro...</div>
        ) : (
          filteredRecords.map((record: any) => (
            <div key={record.id} className="flex items-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm relative group hover:shadow-md transition-all">
              <div className={`p-2 rounded-xl mr-4 ${record.type === 'Income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {record.type === 'Income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
              </div>
              
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  {record.description}
                  {record.service_orders?.os_number && (
                    <span className="ml-2 text-[10px] bg-gray-100 text-gray-600 font-bold px-1.5 py-0.5 rounded">OS #{record.service_orders.os_number}</span>
                  )}
                  {record.description.match(/\(\d+\/\d+\)/) && (
                    <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">Recorrente</span>
                  )}
                </p>
                
                {/* Fornecedor Informações se houver vinculação */}
                {record.customers && (
                  <p className="text-xs text-blue-600 font-semibold mt-0.5">
                    Fornecedor: {record.customers.name} {record.customers.cnpj && `(CNPJ: ${record.customers.cnpj})`}
                  </p>
                )}

                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Calendar size={12} className="mr-1" />
                  {parseLocalDate(record.due_date).toLocaleDateString('pt-BR')}
                </div>
              </div>

              <div className="text-right flex items-center gap-2">
                <div>
                  <p className={`font-bold ${record.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    {record.type === 'Income' ? '+' : '-'} {formatCurrency(record.amount)}
                  </p>
                  <p className={`text-[10px] font-bold uppercase ${record.status === 'Paid' ? 'text-blue-500' : 'text-orange-500'}`}>
                    {record.status === 'Paid' ? 'Pago' : 'Pendente'}
                  </p>
                </div>
                
                {record.status === 'Pending' && (
                  <button 
                    onClick={(e) => handleMarkAsPaid(record.id, e)}
                    title="Marcar como pago"
                    className="text-green-500 hover:text-green-700 p-1.5 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <CheckCircle size={20} />
                  </button>
                )}

                {/* Botão de Exclusão (Lixeira) */}
                <button 
                  onClick={(e) => handleDeleteRecord(record.id, e)}
                  title="Excluir lançamento"
                  className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
        {!loading && filteredRecords.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            {searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterDateStart || filterDateEnd
              ? 'Nenhum registro encontrado para estes filtros.'
              : 'Nenhum registro financeiro.'}
          </div>
        )}
      </div>

      {/* MODAL DE RELATÓRIO - CONTAS A PAGAR E A RECEBER */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto print-content">
            <div className="flex justify-between items-center mb-6 no-print">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText size={20} className="text-blue-600" /> Relatório de Contas a Pagar e a Receber
              </h2>
              <button onClick={() => setShowReportModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            {/* Cabeçalho do período */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-gray-500">Período: </span>
                  <span className="font-bold">
                    {filterDateStart ? parseLocalDate(filterDateStart).toLocaleDateString('pt-BR') : 'Início'} 
                    {' até '} 
                    {filterDateEnd ? parseLocalDate(filterDateEnd).toLocaleDateString('pt-BR') : 'Hoje'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{filteredRecords.length} registro(s)</span>
              </div>
            </div>

            {/* Abas: Sintético / Analítico */}
            <div className="flex bg-gray-100 rounded-lg p-0.5 mb-6 no-print w-fit">
              {(['sintetico', 'analitico'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRelatorioTipo(t)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                    relatorioTipo === t
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'sintetico' ? 'Sintético' : 'Analítico'}
                </button>
              ))}
            </div>

            {/* CONTEÚDO DO RELATÓRIO */}
            <div id="report-content">
              {/* VISÃO SINTÉTICA */}
              {relatorioTipo === 'sintetico' && (
                <>
                  {/* Contas a Receber */}
                  <div className="mb-6 print-section">
                    <h3 className="text-sm font-bold text-green-700 uppercase mb-3 flex items-center gap-2">
                      <ArrowUpCircle size={16} /> Contas a Receber
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <p className="text-[10px] font-bold text-green-600 uppercase mb-1">A Receber (Pendente)</p>
                        <p className="text-xl font-black text-green-700">
                          {formatCurrency(
                            filteredRecords
                              .filter(r => r.type === 'Income' && r.status === 'Pending')
                              .reduce((acc, r) => acc + r.amount, 0)
                          )}
                        </p>
                        <p className="text-[10px] text-green-500 mt-1">
                          {filteredRecords.filter(r => r.type === 'Income' && r.status === 'Pending').length} parcela(s)
                        </p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Recebido (Pago)</p>
                        <p className="text-xl font-black text-emerald-700">
                          {formatCurrency(
                            filteredRecords
                              .filter(r => r.type === 'Income' && r.status === 'Paid')
                              .reduce((acc, r) => acc + r.amount, 0)
                          )}
                        </p>
                        <p className="text-[10px] text-emerald-500 mt-1">
                          {filteredRecords.filter(r => r.type === 'Income' && r.status === 'Paid').length} parcela(s)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contas a Pagar */}
                  <div className="mb-6 print-section">
                    <h3 className="text-sm font-bold text-red-700 uppercase mb-3 flex items-center gap-2">
                      <ArrowDownCircle size={16} /> Contas a Pagar
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <p className="text-[10px] font-bold text-red-600 uppercase mb-1">A Pagar (Pendente)</p>
                        <p className="text-xl font-black text-red-700">
                          {formatCurrency(
                            filteredRecords
                              .filter(r => r.type === 'Expense' && r.status === 'Pending')
                              .reduce((acc, r) => acc + r.amount, 0)
                          )}
                        </p>
                        <p className="text-[10px] text-red-500 mt-1">
                          {filteredRecords.filter(r => r.type === 'Expense' && r.status === 'Pending').length} parcela(s)
                        </p>
                      </div>
                      <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                        <p className="text-[10px] font-bold text-rose-600 uppercase mb-1">Pago</p>
                        <p className="text-xl font-black text-rose-700">
                          {formatCurrency(
                            filteredRecords
                              .filter(r => r.type === 'Expense' && r.status === 'Paid')
                              .reduce((acc, r) => acc + r.amount, 0)
                          )}
                        </p>
                        <p className="text-[10px] text-rose-500 mt-1">
                          {filteredRecords.filter(r => r.type === 'Expense' && r.status === 'Paid').length} parcela(s)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Saldo do Período */}
                  <div className="print-section">{(() => {
                    const incomePaid = filteredRecords.filter(r => r.type === 'Income' && r.status === 'Paid').reduce((acc, r) => acc + r.amount, 0);
                    const expensePaid = filteredRecords.filter(r => r.type === 'Expense' && r.status === 'Paid').reduce((acc, r) => acc + r.amount, 0);
                    const incomePending = filteredRecords.filter(r => r.type === 'Income' && r.status === 'Pending').reduce((acc, r) => acc + r.amount, 0);
                    const expensePending = filteredRecords.filter(r => r.type === 'Expense' && r.status === 'Pending').reduce((acc, r) => acc + r.amount, 0);
                    const realizedBalance = incomePaid - expensePaid;
                    const projectedBalance = (incomePaid + incomePending) - (expensePaid + expensePending);
                    return (
                      <div className="border-t pt-4 mb-4">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-3 text-center">Saldo do Período</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className={`rounded-xl p-4 text-center border ${realizedBalance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Realizado (Recebido - Pago)</p>
                            <p className={`text-2xl font-black ${realizedBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                              {realizedBalance >= 0 ? '+' : ''}{formatCurrency(realizedBalance)}
                            </p>
                          </div>
                          <div className={`rounded-xl p-4 text-center border ${projectedBalance >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100'}`}>
                            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Projetado (Todas as contas)</p>
                            <p className={`text-2xl font-black ${projectedBalance >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>
                              {projectedBalance >= 0 ? '+' : ''}{formatCurrency(projectedBalance)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}</div>
                </>
              )}

              {/* VISÃO ANALÍTICA */}
              {relatorioTipo === 'analitico' && (
                <>
                  {/* Contas a Receber */}
                  {filteredRecords.filter(r => r.type === 'Income').length > 0 && (
                    <div className="mb-6 print-section">
                      <h3 className="text-sm font-bold text-green-700 uppercase mb-3 flex items-center gap-2">
                        <ArrowUpCircle size={16} /> Contas a Receber
                      </h3>
                      <div className="space-y-1 border border-green-100 rounded-xl overflow-hidden">
                        {filteredRecords.filter(r => r.type === 'Income').map((record: any) => (
                          <div key={record.id} className="flex items-center justify-between p-3 hover:bg-green-50 text-sm border-b border-green-50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 truncate">
                                {record.description}
                                {record.service_orders?.os_number && (
                                  <span className="ml-1 text-[10px] bg-gray-100 text-gray-600 font-bold px-1 py-0.5 rounded">OS #{record.service_orders.os_number}</span>
                                )}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                Venc: {parseLocalDate(record.due_date).toLocaleDateString('pt-BR')}
                                {record.customers?.name && ` | ${record.customers.name}`}
                              </p>
                            </div>
                            <div className="text-right flex items-center gap-2 flex-shrink-0 ml-3">
                              <span className="font-bold text-green-600">{formatCurrency(record.amount)}</span>
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${record.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                {record.status === 'Paid' ? 'Recebido' : 'Pendente'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contas a Pagar */}
                  {filteredRecords.filter(r => r.type === 'Expense').length > 0 && (
                    <div className="mb-6 print-section">
                      <h3 className="text-sm font-bold text-red-700 uppercase mb-3 flex items-center gap-2">
                        <ArrowDownCircle size={16} /> Contas a Pagar
                      </h3>
                      <div className="space-y-1 border border-red-100 rounded-xl overflow-hidden">
                        {filteredRecords.filter(r => r.type === 'Expense').map((record: any) => (
                          <div key={record.id} className="flex items-center justify-between p-3 hover:bg-red-50 text-sm border-b border-red-50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 truncate">
                                {record.description}
                                {record.service_orders?.os_number && (
                                  <span className="ml-1 text-[10px] bg-gray-100 text-gray-600 font-bold px-1 py-0.5 rounded">OS #{record.service_orders.os_number}</span>
                                )}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                Venc: {parseLocalDate(record.due_date).toLocaleDateString('pt-BR')}
                                {record.customers?.name && ` | ${record.customers.name}`}
                              </p>
                            </div>
                            <div className="text-right flex items-center gap-2 flex-shrink-0 ml-3">
                              <span className="font-bold text-red-600">{formatCurrency(record.amount)}</span>
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${record.status === 'Paid' ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>
                                {record.status === 'Paid' ? 'Pago' : 'Pendente'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredRecords.length === 0 && (
                    <p className="text-center py-8 text-gray-500 text-sm">Nenhum lançamento encontrado no período.</p>
                  )}
                </>
              )}
            </div>

            {/* Botões */}
            <div className="flex gap-3 mt-6 pt-4 border-t no-print">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handlePrintReport}
                className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Imprimir Relatório
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-section { page-break-inside: avoid; }
        }
      `}</style>
      </div>
    </div>
  );
}
