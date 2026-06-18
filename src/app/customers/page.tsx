'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, User, ArrowRight, MessageCircle, AlertCircle, Calendar, DollarSign, ShoppingBag, X } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', cpf: '', cnpj: '' });

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerFinancials, setCustomerFinancials] = useState<any[]>([]);

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
      setFormData({ name: '', phone: '', email: '', cpf: '', cnpj: '' });
      fetchCustomers();
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
  }

  async function handleCustomerClick(customer: any) {
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer(null);
      return;
    }
    setSelectedCustomer(customer);
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

  const totalPaid = (customerFinancials || []).filter(f => f?.status === 'Paid').reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);
  const totalPending = (customerFinancials || []).filter(f => f?.status === 'Pending').reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);
  const overdueRecords = (customerFinancials || []).filter(f => {
    if (!f?.due_date) return false;
    return f.status === 'Pending' && new Date(f.due_date) < new Date(new Date().toDateString());
  });

  const filteredCustomers = searchQuery
    ? customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.cpf && c.cpf.includes(searchQuery)) ||
        (c.phone && c.phone.includes(searchQuery))
      )
    : customers;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
        <button
          onClick={() => { setFormData({ name: '', phone: '', email: '', cpf: '', cnpj: '' }); setShowForm(true); }}
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
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
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
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{customer.name}</p>
                  <p className="text-xs text-gray-500">{customer.phone || 'Sem telefone'} {customer.cpf && `| CPF: ${customer.cpf}`}</p>
                </div>
                <ArrowRight size={18} className={`text-gray-400 transition-transform ${selectedCustomer?.id === customer.id ? 'rotate-90' : ''}`} />
              </div>

              {selectedCustomer?.id === customer.id && (
                <div className="mx-2 mb-3 bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-4">
                  {customerLoading ? (
                    <div className="text-center py-6 text-gray-500">Carregando detalhes...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                          <p className="text-green-600 text-xs font-medium">Total Pago</p>
                          <p className="text-lg font-bold text-green-700">R$ {totalPaid.toFixed(2)}</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                          <p className="text-red-600 text-xs font-medium">Total Pendente</p>
                          <p className="text-lg font-bold text-red-700">R$ {totalPending.toFixed(2)}</p>
                        </div>
                      </div>

                      {overdueRecords.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                          <p className="text-red-600 text-xs font-bold flex items-center gap-1 mb-2">
                            <AlertCircle size={14} /> {overdueRecords.length} registro(s) em atraso
                          </p>
                          {overdueRecords.map((rec: any) => (
                            <div key={rec.id} className="flex justify-between text-sm text-red-700">
                              <span className="truncate">{rec.description}</span>
                              <span className="font-bold">R$ {Number(rec.amount).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {customerOrders.length > 0 && (
                        <div>
                          <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                            <ShoppingBag size={14} /> Ordens de Serviço
                          </p>
                          <div className="space-y-2">
                            {customerOrders.map((os: any) => (
                              <Link key={os.id} href={`/os/${os.id}`} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-shadow">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">O.S. #{os.id.slice(0, 8)}</p>
                                  <p className="text-xs text-gray-500">{new Date(os.created_at).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <p className="text-sm font-bold text-blue-600">R$ {Number(os.total_value).toFixed(2)}</p>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {customerFinancials.length > 0 && (
                        <div>
                          <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                            <DollarSign size={14} /> Financeiro
                          </p>
                          <div className="space-y-2">
                            {customerFinancials.map((rec: any) => (
                              <div key={rec.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{rec.description}</p>
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Calendar size={10} /> {new Date(rec.due_date).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-bold ${rec.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                    R$ {Number(rec.amount).toFixed(2)}
                                  </p>
                                  <p className={`text-[10px] font-bold uppercase ${rec.status === 'Paid' ? 'text-blue-500' : 'text-orange-500'}`}>
                                    {rec.status === 'Paid' ? 'Pago' : 'Pendente'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {customerOrders.length === 0 && customerFinancials.length === 0 && (
                        <p className="text-center text-gray-400 text-sm py-4">Nenhum registro encontrado para este cliente.</p>
                      )}
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
