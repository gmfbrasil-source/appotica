'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, User, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', cpf: '', cnpj: '' });

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
    
    // 1. Busca o shop_id do perfil do usuário logado
    const { data: profile } = await supabase
      .from('profiles')
      .select('shop_id')
      .single();

    if (!profile?.shop_id) {
      alert('Erro: Você não está vinculado a nenhuma ótica. Por favor, configure seu perfil.');
      return;
    }

    // 2. Insere o cliente com o shop_id
    const { error } = await supabase
      .from('customers')
      .insert([{ 
        ...formData, 
        shop_id: profile.shop_id 
      }]);
    
    if (!error) {
      setShowForm(false);
      setFormData({ name: '', phone: '', email: '', cpf: '', cnpj: '' });
      fetchCustomers();
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
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
        <button 
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
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
                <input 
                  type="text" 
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input 
                  type="text" 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
                    value={formData.cpf}
                    onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  type="email" 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por nome, CPF, CNPJ..." 
          className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-gray-950"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Carregando dados...</div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((customer: any) => (
            <Link 
              key={customer.id} 
              href={`/customers/${customer.id}`}
              className="flex items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className="bg-gray-100 p-2 rounded-full mr-4">
                <User className="text-gray-600" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{customer.name}</p>
                <p className="text-xs text-gray-500">{customer.phone || 'Sem telefone'}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  {customer.cpf && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full font-medium mr-2">CPF: {customer.cpf}</span>}
                  {customer.cnpj && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">CNPJ: {customer.cnpj}</span>}
                </div>
                <ArrowRight size={16} className="text-gray-300" />
              </div>
            </Link>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="text-center py-10 text-gray-500">Nenhum resultado encontrado.</div>
          )}
        </div>
      )}
    </div>
  );
}
