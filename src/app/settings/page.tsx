'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CreditCard, Loader2, Plus, Check, X, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', fee_percent: '', max_installments: '1', is_card: false, active: true });

  useEffect(() => {
    fetchMethods();
  }, []);

  async function fetchMethods() {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    if (!profile?.shop_id) { setLoading(false); return; }
    const { data } = await supabase.from('payment_methods').select('*').eq('shop_id', profile.shop_id).order('name');
    if (data) setMethods(data);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    if (!profile?.shop_id) return;

    const payload = {
      shop_id: profile.shop_id,
      name: formData.name,
      fee_percent: parseFloat(formData.fee_percent) || 0,
      max_installments: parseInt(formData.max_installments) || 1,
      is_card: formData.is_card,
      active: formData.active,
    };

    if (editingId) {
      await supabase.from('payment_methods').update(payload).eq('id', editingId);
    } else {
      await supabase.from('payment_methods').insert([payload]);
    }

    setEditingId(null);
    setShowForm(false);
    setFormData({ name: '', fee_percent: '', max_installments: '1', is_card: false, active: true });
    fetchMethods();
  }

  function startEdit(method: any) {
    setEditingId(method.id);
    setFormData({
      name: method.name,
      fee_percent: String(method.fee_percent),
      max_installments: String(method.max_installments),
      is_card: method.is_card,
      active: method.active,
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este método de pagamento?')) return;
    await supabase.from('payment_methods').delete().eq('id', id);
    fetchMethods();
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900">Configurações</h1>
        </div>
        <button
          onClick={() => { setEditingId(null); setFormData({ name: '', fee_percent: '', max_installments: '1', is_card: false, active: true }); setShowForm(true); }}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-6">Gerencie as formas de pagamento da sua loja.</p>

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
              <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                Salvar
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500"><Loader2 className="animate-spin mx-auto mb-2" size={24} /> Carregando...</div>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => (
            <div key={m.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${m.is_card ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-500">
                      {m.is_card && `Taxa: ${m.fee_percent}% | `}
                      {m.max_installments > 1 ? `Até ${m.max_installments}x` : 'À vista'}
                      {!m.active && <span className="text-red-500 ml-2">Inativo</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(m)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {methods.length === 0 && <p className="text-center text-gray-500 py-10">Nenhum método de pagamento cadastrado.</p>}
        </div>
      )}
    </div>
  );
}
