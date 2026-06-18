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

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    setLoading(true);
    const { data, error } = await supabase.from('customers').select('*').order('name', { ascending: true });
    if (!error) setCustomers(data || []);
    setLoading(false);
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    if (!profile?.shop_id) { alert('Erro: Você não está vinculado a nenhuma ótica.'); return; }
    const { error } = await supabase.from('customers').insert([{ ...formData, shop_id: profile.shop_id }]);
    if (!error) { setShowForm(false); setFormData({ name: '', phone: '', email: '', cpf: '', cnpj: '' }); fetchCustomers(); } 
    else { alert('Erro ao salvar: ' + error.message); }
  }

  async function handleCustomerClick(customer: any) {
    setSelectedCustomer(customer);
    setCustomerLoading(true);
    try {
      const { data: ordersData } = await supabase.from('service_orders').select('*, customers(name)').eq('customer_id', customer.id).order('created_at', { ascending: false });
      setCustomerOrders(ordersData || []);
      const { data: finData } = await supabase.from('financial_records').select('*').eq('customer_id', customer.id).order('due_date', { ascending: true });
      setCustomerFinancials(finData || []);
    } catch (err) { console.error(err); } finally { setCustomerLoading(false); }
  }

  const totalPaid = (customerFinancials || []).filter(f => f?.status === 'Paid').reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);
  const totalPending = (customerFinancials || []).filter(f => f?.status === 'Pending').reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);
  const overdueRecords = (customerFinancials || []).filter(f => {
    if (!f?.due_date) return false;
    return f.status === 'Pending' && new Date(f.due_date) < new Date();
  });

  function sendWhatsAppReminder() {
    if (!selectedCustomer?.phone) { alert('Este cliente não possui telefone cadastrado.'); return; }
    const phone = String(selectedCustomer.phone).replace(/\D/g, '');
    const message = `Olá ${selectedCustomer.name}, tudo bem? Aqui é da Ótica. Notamos que você possui parcelas em aberto no valor de R$ ${totalPending.toFixed(2)}. Podemos te ajudar a regularizar?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  const filteredCustomers = customers.filter(customer => {
    const term = searchQuery.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(term) ||
      customer.phone?.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term) ||
      customer.cpf?.toLowerCase().includes(term) ||
      customer.cnpj?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Clientes & Fornecedores</h1>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors">
          <Plus size={24} />
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4">Novo Cadastro</h2>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome / Razão Social</label>
                <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input type="text" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                  <input type="text" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950" value={formData.cpf} onChange={(e) => setFormData({...formData, cpf: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                  <input type="text" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950" value={formData.cnpj} onChange={(e) => setFormData({...formData, cnpj: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 p-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 p-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input type="text" placeholder="Buscar por nome, CPF, CNPJ..." className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-gray-950" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Carregando dados...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            {filteredCustomers.map((customer: any) => (
              <div 
                key={customer.id} 
                onClick={() => handleCustomerClick(customer)}
                className={`flex items-center p-4 bg-white rounded-xl border transition-all cursor-pointer ${selectedCustomer?.id === customer.id ? 'border-blue-600 ring-2 ring-blue-100 shadow-md' : 'border-gray-100 shadow-sm hover:border-blue-200'}`}
              >
                <div className="bg-gray-100 p-2 rounded-full mr-4">
                  <User className="text-gray-600" size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{customer.name}</p>
                  <p className="text-xs text-gray-500">{customer.phone || 'Sem telefone'}</p>
                </div>
                <ArrowRight size={16} className={selectedCustomer?.id === customer.id ? 'text-blue-600' : 'text-gray-300'} />
              </div>
            ))}
            {filteredCustomers.length === 0 && <div className="text-center py-10 text-gray-500">Nenhum resultado encontrado.</div>}
          </div>

          {selectedCustomer && (
            <div className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                  <p className="text-gray-500 text-sm">{selectedCustomer.email || 'Sem e-mail'}</p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><User size={18} className="text-blue-600" /> Dados</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-400">CPF:</span> <span className="font-medium text-gray-800">{selectedCustomer.cpf || '---'}</span></p>
                    <p><span className="text-gray-400">CNPJ:</span> <span className="font-medium text-gray-800">{selectedCustomer.cnpj || '---'}</span></p>
                    <p><span className="text-gray-400">Tel:</span> <span className="font-medium text-gray-800">{selectedCustomer.phone || '---'}</span></p>
                    <p><span className="text-gray-400">Endereço:</span> <span className="font-medium text-gray-800">{selectedCustomer.address || '---'}</span></p>
                  </div>
                  <div className="flex gap-2 pt-4">
                    {selectedCustomer.phone && (
                      <button onClick={() => window.open(`https://wa.me/${String(selectedCustomer.phone).replace(/\\D/g, '')}`, '_blank')} className="flex-1 bg-green-500 text-white p-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-all">
                        <MessageCircle size={14} /> WhatsApp
                      </button>
                    )}
                    {overdueRecords.length > 0 && (
                      <button onClick={sendWhatsAppReminder} className="flex-1 bg-red-500 text-white p-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-all">
                        <AlertCircle size={14} /> Cobrar Atrasos
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><DollarSign size={18} className="text-blue-600" /> Financeiro</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-green-50 rounded-lg">
                      <span className="text-xs text-green-700">Total Pago</span>
                      <span className="text-xs font-bold text-green-700">R$ {totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-amber-50 rounded-lg">
                      <span className="text-xs text-amber-700">A Receber</span>
                      <span className="text-xs font-bold text-amber-700">R$ {totalPending.toFixed(2)}</span>
                    </div>
                    {overdueRecords.length > 0 && (
                      <div className="flex justify-between p-2 bg-red-50 rounded-lg">
                        <span className="text-xs text-red-700">Em Atraso</span>
                        <span className="text-xs font-bold text-red-700">R$ {overdueRecords.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><ShoppingBag size={18} className="text-blue-600" /> Histórico de Vendas</h3>
                <div className="space-y-3">
                  {customerLoading ? (
                    <div className="text-center py-4 text-gray-400 text-sm italic">Carregando histórico...</div>
                  ) : customerOrders.length > 0 ? customerOrders.map((order) => (
                    <Link key={order.id} href={`/os/${order.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-blue-50 transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-lg text-blue-600 shadow-sm"><Calendar size={16} /></div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">O.S. #{order.id.slice(0,8)}</p>
                          <p className="text-[10px] text-gray-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">R$ {order.total_value?.toFixed(2)}</p>
                        <p className={`text-[10px] font-bold uppercase ${order.status === 'Delivered' ? 'text-green-500' : 'text-blue-500'}`}>{order.status.replace('_', ' ')}</p>
                      </div>
                    </Link>
                  )) : (
                    <p className="text-center text-gray-500 py-4 text-sm italic">Nenhuma compra realizada.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
