'use client';
import { useState, useEffect, useRef } from 'react';
import { Users, ClipboardList, DollarSign, ArrowUpRight, ShoppingBag, Wallet, FileText, Loader2, TrendingUp, AlertCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { formatCurrency } from '@/lib/format';

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
    });

  const [recentOS, setRecentOS] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const finArrRef = useRef<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (finArrRef.current.length > 0) computeStats(period);
  }, [period]);

  function getPeriodDates(p: string) {
    const today = new Date();
    const start = new Date(today);
    if (p === '7d') start.setDate(start.getDate() - 7);
    else if (p === '15d') start.setDate(start.getDate() - 15);
    else if (p === '30d') start.setDate(start.getDate() - 30);
    else if (p === 'month') start.setDate(1);
    else return { start: null, end: null }; // 'all'
    return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }

  function computeStats(p: string) {
    const arr = finArrRef.current;
    const dates = getPeriodDates(p);
    const todayStr = new Date().toISOString().split('T')[0];
    const monthStartStr = todayStr.slice(0, 7);

    const withinPeriod = (r: any) => {
      if (!dates.start) return true;
      const refDate = r.payment_date || r.due_date;
      return refDate >= dates.start && refDate <= dates.end;
    };

    const grossSales = arr.filter((r: any) => r.type === 'Income' && withinPeriod(r)).reduce((acc: number, r: any) => acc + (r.amount || 0), 0);
    const receivedIncome = arr.filter((r: any) => r.status === 'Paid' && r.type === 'Income' && withinPeriod(r)).reduce((acc: number, r: any) => acc + r.amount, 0);
    const pendingIncome = arr.filter((r: any) => r.status === 'Pending' && r.type === 'Income').reduce((acc: number, r: any) => acc + r.amount, 0);
    const pendingExpense = arr.filter((r: any) => r.status === 'Pending' && r.type === 'Expense').reduce((acc: number, r: any) => acc + r.amount, 0);

    const overdueIncome = arr.filter((r: any) => r.status === 'Pending' && r.type === 'Income' && r.due_date < todayStr).reduce((acc: number, r: any) => acc + r.amount, 0);
    const overdueExpense = arr.filter((r: any) => r.status === 'Pending' && r.type === 'Expense' && r.due_date < todayStr).reduce((acc: number, r: any) => acc + r.amount, 0);

    setStats(prev => ({ ...prev, grossSales, receivedIncome, pendingIncome, pendingExpense, overdueIncome, overdueExpense }));
  }

  function getPeriodLabel(p: string) {
    const labels: any = { '7d': '7 dias', '15d': '15 dias', '30d': '30 dias', month: 'Este mês', all: 'Todo período' };
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

      const [custRes, osRes, finRes, osRecentRes] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id),
        supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id).filter('status', 'not.in', '(Delivered,Cancelled)'),
        supabase.from('financial_records').select('*').eq('shop_id', profile.shop_id),
        supabase.from('service_orders').select('*, customers(name)').eq('shop_id', profile.shop_id).order('created_at', { ascending: false }).limit(5),
      ]);

      if (custRes.error) console.error('Erro ao buscar clientes:', custRes.error);
      if (osRes.error) console.error('Erro ao buscar O.S.:', osRes.error);
      if (finRes.error) console.error('Erro ao buscar financeiro:', finRes.error);
      if (osRecentRes.error) console.error('Erro ao buscar O.S. recentes:', osRecentRes.error);

      const finArr = finRes.data || [];
      finArrRef.current = finArr;

      computeStats(period);
      setStats(prev => ({ ...prev,
        customers: custRes.count || 0,
        activeOS: osRes.count || 0,
      }));
      setRecentOS(osRecentRes.data || []);

      // Chart: últimos 6 meses
      const months: any[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const revenue = finArr.filter((r: any) => r.type === 'Income' && r.status === 'Paid' && r.payment_date?.startsWith(monthStr)).reduce((acc: number, r: any) => acc + (r.amount || 0), 0);
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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">AppÓtica</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</p>
        </div>
      </header>

      {/* AÇÕES RÁPIDAS — primeiro no mobile */}
      <div className="bg-gray-900 p-5 rounded-3xl text-white shadow-xl mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickActionLink href="/sales" label="Nova Venda" icon={<ShoppingBag size={18} />} />
          <QuickActionLink href="/customers" label="Clientes" icon={<Users size={18} />} />
          <QuickActionLink href="/caixa" label="Caixa" icon={<Wallet size={18} />} />
          <QuickActionLink href="/finance" label="Lançar Conta" icon={<FileText size={18} />} />
        </div>
      </div>

       {/* CARDS CLICÁVEIS */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
         <Link href="/customers" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="bg-blue-50 p-2.5 rounded-xl w-fit mb-3">
             <Users size={20} className="text-blue-600" />
           </div>
           <p className="text-gray-500 text-xs font-medium">Clientes</p>
           <p className="text-2xl font-black text-gray-900 mt-0.5">{stats.customers}</p>
         </Link>
         <Link href="/os" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="bg-emerald-50 p-2.5 rounded-xl w-fit mb-3">
             <ClipboardList size={20} className="text-emerald-600" />
           </div>
           <p className="text-gray-500 text-xs font-medium">O.S. Ativas</p>
           <p className="text-2xl font-black text-gray-900 mt-0.5">{stats.activeOS}</p>
         </Link>
         <Link href="/finance?type=Income&status=Pending" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="bg-amber-50 p-2.5 rounded-xl w-fit mb-3">
             <DollarSign size={20} className="text-amber-600" />
           </div>
           <p className="text-gray-500 text-xs font-medium">A Receber</p>
           <p className="text-2xl font-black text-gray-900 mt-0.5">{formatCurrency(stats.pendingIncome)}</p>
         </Link>
         <Link href="/finance?type=Expense&status=Pending" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="bg-red-50 p-2.5 rounded-xl w-fit mb-3">
             <FileText size={20} className="text-red-600" />
           </div>
           <p className="text-gray-500 text-xs font-medium">A Pagar</p>
           <p className="text-2xl font-black text-gray-900 mt-0.5">{formatCurrency(stats.pendingExpense)}</p>
         </Link>
        </div>

        {/* FILTRO DE PERÍODO */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-medium text-gray-500 uppercase mr-1">Período:</span>
          {(['7d', '15d', '30d', 'month', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                period === p
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {getPeriodLabel(p)}
            </button>
          ))}
        </div>

        {/* RESUMO DE VENDAS — em destaque total bruto, recebido, a receber */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="bg-indigo-50 p-2.5 rounded-xl w-fit mb-3">
              <ShoppingBag size={20} className="text-indigo-600" />
            </div>
            <p className="text-gray-500 text-xs font-medium">Total Bruto de Vendas</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{formatCurrency(stats.grossSales)}</p>
            <p className="text-[10px] text-gray-400 mt-1">Faturado no período</p>
          </div>
          <Link href={`/finance?type=Income&status=Paid`} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-green-50 p-2.5 rounded-xl w-fit mb-3">
              <DollarSign size={20} className="text-green-600" />
            </div>
            <p className="text-gray-500 text-xs font-medium">Valor Recebido</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{formatCurrency(stats.receivedIncome)}</p>
            <p className="text-[10px] text-gray-400 mt-1">Recebido no período</p>
          </Link>
          <Link href={`/finance?type=Income&status=Pending`} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-amber-50 p-2.5 rounded-xl w-fit mb-3">
              <DollarSign size={20} className="text-amber-600" />
            </div>
            <p className="text-gray-500 text-xs font-medium">A Receber</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{formatCurrency(stats.pendingIncome)}</p>
            <p className="text-[10px] text-gray-400 mt-1">Total pendente</p>
          </Link>
        </div>

       {/* ALERTA DE DÍVIDAS / INADIMPLÊNCIA */}
       {(stats.overdueIncome > 0 || stats.overdueExpense > 0) && (
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 animate-pulse">
           {stats.overdueIncome > 0 && (
             <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3">
               <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                 <AlertCircle size={20} />
               </div>
               <div>
                 <p className="text-orange-800 text-xs font-bold uppercase">Recebíveis em Atraso</p>
                 <p className="text-lg font-black text-orange-700">{formatCurrency(stats.overdueIncome)}</p>
               </div>
             </div>
           )}
           {stats.overdueExpense > 0 && (
             <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3">
               <div className="bg-red-100 p-2 rounded-lg text-red-600">
                 <AlertCircle size={20} />
               </div>
               <div>
                 <p className="text-red-800 text-xs font-bold uppercase">Contas a Pagar em Atraso</p>
                 <p className="text-lg font-black text-red-700">{formatCurrency(stats.overdueExpense)}</p>
               </div>
             </div>
           )}
         </div>
       )}

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <h2 className="text-base font-bold text-gray-800 mb-4">Fluxo Financeiro (6 meses)</h2>
          {chartData.some(d => d.revenue > 0 || d.expenses > 0) ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} name="Receitas" />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[6, 6, 0, 0]} name="Despesas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-400 text-sm">Nenhum dado financeiro nos últimos meses.</div>
          )}
        </div>

        {/* O.S. RECENTES */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-base font-bold text-gray-800 mb-4">O.S. Recentes</h2>
            {recentOS.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Nenhuma ordem de serviço.</p>
            ) : (
              <div className="space-y-3">
                {recentOS.map((os: any) => (
                  <Link key={os.id} href={`/os/${os.id}`} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                        {os.customers?.name?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{os.customers?.name || 'Cliente'}</p>
                        <p className="text-[10px] text-gray-400">{os.os_number ? os.os_number : `#${os.id.slice(0, 8)}`}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase flex-shrink-0 ${
                      os.status === 'Ready' ? 'bg-yellow-100 text-yellow-600' :
                      os.status === 'Delivered' ? 'bg-green-100 text-green-600' :
                      os.status === 'In_Laboratory' ? 'bg-blue-100 text-blue-600' :
                      os.status === 'Cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {os.status === 'In_Laboratory' ? 'Laboratório' :
                       os.status === 'Ready' ? 'Pronto' :
                       os.status === 'Delivered' ? 'Entregue' :
                       os.status === 'Cancelled' ? 'Cancelado' : 'Aberto'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/os" className="block text-center mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
              Ver todas as ordens →
            </Link>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-base font-bold text-gray-800 mb-3">Resumo Financeiro</h2>
            <div className="space-y-3">
              <Link href="/finance?type=Income&status=Pending" className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors">
                <span className="text-sm text-gray-600">A Receber</span>
                <span className="text-sm font-bold text-amber-600">{formatCurrency(stats.pendingIncome)}</span>
              </Link>
              <Link href="/finance?type=Expense&status=Pending" className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors">
                <span className="text-sm text-gray-600">A Pagar</span>
                <span className="text-sm font-bold text-red-600">{formatCurrency(stats.pendingExpense)}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all group">
      <div className="text-blue-400 group-hover:text-white transition-colors">{icon}</div>
      <span className="text-sm font-medium">{label}</span>
      <ArrowUpRight size={14} className="text-gray-500 ml-auto group-hover:text-white transition-colors" />
    </Link>
  );
}
