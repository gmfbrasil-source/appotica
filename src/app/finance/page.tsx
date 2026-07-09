'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Plus, ArrowUpCircle, ArrowDownCircle, Calendar, Trash2, Search, Check, AlertCircle, CheckCircle, Printer, X, FileText } from 'lucide-react';

function getLocalDate(date?: Date): string {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
    due_date: new Date().toISOString().split('T')[0],
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
    fetchRecords();
    fetchCustomers();
  }, []);

  async function fetchRecords() {
    setLoading(true);
    const { data, error } = await supabase
      .from('financial_records')
      .select('*, customers(name, cnpj)')
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
      due_date: new Date().toISOString().split('T')[0],
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Financeiro</h1>
        <button 
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
          <p className="text-green-600 text-xs font-medium mb-1">A Receber</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalReceivable)}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
          <p className="text-red-600 text-xs font-medium mb-1">A Pagar</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(totalPayable)}</p>
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

      {/* Barra de Busca */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Buscar por descrição ou fornecedor..."
          className="w-full pl-10 p-2.5 bg-gray-100 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filtros por tipo e status */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['all', 'Income', 'Expense'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                filterType === t
                  ? t === 'Income' ? 'bg-green-500 text-white'
                    : t === 'Expense' ? 'bg-red-500 text-white'
                    : 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'Income' ? 'Receitas' : 'Despesas'}
            </button>
          ))}
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['all', 'Pending', 'Paid'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                filterStatus === s
                  ? s === 'Paid' ? 'bg-blue-500 text-white'
                    : s === 'Pending' ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'all' ? 'Todos' : s === 'Paid' ? 'Pagos' : 'Pendentes'}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro por período */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1.5">
          <Calendar size={16} className="text-gray-500 ml-1" />
          <input
            type="date"
            value={filterDateStart}
            onChange={(e) => setFilterDateStart(e.target.value)}
            className="p-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
            title="Data início"
          />
          <span className="text-xs text-gray-500">até</span>
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
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileText size={14} /> Gerar Relatório
        </button>
      </div>

      {/* Saldo baseado nos filtros */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 mb-4 border border-blue-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-5">
            <div>
              <p className="text-xs text-green-600 font-medium">Receitas Filtradas</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(filteredIncome)}</p>
            </div>
            <div>
              <p className="text-xs text-red-600 font-medium">Despesas Filtradas</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(filteredExpense)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-600 font-medium uppercase">Saldo dos Filtros</p>
            <p className={`text-2xl font-black ${filteredBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
              {filteredBalance >= 0 ? '+' : ''} {formatCurrency(filteredBalance)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando financeiro...</div>
        ) : (
          filteredRecords.map((record: any) => (
            <div key={record.id} className="flex items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm relative group">
              <div className={`p-2 rounded-full mr-4 ${record.type === 'Income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {record.type === 'Income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
              </div>
              
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  {record.description}
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
                  {new Date(record.due_date).toLocaleDateString('pt-BR')}
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
                    {filterDateStart ? new Date(filterDateStart).toLocaleDateString('pt-BR') : 'Início'} 
                    {' até '} 
                    {filterDateEnd ? new Date(filterDateEnd).toLocaleDateString('pt-BR') : 'Hoje'}
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
                              <p className="font-semibold text-gray-800 truncate">{record.description}</p>
                              <p className="text-[11px] text-gray-500">
                                Venc: {new Date(record.due_date).toLocaleDateString('pt-BR')}
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
                              <p className="font-semibold text-gray-800 truncate">{record.description}</p>
                              <p className="text-[11px] text-gray-500">
                                Venc: {new Date(record.due_date).toLocaleDateString('pt-BR')}
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
                onClick={() => window.print()}
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
          @page { margin: 10mm; size: A4; }
          html, body { height: 100%; margin: 0; padding: 0; background: white; }
          body * { visibility: hidden !important; }
          .print-content, .print-content * { visibility: visible !important; }
          .print-content {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            min-height: 100vh !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: white !important;
            padding: 15mm !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            z-index: 999999 !important;
          }
          .no-print { display: none !important; }
          .print-section { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
