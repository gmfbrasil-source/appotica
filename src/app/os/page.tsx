'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OSPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    total_value: '',
    scheduled_date: '',
    status: 'Open',
    notes: ''
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from('service_orders')
      .select('*, customers(name)')
      .order('created_at', { ascending: false });
    
    if (!error) setOrders(data || []);
    setLoading(false);
  }

  async function handleAddOrder(e: React.FormEvent) {
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
      .from('service_orders')
      .insert([{
        ...formData,
        total_value: parseFloat(formData.total_value),
        shop_id: profile.shop_id
      }]);
    
    if (!error) {
      setShowForm(false);
      setFormData({ customer_id: '', total_value: '', scheduled_date: '', status: 'Open', notes: '' });
      fetchOrders();
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
  }

  const statusConfig = {
    Open: { icon: <Clock size={16} />, color: 'bg-gray-100 text-gray-600' },
    In_Laboratory: { icon: <Package size={16} />, color: 'bg-blue-100 text-blue-600' },
    Ready: { icon: <Truck size={16} />, color: 'bg-yellow-100 text-yellow-600' },
    Delivered: { icon: <CheckCircle size={16} />, color: 'bg-green-100 text-green-600' },
    Cancelled: { icon: <Clock size={16} />, color: 'bg-red-100 text-red-600' },
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Ordens de Serviço</h1>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Nova O.S.</h2>
            <form onSubmit={handleAddOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (ID)</label>
                <input 
                  type="text" 
                  required
                  placeholder="Insira o ID do cliente"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.customer_id}
                  onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.total_value}
                    onChange={(e) => setFormData({...formData, total_value: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Previsão Entrega</label>
                  <input 
                    type="date" 
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas/Observações</label>
                <textarea 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
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
                  Criar O.S.
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500">Carregando ordens...</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <div 
              key={order.id} 
              onClick={() => router.push(`/os/${order.id}`)}
              className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-gray-800">{order.customers?.name || 'Cliente desconhecido'}</p>
                  <p className="text-xs text-gray-500">O.S. #{order.id.slice(0,8)}</p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusConfig[order.status as keyof typeof statusConfig]?.color || 'bg-gray-100'}`}>
                  {statusConfig[order.status as keyof typeof statusConfig]?.icon}
                  {order.status.replace('_', ' ')}
                </div>
              </div>
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-50">
                <div className="flex items-center text-xs text-gray-500">
                  <Clock size={12} className="mr-1" />
                  {order.scheduled_date ? new Date(order.scheduled_date).toLocaleDateString('pt-BR') : 'Sem data'}
                </div>
                <p className="font-bold text-blue-600">R$ {order.total_value?.toFixed(2)}</p>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-center py-10 text-gray-500">Nenhuma ordem de serviço encontrada.</div>
          )}
        </div>
      )}
    </div>
  );
}
