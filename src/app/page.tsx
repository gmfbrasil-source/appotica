'use client';
import { useState, useEffect, useRef } from 'react';
import { Users, ClipboardList, DollarSign, ShoppingBag, FileText, Loader2, TrendingUp, AlertCircle, XCircle, ArrowDownCircle, ArrowUpCircle, Calendar, Clock, ChevronRight, Wallet } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

import { formatCurrency } from '@/lib/format';
import UserMenu from '@/components/UserMenu';

function getLocalDate(date?: Date): string {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function Dashboard() {
  const [period, setPeriod] = useState<'7d' | '15d' | '30d' | 'month' | 'all'>('month');
  const [stats, setStats] = useState({
    customers: 0,
    activeOS: 0,
    grossSales: 0,
    receivedIncome: 0,
    pendingIncome: 0,
    pendingExpense: 0,
    overdueIncome: 0,
    overdueExpense: 0,
    receivedExpense: 0,
  });

  const [recentOS, setRecentOS] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const finArrRef = useRef<any[]>([]);
  const osArrRef = useRef<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (finArrRef.current.length > 0 || osArrRef.current.length > 0) computeStats(period);
  }, [period]);

  function getPeriodDates(p: string) {
    const today = new Date();
    const start = new Date(today);
    if (p === '7d') start.setDate(start.getDate() - 7);
    else if (p === '15d') start.setDate(start.getDate() - 15);
    else if (p === '30d') start.setDate(start.getDate() - 30);
    else if (p === 'month') start.setDate(1);
    else return { start: null, end: null };
    return { start: getLocalDate(start), end: getLocalDate(today) };
  }

  function computeStats(p: string) {
    const arr = finArrRef.current;
    const orders = osArrRef.current;
    const dates = getPeriodDates(p);
    const todayStr = getLocalDate();

    const withinPeriodOS = (os: any) => {
      if (!dates.start) return true;
      const saleDate = os.sale_date || os.created_at?.split('T')[0];
      return saleDate >= dates.start && saleDate <= dates.end;
    };

    const grossSales = orders.filter((os: any) => withinPeriodOS(os)).reduce((acc: number, os: any) => acc + (os.total_value || 0), 0);
    const withinFinPeriod = (r: any) => {
      if (!dates.start) return true;
      const refDate = r.payment_date || r.due_date;
      return refDate >= dates.start && refDate <= dates.end;
    };
    const receivedIncome = arr.filter((r: any) => r.status === 'Paid' && r.type === 'Income' && withinFinPeriod(r)).reduce((acc: number, r: any) => acc + r.amount, 0);
    const pendingIncome = arr.filter((r: any) => r.status === 'Pending' && r.type === 'Income' && withinFinPeriod(r)).reduce((acc: number, r: any) => acc + r.amount, 0);
    const pendingExpense = arr.filter((r: any) => r.status === 'Pending' && r.type === 'Expense' && withinFinPeriod(r)).reduce((acc: number, r: any) => acc + r.amount, 0);
    const receivedExpense = arr.filter((r: any) => r.status === 'Paid' && r.type === 'Expense' && withinFinPeriod(r)).reduce((acc: number, r: any) => acc + r.amount, 0);

    const overdueIncome = arr.filter((r: any) => r.status === 'Pending' && r.type === 'Income' && r.due_date < todayStr).reduce((acc: number, r: any) => acc + r.amount, 0);
    const overdueExpense = arr.filter((r: any) => r.status === 'Pending' && r.type === 'Expense' && r.due_date < todayStr).reduce((acc: number, r: any) => acc + r.amount, 0);

    setStats(prev => ({ ...prev, grossSales, receivedIncome, pendingIncome, pendingExpense, overdueIncome, overdueExpense, receivedExpense }));
  }

  function getPeriodLabel(p: string) {
    const labels: any = { '7d': '7 dias', '15d': '15 dias', '30d': '30 dias', month: 'Este mês', all: 'Tudo' };
    return labels[p];
  }

  async function fetchDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const { data: profile, error: profileErr } = await supabase.from('profiles').select('shop_id').single();
      if (profileErr || !profile?.shop_id) {
        setError('Perfil sem loja vinculada. Entre em contato com o administrador.');
        return;
      }

      const [custRes, osRes, finRes, osAllRes, osRecentRes] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id),
        supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id).filter('status', 'not.in', '(Delivered,Cancelled)'),
        supabase.from('financial_records').select('*').eq('shop_id', profile.shop_id),
        supabase.from('service_orders').select('id, sale_date, total_value, created_at').eq('shop_id', profile.shop_id),
        supabase.from('service_orders').select('*, customers(name)').eq('shop_id', profile.shop_id).order('created_at', { ascending: false }).limit(5),
      ]);

      if (custRes.error) console.error('Erro ao buscar clientes:', custRes.error);
      if (osRes.error) console.error('Erro ao buscar O.S.:', osRes.error);
      if (finRes.error) console.error('Erro ao buscar financeiro:', finRes.error);
      if (osAllRes.error) console.error('Erro ao buscar todas O.S.:', osAllRes.error);
      if (osRecentRes.error) console.error('Erro ao buscar O.S. recentes:', osRecentRes.error);

      const finArr = finRes.data || [];
      const osAll = osAllRes.data || [];
      finArrRef.current = finArr;
      osArrRef.current = osAll;

      computeStats(period);
      setStats(prev => ({ ...prev,
        customers: custRes.count || 0,
        activeOS: osRes.count || 0,
      }));
      setRecentOS(osRecentRes.data || []);

      const months: any[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const revenue = osAll.filter((os: any) => {
          const sd = os.sale_date || os.created_at?.split('T')[0] || '';
          return sd.startsWith(monthStr);
        }).reduce((acc: number, os: any) => acc + (os.total_value || 0), 0);
        const expenses = finArr.filter((r: any) => r.type === 'Expense' && r.status === 'Paid' && r.payment_date?.startsWith(monthStr)).reduce((acc: number, r: any) => acc + (r.amount || 0), 0);
        months.push({ name: label, revenue: Math.round(revenue), expenses: Math.round(expenses) });
      }
      setChartData(months);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <Loader2 className="animate-spin mx-auto mb-2" size={28} />
          <span className="text-sm">Carregando painel...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="bg-red-50 p-3 rounded-2xl w-fit mx-auto mb-4">
            <XCircle size={32} className="text-red-500" />
          </div>
          <p className="text-gray-800 font-bold text-lg mb-1">Ops! Algo deu errado</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const saldo = stats.receivedIncome - stats.receivedExpense;
  const totalReceber = stats.pendingIncome;
  const totalPagar = stats.pendingExpense;
  const healthPercent = stats.grossSales > 0 ? Math.round((stats.receivedIncome / stats.grossSales) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24">

        {/* HEADER ESCURO */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-5 md:p-6 mb-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Painel Financeiro</p>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Visão geral da sua ótica · <span className="text-white font-semibold">{getPeriodLabel(period)}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['7d', '15d', '30d', 'month', 'all'] as const).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                      period === p
                        ? 'bg-white text-gray-900 shadow-lg shadow-white/20'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                    }`}>
                    {getPeriodLabel(p)}
                  </button>
                ))}
              </div>
              <UserMenu />
            </div>
          </div>
        </div>

        {/* ALERTAS DE ATRASO — TOPO */}
        {(stats.overdueIncome > 0 || stats.overdueExpense > 0) && (
          <div className="mb-6 space-y-2">
            {stats.overdueIncome > 0 && (
              <Link href="/finance?type=Income&status=Pending"
                className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl hover:shadow-md transition-all group">
                <div className="bg-orange-500 p-2 rounded-xl shrink-0">
                  <AlertCircle size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Recebíveis em atraso</p>
                  <p className="text-lg font-black text-orange-700">{formatCurrency(stats.overdueIncome)}</p>
                </div>
                <ChevronRight size={18} className="text-orange-400 group-hover:text-orange-600 transition-colors" />
              </Link>
            )}
            {stats.overdueExpense > 0 && (
              <Link href="/finance?type=Expense&status=Pending"
                className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-2xl hover:shadow-md transition-all group">
                <div className="bg-red-500 p-2 rounded-xl shrink-0">
                  <AlertCircle size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">Contas em atraso</p>
                  <p className="text-lg font-black text-red-700">{formatCurrency(stats.overdueExpense)}</p>
                </div>
                <ChevronRight size={18} className="text-red-400 group-hover:text-red-600 transition-colors" />
              </Link>
            )}
          </div>
        )}

        {/* CARDS FINANCEIROS PRINCIPAIS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Link href="/finance" className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                <ShoppingBag size={14} className="text-indigo-600" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Faturamento</p>
            </div>
            <p className="text-xl md:text-2xl font-black text-gray-900 mb-1">{formatCurrency(stats.grossSales)}</p>
            <p className="text-[10px] text-gray-400">Vendas no período</p>
          </Link>

          <Link href="/finance?type=Income&status=Paid" className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                <ArrowDownCircle size={14} className="text-green-600" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Recebido</p>
            </div>
            <p className="text-xl md:text-2xl font-black text-green-600 mb-1">{formatCurrency(stats.receivedIncome)}</p>
            <p className="text-[10px] text-gray-400">Pagamentos confirmados</p>
          </Link>

          <Link href="/finance?type=Income&status=Pending" className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                <Clock size={14} className="text-amber-600" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">A Receber</p>
            </div>
            <p className="text-xl md:text-2xl font-black text-amber-600 mb-1">{formatCurrency(totalReceber)}</p>
            <p className="text-[10px] text-gray-400">Pendente de recebimento</p>
          </Link>

          <Link href="/finance?type=Expense&status=Pending" className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors">
                <ArrowUpCircle size={14} className="text-red-600" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">A Pagar</p>
            </div>
            <p className="text-xl md:text-2xl font-black text-red-600 mb-1">{formatCurrency(totalPagar)}</p>
            <p className="text-[10px] text-gray-400">Despesas pendentes</p>
          </Link>
        </div>

        {/* SALDO LÍQUIDO + SAÚDE FINANCEIRA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
          <div className={`lg:col-span-2 p-5 rounded-2xl border ${
            saldo >= 0
              ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 border-green-200'
              : 'bg-gradient-to-br from-red-50 via-rose-50 to-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">Saldo Líquido do Período</p>
                <p className={`text-3xl md:text-4xl font-black ${saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(saldo)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Recebido <span className="font-bold text-green-600">{formatCurrency(stats.receivedIncome)}</span>
                  {' '} · Pago <span className="font-bold text-red-600">{formatCurrency(stats.receivedExpense)}</span>
                </p>
              </div>
              <div className={`p-4 rounded-2xl ${saldo >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <Wallet size={28} className={saldo >= 0 ? 'text-green-600' : 'text-red-600'} />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Saúde Financeira</p>
            <div className="flex items-end gap-2 mb-2">
              <p className="text-3xl font-black text-gray-900">{healthPercent}%</p>
              <p className="text-xs text-gray-400 mb-1">coletado</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  healthPercent >= 70 ? 'bg-green-500' : healthPercent >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(healthPercent, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400">
              {healthPercent >= 70 ? 'Excelente — boa cobrança!' : healthPercent >= 40 ? 'Regular — considere cobrar mais' : 'Atenção — muitos pendentes'}
            </p>
          </div>
        </div>

        {/* GRÁFICO + OPERACIONAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* GRÁFICO */}
          <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-800">Fluxo Financeiro</h2>
              <div className="flex items-center gap-4 text-[10px] font-medium">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full" /> Receita</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-400 rounded-full" /> Despesa</span>
              </div>
            </div>
            {chartData.some(d => d.revenue > 0 || d.expenses > 0) ? (
              <div className="h-56 md:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: '12px' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Receita" />
                    <Bar dataKey="expenses" fill="#f87171" radius={[4, 4, 0, 0]} name="Despesa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 md:h-64 flex items-center justify-center text-gray-400 text-sm">Nenhum dado financeiro nos últimos meses.</div>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Resumo Operacional</h2>
              <div className="space-y-3">
                <Link href="/customers" className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl hover:bg-blue-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors"><Users size={16} className="text-blue-600" /></div>
                    <span className="text-sm font-medium text-gray-700">Clientes Cadastrados</span>
                  </div>
                  <span className="text-lg font-black text-gray-900">{stats.customers}</span>
                </Link>
                <Link href="/os" className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl hover:bg-emerald-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors"><ClipboardList size={16} className="text-emerald-600" /></div>
                    <span className="text-sm font-medium text-gray-700">O.S. em Andamento</span>
                  </div>
                  <span className="text-lg font-black text-gray-900">{stats.activeOS}</span>
                </Link>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <h2 className="text-sm font-bold text-gray-800 mb-3">Distribuição</h2>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                    <span className="text-xs text-gray-600">Recebido</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800">{formatCurrency(stats.receivedIncome)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                    <span className="text-xs text-gray-600">A Receber</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800">{formatCurrency(totalReceber)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                    <span className="text-xs text-gray-600">A Pagar</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800">{formatCurrency(totalPagar)}</span>
                </div>
                <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Saldo</span>
                  <span className={`text-sm font-black ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(saldo)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* O.S. RECENTES */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-800">Ordens de Serviço Recentes</h2>
            <Link href="/os" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
              Ver todas <ChevronRight size={14} />
            </Link>
          </div>
          {recentOS.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Nenhuma ordem de serviço.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {recentOS.map((os: any) => (
                <Link key={os.id} href={`/os/${os.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-sm transition-all group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                      {os.customers?.name?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{os.customers?.name || 'Cliente'}</p>
                      <p className="text-[10px] text-gray-400">{os.os_number || `#${os.id.slice(0, 8)}`}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase shrink-0 ${
                    os.status === 'Ready' ? 'bg-yellow-100 text-yellow-700' :
                    os.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                    os.status === 'In_Laboratory' ? 'bg-blue-100 text-blue-700' :
                    os.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {os.status === 'In_Laboratory' ? 'Lab' :
                     os.status === 'Ready' ? 'Pronto' :
                     os.status === 'Delivered' ? 'Entregue' :
                     os.status === 'Cancelled' ? 'Canc.' : 'Aberto'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
