'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Plus, Package, Truck, CheckCircle, Clock, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserMenu from '@/components/UserMenu';

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('T')[0].split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

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
    notes: '',
    os_number: '',
    frame_width: '',
    bridge_rim: '',
    major_angle: '',
    dp_os: '',
    altura: ''
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
        customer_id: formData.customer_id,
        total_value: parseFloat(formData.total_value),
        scheduled_date: formData.scheduled_date,
        status: formData.status,
        notes: formData.notes,
        os_number: formData.os_number,
        shop_id: profile.shop_id,
        frame_width: formData.frame_width ? parseFloat(formData.frame_width) : null,
        bridge_rim: formData.bridge_rim ? parseFloat(formData.bridge_rim) : null,
        major_angle: formData.major_angle ? parseFloat(formData.major_angle) : null,
        dp_os: formData.dp_os ? parseFloat(formData.dp_os) : null,
        altura: formData.altura ? parseFloat(formData.altura) : null
      }]);
    
    if (!error) {
      setShowForm(false);
      setFormData({ customer_id: '', total_value: '', scheduled_date: '', status: 'Open', notes: '', os_number: '', frame_width: '', bridge_rim: '', major_angle: '', dp_os: '', altura: '' });
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
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24">

      {/* HEADER ESCURO */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-5 md:p-6 mb-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Gestão</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Ordens de Serviço</h1>
            <p className="text-gray-400 text-sm mt-1">
              Acompanhe todas as O.S. da sua loja
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-white text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-lg shadow-white/10"
          >
            <Plus size={18} /> Nova O.S.
          </button>
          <UserMenu />
        </div>
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

              <p className="text-xs font-bold text-gray-500 uppercase mt-2">Medições da Armação</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Des. Arm. (mm)</label>
                  <input type="number" step="0.1" min="0" placeholder="52" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.frame_width} onChange={(e) => setFormData({...formData, frame_width: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ponte + Aro (mm)</label>
                  <input type="number" step="0.1" min="0" placeholder="18" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.bridge_rim} onChange={(e) => setFormData({...formData, bridge_rim: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ang. Maior (°)</label>
                  <input type="number" step="0.1" min="0" placeholder="10" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.major_angle} onChange={(e) => setFormData({...formData, major_angle: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">D.P. (mm)</label>
                  <input type="number" step="0.5" min="0" placeholder="62" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.dp_os} onChange={(e) => setFormData({...formData, dp_os: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Altura (mm)</label>
                  <input type="number" step="0.5" min="0" placeholder="22" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.altura} onChange={(e) => setFormData({...formData, altura: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nº da O.S. (opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ex: 001/2026"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.os_number}
                  onChange={(e) => setFormData({...formData, os_number: e.target.value})}
                />
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
              className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all cursor-pointer relative group"
            >
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/sales?edit=${order.id}`); }}
                className="absolute top-2 right-2 bg-white border border-gray-200 text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50 transition-colors shadow-sm z-10"
                title="Editar venda"
              >
                <Pencil size={15} />
              </button>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-gray-800">{order.customers?.name || 'Cliente desconhecido'}</p>
                  <p className="text-xs text-gray-500">{order.os_number ? `Nº ${order.os_number}` : `O.S. #${order.id.slice(0,8)}`}</p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusConfig[order.status as keyof typeof statusConfig]?.color || 'bg-gray-100'}`}>
                  {statusConfig[order.status as keyof typeof statusConfig]?.icon}
                  {order.status.replace('_', ' ')}
                </div>
              </div>
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-50">
                <div className="flex items-center text-xs text-gray-500">
                  <Clock size={12} className="mr-1" />
                  {order.scheduled_date ? parseLocalDate(order.scheduled_date).toLocaleDateString('pt-BR') : 'Sem data'}
                </div>
                <p className="font-bold text-blue-600">{formatCurrency(order.total_value || 0)}</p>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-center py-10 text-gray-500">Nenhuma ordem de serviço encontrada.</div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
