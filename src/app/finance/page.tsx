'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, ArrowUpCircle, ArrowDownCircle, Calendar, Trash2, Search, Check, AlertCircle, CheckCircle } from 'lucide-react';

function getLocalDate(date?: Date): string {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function FinancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Estados para o formulário
  const [formData, setFormData] = useState({
    type: 'Income',
    description: '',
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    status: 'Pending'
  });

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

    // 1. Busca o shop_id do perfil do usuário logado
    const { data: profile } = await supabase
      .from('profiles')
      .select('shop_id')
      .single();

    if (!profile?.shop_id) {
      alert('Erro: Você não está vinculado a nenhuma ótica.');
      return;
    }

    const { error } = await supabase
      .from('financial_records')
      .insert([{
        ...formData,
        amount: parseFloat(formData.amount),
        customer_id: formData.type === 'Expense' ? selectedCustomerId : null,
        shop_id: profile.shop_id
      }]);
    
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
          <p className="text-xl font-bold text-green-700">R$ {totalReceivable.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
          <p className="text-red-600 text-xs font-medium mb-1">A Pagar</p>
          <p className="text-xl font-bold text-red-700">R$ {totalPayable.toFixed(2)}</p>
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

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando financeiro...</div>
        ) : (
          records.map((record: any) => (
            <div key={record.id} className="flex items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm relative group">
              <div className={`p-2 rounded-full mr-4 ${record.type === 'Income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {record.type === 'Income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
              </div>
              
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{record.description}</p>
                
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
                    {record.type === 'Income' ? '+' : '-'} R$ {record.amount.toFixed(2)}
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
        {!loading && records.length === 0 && (
          <div className="text-center py-10 text-gray-500">Nenhum registro financeiro.</div>
        )}
      </div>
    </div>
  );
}
