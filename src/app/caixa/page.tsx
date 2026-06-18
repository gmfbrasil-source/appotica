'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Calendar, ArrowUpCircle, ArrowDownCircle, CheckCircle, DollarSign, FileText, Loader2, X, AlertCircle, Clock } from 'lucide-react';

function getLocalDate(date?: Date): string {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function CaixaPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingNote, setClosingNote] = useState('');
  const [closing, setClosing] = useState(false);
  const [closings, setClosings] = useState<any[]>([]);

  useEffect(() => {
    fetchRecords();
    fetchClosings();
  }, [selectedDate]);

  async function fetchRecords() {
    setLoading(true);
    // Sincronizado com o financeiro:
    // - payment_date = hoje (já pagos/recebidos)
    // - due_date = hoje AND status = Pending (a vencer hoje)
    const { data, error } = await supabase
      .from('financial_records')
      .select('*, customers(name, cnpj)')
      .or(`payment_date.eq.${selectedDate},and(due_date.eq.${selectedDate},status.eq.Pending)`)
      .order('created_at', { ascending: false });

    if (!error) setRecords(data || []);
    setLoading(false);
  }

  async function fetchClosings() {
    const { data } = await supabase
      .from('cash_closing')
      .select('*')
      .eq('closing_date', selectedDate)
      .order('created_at', { ascending: false });
    if (data) setClosings(data);
  }

  async function handleMarkAsPaid(id: string) {
    const { error } = await supabase
      .from('financial_records')
      .update({ status: 'Paid', payment_date: selectedDate })
      .eq('id', id);

    if (!error) {
      fetchRecords();
    } else {
      alert('Erro: ' + error.message);
    }
  }

  async function handleCloseCash() {
    setClosing(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('shop_id').single();
      if (!profile?.shop_id) throw new Error('Perfil sem loja vinculada.');

      // Fechamento considera só os que foram efetivamente pagos/recebidos no dia
      const paidRecords = records.filter(r => r.status === 'Paid');
      const totalIncome = paidRecords
        .filter(r => r.type === 'Income')
        .reduce((acc, r) => acc + r.amount, 0);
      const totalExpense = paidRecords
        .filter(r => r.type === 'Expense')
        .reduce((acc, r) => acc + r.amount, 0);
      const balance = totalIncome - totalExpense;

      if (closings.length > 0) {
        if (!confirm('Este dia já possui fechamento. Deseja criar outro mesmo assim?')) {
          setClosing(false);
          return;
        }
      }

      const { error } = await supabase.from('cash_closing').insert([{
        shop_id: profile.shop_id,
        closing_date: selectedDate,
        total_income: totalIncome,
        total_expense: totalExpense,
        balance: balance,
        notes: closingNote || null
      }]);

      if (error) throw error;

      alert('Caixa fechado com sucesso!');
      setShowCloseModal(false);
      setClosingNote('');
      fetchClosings();
    } catch (err: any) {
      alert('Erro ao fechar caixa: ' + err.message);
    } finally {
      setClosing(false);
    }
  }

  const paidRecords = records.filter(r => r.status === 'Paid');
  const pendingRecords = records.filter(r => r.status === 'Pending');

  const totalIncomePaid = paidRecords.filter(r => r.type === 'Income').reduce((acc, r) => acc + r.amount, 0);
  const totalExpensePaid = paidRecords.filter(r => r.type === 'Expense').reduce((acc, r) => acc + r.amount, 0);
  const totalIncomePending = pendingRecords.filter(r => r.type === 'Income').reduce((acc, r) => acc + r.amount, 0);
  const totalExpensePending = pendingRecords.filter(r => r.type === 'Expense').reduce((acc, r) => acc + r.amount, 0);
  const alreadyClosed = closings.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <DollarSign size={24} className="text-blue-600" /> Caixa
        </h1>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Data do Caixa</label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="date"
            className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* 4 cards: Recebido / Pago / A Receber / A Pagar */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
          <p className="text-green-600 text-xs font-medium mb-1">Recebido Hoje</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalIncomePaid)}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
          <p className="text-red-600 text-xs font-medium mb-1">Pago Hoje</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(totalExpensePaid)}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100">
          <p className="text-yellow-600 text-xs font-medium mb-1">A Receber (Vence Hoje)</p>
          <p className="text-xl font-bold text-yellow-700">{formatCurrency(totalIncomePending)}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
          <p className="text-orange-600 text-xs font-medium mb-1">A Pagar (Vence Hoje)</p>
          <p className="text-xl font-bold text-orange-700">{formatCurrency(totalExpensePending)}</p>
        </div>
      </div>

      {alreadyClosed && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-blue-700">
          <CheckCircle size={16} />
          Caixa já fechado {closings.length > 1 ? `(${closings.length}x) ` : ''}neste dia.
        </div>
      )}

      {/* Lista de Movimentações */}
      <div className="space-y-3 mb-6">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Nenhuma movimentação neste dia.</div>
        ) : (
          <>
            {pendingRecords.length > 0 && (
              <div>
                <p className="text-xs font-bold text-orange-600 uppercase mb-2 flex items-center gap-1">
                  <Clock size={14} /> Pendentes ({pendingRecords.length})
                </p>
                {pendingRecords.map((record: any) => (
                  <div key={record.id} className="flex items-center p-4 bg-white rounded-xl border border-orange-100 shadow-sm mb-2">
                    <div className={`p-2 rounded-full mr-3 ${record.type === 'Income' ? 'bg-yellow-100 text-yellow-600' : 'bg-orange-100 text-orange-600'}`}>
                      {record.type === 'Income' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{record.description}</p>
                      {record.customers && (
                        <p className="text-xs text-blue-600 font-medium truncate">{record.customers.name}</p>
                      )}
                      <p className="text-[10px] text-gray-400">
                        Vence: {new Date(record.due_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <p className={`font-bold text-sm ${record.type === 'Income' ? 'text-yellow-600' : 'text-orange-600'}`}>
                        {formatCurrency(record.amount)}
                      </p>
                      <button
                        onClick={() => handleMarkAsPaid(record.id)}
                        title="Receber / Pagar"
                        className="text-green-500 hover:text-green-700 p-1.5 rounded-lg hover:bg-green-50 transition-colors"
                      >
                        <CheckCircle size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {paidRecords.length > 0 && (
              <div>
                <p className="text-xs font-bold text-green-600 uppercase mb-2 flex items-center gap-1">
                  <CheckCircle size={14} /> Efetivados ({paidRecords.length})
                </p>
                {paidRecords.map((record: any) => (
                  <div key={record.id} className="flex items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm mb-2">
                    <div className={`p-2 rounded-full mr-3 ${record.type === 'Income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {record.type === 'Income' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{record.description}</p>
                      {record.customers && (
                        <p className="text-xs text-blue-600 font-medium truncate">{record.customers.name}</p>
                      )}
                      <p className="text-[10px] text-blue-500 font-bold uppercase">Pago</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <p className={`font-bold text-sm ${record.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(record.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <button
        onClick={() => setShowCloseModal(true)}
        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
      >
        <FileText size={18} /> Fechar Caixa do Dia
      </button>

      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Fechar Caixa</h2>
              <button onClick={() => setShowCloseModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="flex justify-between"><span className="text-gray-600">Data:</span> <span className="font-bold">{new Date(selectedDate).toLocaleDateString('pt-BR')}</span></p>
                <p className="flex justify-between"><span className="text-green-600">Recebido:</span> <span className="font-bold text-green-700">{formatCurrency(totalIncomePaid)}</span></p>
                <p className="flex justify-between"><span className="text-red-600">Pago:</span> <span className="font-bold text-red-700">{formatCurrency(totalExpensePaid)}</span></p>
                <p className="flex justify-between border-t pt-2"><span className="text-blue-600">Saldo:</span> <span className={`font-bold text-lg ${(totalIncomePaid - totalExpensePaid) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(totalIncomePaid - totalExpensePaid)}</span></p>
                {pendingRecords.length > 0 && (
                  <p className="text-xs text-orange-500 flex items-center gap-1 pt-1">
                    <AlertCircle size={12} /> {pendingRecords.length} registro(s) pendente(s) não entram no fechamento.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
                <textarea
                  rows={2}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-950"
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  placeholder="Anotação para o fechamento..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 p-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCloseCash}
                  disabled={closing}
                  className="flex-1 p-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {closing ? <Loader2 className="animate-spin" size={18} /> : null}
                  Confirmar Fechamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
