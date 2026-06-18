'use client';
import { useState, useEffect } from 'react';
import { Users, ClipboardList, DollarSign, ArrowUpRight, ShoppingBag, Wallet, FileText, Loader2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { formatCurrency } from '@/lib/format';

export default function Dashboard() {
  const [stats, setStats] = useState({
    customers: 0,
    activeOS: 0,
    pendingIncome: 0,
    pendingExpense: 0,
    monthIncome: 0,
  });
  const [recentOS, setRecentOS] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('shop_id').single();
      if (!profile?.shop_id) return;

      const shopFilter = { shop_id: profile.shop_id };

      const [{ count: custCount }, { count: osCount }, { data: finData }, { data: osData }] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id),
        supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id).not('status', 'in', '("Delivered","Cancelled")'),
        supabase.from('financial_records').select('*').eq('shop_id', profile.shop_id),
        supabase.from('service_orders').select('*, customers(name)').eq('shop_id', profile.shop_id).order('created_at', { ascending: false }).limit(5),
      ]);

      const finArr = finData || [];
      const pendingIncome = finArr.filter((r: any) => r.status === 'Pending' && r.type === 'Income').reduce((acc: number, r: any) => acc + r.amount, 0);
      const pendingExpense = finArr.filter((r: any) => r.status === 'Pending' && r.type === 'Expense').reduce((acc: number, r: any) => acc + r.amount, 0);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const monthIncome = finArr.filter((r: any) => r.status === 'Paid' && r.type === 'Income' && r.payment_date && new Date(r.payment_date) >= monthStart).reduce((acc: number, r: any) => acc + r.amount, 0);

      setStats({
        customers: custCount || 0,
        activeOS: osCount || 0,
        pendingIncome,
        pendingExpense,
        monthIncome,
      });
      setRecentOS(osData || []);

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
        <Link href="/finance" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="bg-amber-50 p-2.5 rounded-xl w-fit mb-3">
            <DollarSign size={20} className="text-amber-600" />
          </div>
          <p className="text-gray-500 text-xs font-medium">A Receber</p>
          <p className="text-2xl font-black text-gray-900 mt-0.5">{formatCurrency(stats.pendingIncome)}</p>
        </Link>
        <Link href="/caixa" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="bg-purple-50 p-2.5 rounded-xl w-fit mb-3">
            <TrendingUp size={20} className="text-purple-600" />
          </div>
          <p className="text-gray-500 text-xs font-medium">Vendas no Mês</p>
          <p className="text-2xl font-black text-gray-900 mt-0.5">{formatCurrency(stats.monthIncome)}</p>
        </Link>
      </div>

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
                        <p className="text-[10px] text-gray-400">#{os.id.slice(0, 8)}</p>
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
              <Link href="/finance" className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors">
                <span className="text-sm text-gray-600">A Receber</span>
                <span className="text-sm font-bold text-amber-600">{formatCurrency(stats.pendingIncome)}</span>
              </Link>
              <Link href="/finance" className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors">
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
