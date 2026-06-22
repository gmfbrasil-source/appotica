'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Plus, Search, User, ChevronDown, MessageCircle, AlertCircle, Calendar, DollarSign, ShoppingBag, X, Phone, Mail, FileText, CreditCard, CheckCircle, Clock, ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', cpf: '', cnpj: '', address: '' });

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerFinancials, setCustomerFinancials] = useState<any[]>([]);
  const [expandedFinSection, setExpandedFinSection] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });
    if (!error) setCustomers(data || []);
    setLoading(false);
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    if (!profile?.shop_id) {
      alert('Erro: Você não está vinculado a nenhuma ótica.');
      return;
    }
    const { error } = await supabase.from('customers').insert([{ ...formData, shop_id: profile.shop_id }]);
    if (!error) {
      setShowForm(false);
      setFormData({ name: '', phone: '', email: '', cpf: '', cnpj: '', address: '' });
      fetchCustomers();
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
  }

  async function handleCustomerClick(customer: any) {
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer(null);
      setExpandedFinSection(null);
      return;
    }
    setSelectedCustomer(customer);
    setExpandedFinSection(null);
    setCustomerLoading(true);
    try {
      const { data: ordersData } = await supabase
        .from('service_orders')
        .select('*, customers(name)')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      setCustomerOrders(ordersData || []);
      const { data: finData } = await supabase
        .from('financial_records')
        .select('*')
        .eq('customer_id', customer.id)
        .order('due_date', { ascending: true });
      setCustomerFinancials(finData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCustomerLoading(false);
    }
  }

  const today = new Date(new Date().toDateString());

  const paidIncomeRecords = (customerFinancials || []).filter(f => f?.status === 'Paid' && f?.type === 'Income');
  const paidExpenseRecords = (customerFinancials || []).filter(f => f?.status === 'Paid' && f?.type === 'Expense');
  const totalPaidIncome = paidIncomeRecords.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);
  const totalPaidExpense = paidExpenseRecords.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);

  const overdueIncome = (customerFinancials || []).filter(f => {
    if (!f?.due_date) return false;
    return f.status === 'Pending' && f.type === 'Income' && new Date(f.due_date) < today;
  });
  const totalOverdueIncome = overdueIncome.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);

  const overdueExpense = (customerFinancials || []).filter(f => {
    if (!f?.due_date) return false;
    return f.status === 'Pending' && f.type === 'Expense' && new Date(f.due_date) < today;
  });
  const totalOverdueExpense = overdueExpense.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);

  const overdueAll = [...overdueIncome, ...overdueExpense];
  const totalOverdueAll = totalOverdueIncome + totalOverdueExpense;

  const pendingIncomeRecords = (customerFinancials || []).filter(f =>
    f?.status === 'Pending' && f?.type === 'Income' && !overdueIncome.some(o => o.id === f.id)
  );
  const totalToReceive = pendingIncomeRecords.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);

  const pendingExpenseRecords = (customerFinancials || []).filter(f =>
    f?.status === 'Pending' && f?.type === 'Expense' && !overdueExpense.some(o => o.id === f.id)
  );
  const totalToPay = pendingExpenseRecords.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);

  const filteredCustomers = searchQuery
    ? customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.cpf && c.cpf.includes(searchQuery)) ||
        (c.phone && c.phone.includes(searchQuery))
      )
    : customers;

  function handleWhatsApp(customer: any) {
    if (!customer.phone) {
      alert('Cliente não possui telefone cadastrado.');
      return;
    }
    const phoneClean = customer.phone.replace(/\D/g, '');
    const msg = encodeURIComponent(`Olá ${customer.name}! Tudo bem? Aqui é da Ótica, passando para saber como você está.`);
    window.open(`https://wa.me/55${phoneClean}?text=${msg}`, '_blank');
  }

  function handleCharge(customer: any) {
    if (!customer.phone) {
      alert('Cliente não possui telefone cadastrado.');
      return;
    }
    const phoneClean = customer.phone.replace(/\D/g, '');
    const items = overdueIncome.map(r => `- ${r.description}: ${formatCurrency(Number(r.amount))}`).join('\n');
    const msg = encodeURIComponent(
      `Olá ${customer.name}! Tudo bem?\n\n` +
      `Identificamos que há valor${overdueIncome.length > 1 ? 'es' : ''} pendente${overdueIncome.length > 1 ? 's' : ''} em nosso sistema:\n\n` +
      `${items}\n\n` +
      `Valor total em atraso: ${formatCurrency(totalOverdueIncome)}\n\n` +
      `Pedimos gentilmente que entre em contato conosco para regularizar. Estamos à disposição!`
    );
    window.open(`https://wa.me/55${phoneClean}?text=${msg}`, '_blank');
  }

  function toggleFinSection(section: string) {
    setExpandedFinSection(expandedFinSection === section ? null : section);
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
        <button
          onClick={() => { setFormData({ name: '', phone: '', email: '', cpf: '', cnpj: '', address: '' }); setShowForm(true); }}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou telefone..."
          className="w-full pl-10 p-3 bg-gray-100 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (selectedCustomer) {
              setSelectedCustomer(null);
              setExpandedFinSection(null);
            }
          }}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Novo Cliente</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-950" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input type="text" className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-950" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-950" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <input type="text" className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-950" value={formData.cpf} onChange={(e) => setFormData({...formData, cpf: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                <input type="text" className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-950" value={formData.cnpj} onChange={(e) => setFormData({...formData, cnpj: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input type="text" className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-950" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              </div>
              <button type="submit" className="w-full p-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                Salvar Cliente
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando clientes...</div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.id}>
              <div
                onClick={() => handleCustomerClick(customer)}
                className="flex items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="bg-blue-100 p-2 rounded-full mr-4">
                  <User size={20} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{customer.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {customer.phone || 'Sem telefone'}
                    {customer.cpf ? ` | CPF: ${customer.cpf}` : ''}
                    {customer.cnpj ? ` | CNPJ: ${customer.cnpj}` : ''}
                  </p>
                </div>
                <ChevronDown size={18} className={`text-gray-400 transition-transform flex-shrink-0 ${selectedCustomer?.id === customer.id ? 'rotate-180' : ''}`} />
              </div>

              {selectedCustomer?.id === customer.id && (
                <div className="mx-2 mb-3 bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-4">
                  {customerLoading ? (
                    <div className="text-center py-6 text-gray-500">Carregando detalhes...</div>
                  ) : (
                    <>
                      {/* DADOS DO CADASTRO */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-2">
                        <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                          <User size={16} className="text-blue-600" /> Dados do Cliente
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <FileText size={14} className="text-gray-400" />
                            <span><strong>CPF:</strong> {customer.cpf || '---'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <FileText size={14} className="text-gray-400" />
                            <span><strong>CNPJ:</strong> {customer.cnpj || '---'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Phone size={14} className="text-gray-400" />
                            <span><strong>Tel:</strong> {customer.phone || '---'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail size={14} className="text-gray-400" />
                            <span><strong>Email:</strong> {customer.email || '---'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600 sm:col-span-2">
                            <MapPin size={14} className="text-gray-400" />
                            <span><strong>Endereço:</strong> {customer.address || '---'}</span>
                          </div>
                        </div>
                      </div>

                      {/* RESUMO FINANCEIRO - CARDS CLICÁVEIS */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button onClick={() => toggleFinSection('paid')} className={`text-left p-3 rounded-xl border transition-all overflow-hidden ${expandedFinSection === 'paid' ? 'bg-green-100 border-green-300 shadow-sm' : 'bg-green-50 border-green-100 hover:bg-green-100'}`}>
                          <p className="text-green-600 text-[10px] font-medium uppercase">Recebido</p>
                          <p className="text-lg font-bold text-green-700 truncate">{formatCurrency(totalPaidIncome + totalPaidExpense)}</p>
                        </button>
                        <button onClick={() => toggleFinSection('to_receive')} className={`text-left p-3 rounded-xl border transition-all overflow-hidden ${expandedFinSection === 'to_receive' ? 'bg-yellow-100 border-yellow-300 shadow-sm' : 'bg-yellow-50 border-yellow-100 hover:bg-yellow-100'}`}>
                          <p className="text-yellow-600 text-[10px] font-medium uppercase">A Receber</p>
                          <p className="text-lg font-bold text-yellow-700 truncate">{formatCurrency(totalToReceive)}</p>
                          {pendingIncomeRecords.length > 0 && (
                            <p className="text-[10px] text-yellow-500 font-semibold">{pendingIncomeRecords.length} registro(s)</p>
                          )}
                        </button>
                        <button onClick={() => toggleFinSection('to_pay')} className={`text-left p-3 rounded-xl border transition-all overflow-hidden ${expandedFinSection === 'to_pay' ? 'bg-orange-100 border-orange-300 shadow-sm' : 'bg-orange-50 border-orange-100 hover:bg-orange-100'}`}>
                          <p className="text-orange-600 text-[10px] font-medium uppercase">A Pagar</p>
                          <p className="text-lg font-bold text-orange-700 truncate">{formatCurrency(totalToPay)}</p>
                          {pendingExpenseRecords.length > 0 && (
                            <p className="text-[10px] text-orange-500 font-semibold">{pendingExpenseRecords.length} registro(s)</p>
                          )}
                        </button>
                        <button onClick={() => { if (overdueAll.length > 0) toggleFinSection('overdue'); }} className={`text-left p-3 rounded-xl border transition-all overflow-hidden ${overdueAll.length === 0 ? 'opacity-50 cursor-not-allowed' : ''} ${expandedFinSection === 'overdue' ? 'bg-red-100 border-red-300 shadow-sm' : 'bg-red-50 border-red-100 hover:bg-red-100'}`}>
                          <p className="text-red-600 text-[10px] font-medium uppercase">Em Atraso</p>
                          <p className="text-lg font-bold text-red-700 truncate">{formatCurrency(totalOverdueAll)}</p>
                          {overdueAll.length > 0 && (
                            <p className="text-[10px] text-red-500 font-semibold">{overdueAll.length} registro(s)</p>
                          )}
                        </button>
                      </div>

                      {/* LISTA EXPANSÍVEL - PAGOS */}
                      {expandedFinSection === 'paid' && (paidIncomeRecords.length > 0 || paidExpenseRecords.length > 0) && (
                        <div className="bg-white rounded-xl border border-green-100 p-3 space-y-3">
                          <p className="text-xs font-bold text-green-600 uppercase flex items-center gap-1">
                            <CheckCircle size={14} /> Recebido
                          </p>
                          {paidIncomeRecords.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-green-500 uppercase mb-1">Receitas (+)</p>
                              {paidIncomeRecords.map((rec: any) => (
                                <div key={rec.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                                  <div>
                                    <p className="text-gray-800 font-medium">{rec.description}</p>
                                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                      <Calendar size={10} /> {new Date(rec.due_date).toLocaleDateString('pt-BR')}
                                    </p>
                                  </div>
                                  <p className="font-bold text-green-600">+ {formatCurrency(Number(rec.amount))}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {paidExpenseRecords.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-red-500 uppercase mb-1">Despesas (-)</p>
                              {paidExpenseRecords.map((rec: any) => (
                                <div key={rec.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                                  <div>
                                    <p className="text-gray-800 font-medium">{rec.description}</p>
                                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                      <Calendar size={10} /> {new Date(rec.due_date).toLocaleDateString('pt-BR')}
                                    </p>
                                  </div>
                                  <p className="font-bold text-red-600">- {formatCurrency(Number(rec.amount))}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* LISTA EXPANSÍVEL - A RECEBER */}
                      {expandedFinSection === 'to_receive' && pendingIncomeRecords.length > 0 && (
                        <div className="bg-white rounded-xl border border-yellow-100 p-3 space-y-2">
                          <p className="text-xs font-bold text-yellow-600 uppercase flex items-center gap-1">
                            <Clock size={14} /> A Receber (em dia)
                          </p>
                          {pendingIncomeRecords.map((rec: any) => (
                            <div key={rec.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                              <div>
                                <p className="text-gray-800 font-medium">{rec.description}</p>
                                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                  <Calendar size={10} /> Vence: {new Date(rec.due_date).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                              <p className="font-bold text-yellow-600">{formatCurrency(Number(rec.amount))}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* LISTA EXPANSÍVEL - A PAGAR */}
                      {expandedFinSection === 'to_pay' && pendingExpenseRecords.length > 0 && (
                        <div className="bg-white rounded-xl border border-orange-100 p-3 space-y-2">
                          <p className="text-xs font-bold text-orange-600 uppercase flex items-center gap-1">
                            <Clock size={14} /> A Pagar (em dia)
                          </p>
                          {pendingExpenseRecords.map((rec: any) => (
                            <div key={rec.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                              <div>
                                <p className="text-gray-800 font-medium">{rec.description}</p>
                                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                  <Calendar size={10} /> Vence: {new Date(rec.due_date).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                              <p className="font-bold text-orange-600">{formatCurrency(Number(rec.amount))}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* LISTA EXPANSÍVEL - EM ATRASO */}
                      {expandedFinSection === 'overdue' && overdueAll.length > 0 && (
                        <div className="bg-white rounded-xl border border-red-100 p-3 space-y-3">
                          <p className="text-xs font-bold text-red-600 uppercase flex items-center gap-1">
                            <AlertCircle size={14} /> Em Atraso
                          </p>
                          {overdueIncome.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-red-500 uppercase mb-1">A Receber (atrasado)</p>
                              {overdueIncome.map((rec: any) => (
                                <div key={rec.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                                  <div>
                                    <p className="text-gray-800 font-medium">{rec.description}</p>
                                    <p className="text-[11px] text-red-400 flex items-center gap-1">
                                      <Calendar size={10} /> Venceu: {new Date(rec.due_date).toLocaleDateString('pt-BR')}
                                    </p>
                                  </div>
                                  <p className="font-bold text-red-600">{formatCurrency(Number(rec.amount))}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {overdueExpense.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-red-500 uppercase mb-1">A Pagar (atrasado)</p>
                              {overdueExpense.map((rec: any) => (
                                <div key={rec.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                                  <div>
                                    <p className="text-gray-800 font-medium">{rec.description}</p>
                                    <p className="text-[11px] text-red-400 flex items-center gap-1">
                                      <Calendar size={10} /> Venceu: {new Date(rec.due_date).toLocaleDateString('pt-BR')}
                                    </p>
                                  </div>
                                  <p className="font-bold text-red-600">{formatCurrency(Number(rec.amount))}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* HISTÓRICO DE COMPRAS */}
                      {customerOrders.length > 0 && (
                        <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-2">
                          <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                            <ShoppingBag size={16} className="text-blue-600" /> Compras Realizadas
                          </p>
                          <div className="space-y-2">
                            {customerOrders.map((os: any) => (
                              <Link key={os.id} href={`/os/${os.id}`} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">O.S. #{os.id.slice(0, 8)}</p>
                                  <p className="text-xs text-gray-500">{new Date(os.created_at).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-blue-600">{formatCurrency(Number(os.total_value))}</p>
                                  <ArrowRight size={14} className="text-gray-400" />
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {customerOrders.length === 0 && customerFinancials.length === 0 && (
                        <p className="text-center text-gray-400 text-sm py-4">Nenhum registro encontrado para este cliente.</p>
                      )}

                      {/* BOTÕES DE AÇÃO */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleWhatsApp(customer)}
                          className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5"
                        >
                          <MessageCircle size={16} /> WhatsApp
                        </button>
                        {overdueIncome.length > 0 && (
                          <button
                            onClick={() => handleCharge(customer)}
                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5"
                          >
                            <AlertCircle size={16} /> Cobrar ({overdueIncome.length})
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        {!loading && filteredCustomers.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            {searchQuery ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado.'}
          </div>
        )}
      </div>
    </div>
  );
}
