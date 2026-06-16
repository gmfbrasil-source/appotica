'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, ArrowUpCircle, ArrowDownCircle, Calendar } from 'lucide-react';

export default function FinancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'Income',
    description: '',
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    status: 'Pending'
  });

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords() {
    setLoading(true);
    const { data, error } = await supabase
      .from('financial_records')
      .select('*')
      .order('due_date', { ascending: true });
    
    if (!error) setRecords(data || []);
    setLoading(false);
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
        shop_id: profile.shop_id
      }]);
    
    if (!error) {
      setShowForm(false);
      setFormData({ type: 'Income', description: '', amount: '', due_date: new Date().toISOString().split('T')[0], status: 'Pending' });
      fetchRecords();
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
  }

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
          onClick={() => setShowForm(true)}
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento</label>
                  <input 
                    type="date" 
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
            <div key={record.id} className="flex items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className={`p-2 rounded-full mr-4 ${record.type === 'Income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {record.type === 'Income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{record.description}</p>
                <div className="flex items-center text-xs text-gray-500">
                  <Calendar size={12} className="mr-1" />
                  {new Date(record.due_date).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${record.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                  {record.type === 'Income' ? '+' : '-'} R$ {record.amount.toFixed(2)}
                </p>
                <p className={`text-[10px] font-bold uppercase ${record.status === 'Paid' ? 'text-blue-500' : 'text-orange-500'}`}>
                  {record.status === 'Paid' ? 'Pago' : 'Pendente'}
                </p>
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
