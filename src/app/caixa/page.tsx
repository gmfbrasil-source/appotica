'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Calendar, ArrowUpCircle, ArrowDownCircle, CheckCircle, DollarSign, FileText, Loader2, X, AlertCircle, Clock } from 'lucide-react';
import SidebarMenu from '@/components/SidebarMenu';

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
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-24">

      <SidebarMenu />

      {/* HEADER ESCURO */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl ml-14 md:ml-0 p-5 md:p-6 mb-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Operacional</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Caixa do Dia</h1>
            <p className="text-gray-400 text-sm mt-1">
              Controle de movimentações diárias
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl">
            <Calendar size={16} className="text-gray-300" />
            <input
              type="date"
              className="bg-transparent text-white text-sm font-bold outline-none cursor-pointer"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 4 CARDS RESUMO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-green-50 rounded-lg"><ArrowUpCircle size={14} className="text-green-600" /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Recebido</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-green-600 mb-1">{formatCurrency(totalIncomePaid)}</p>
          <p className="text-[10px] text-gray-400">Pagamentos confirmados</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-red-50 rounded-lg"><ArrowDownCircle size={14} className="text-red-600" /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Pago</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-red-600 mb-1">{formatCurrency(totalExpensePaid)}</p>
          <p className="text-[10px] text-gray-400">Despesas quitadas</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-amber-50 rounded-lg"><Clock size={14} className="text-amber-600" /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">A Receber</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-amber-600 mb-1">{formatCurrency(totalIncomePending)}</p>
          <p className="text-[10px] text-gray-400">Vence hoje</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-orange-50 rounded-lg"><Clock size={14} className="text-orange-600" /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">A Pagar</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-orange-600 mb-1">{formatCurrency(totalExpensePending)}</p>
          <p className="text-[10px] text-gray-400">Vence hoje</p>
        </div>
      </div>

      {/* SALDO DO DIA */}
      {(() => {
        const saldo = totalIncomePaid - totalExpensePaid;
        return (
          <div className={`p-4 rounded-2xl mb-6 flex items-center justify-between border ${
            saldo >= 0
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
              : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
          }`}>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Saldo do Dia</p>
              <p className={`text-xl font-black ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(saldo)}
              </p>
            </div>
            <div className="text-right text-[11px] leading-relaxed text-gray-500">
              <p>Recebido <span className="font-bold text-green-600">{formatCurrency(totalIncomePaid)}</span></p>
              <p>Pago <span className="font-bold text-red-600">{formatCurrency(totalExpensePaid)}</span></p>
            </div>
          </div>
        );
      })()}

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
                  <div key={record.id} className="flex items-center p-4 bg-white rounded-2xl border border-orange-100 shadow-sm mb-2 hover:shadow-md transition-all">
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
                  <div key={record.id} className="flex items-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm mb-2 hover:shadow-md transition-all">
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
        className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all shadow-sm flex items-center justify-center gap-2"
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
    </div>
  );
}
