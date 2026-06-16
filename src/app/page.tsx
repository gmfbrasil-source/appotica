'use client';
import React from 'react';
import { 
  Users, 
  ClipboardList, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

const data = [
  { name: 'Jan', revenue: 4000, expenses: 2400 },
  { name: 'Fev', revenue: 3000, expenses: 1398 },
  { name: 'Mar', revenue: 2000, expenses: 9800 },
  { name: 'Abr', revenue: 2780, expenses: 3908 },
  { name: 'Mai', revenue: 1890, expenses: 4800 },
  { name: 'Jun', revenue: 2390, expenses: 3800 },
];

export default function Dashboard() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <header className="mb-8 flex justify-between items-end">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">Bem-vindo de volta,</p>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Painel de Controle</h1>
        </div>
        <div className="hidden md:block text-right">
          <div className="flex items-center text-gray-500 text-sm">
            <Calendar size={16} className="mr-2" />
            {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Clientes Totais" 
          value="1,284" 
          trend="+12%" 
          trendUp={true} 
          icon={<Users className="text-blue-600" size={22} />} 
          color="blue" 
        />
        <StatCard 
          title="O.S. Ativas" 
          value="43" 
          trend="+5%" 
          trendUp={true} 
          icon={<ClipboardList className="text-emerald-600" size={22} />} 
          color="emerald" 
        />
        <StatCard 
          title="A Receber" 
          value="R$ 12.450" 
          trend="-2%" 
          trendUp={false} 
          icon={<DollarSign className="text-amber-600" size={22} />} 
          color="amber" 
        />
        <StatCard 
          title="Lucro Mensal" 
          value="R$ 8.200" 
          trend="+18%" 
          trendUp={true} 
          icon={<TrendingUp className="text-purple-600" size={22} />} 
          color="purple" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Financial Chart - Main Area */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Fluxo Financeiro</h2>
              <p className="text-sm text-gray-500">Receitas vs Despesas nos últimos 6 meses</p>
            </div>
            <select className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500">
              <option>2026</option>
              <option>2025</option>
            </select>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#9ca3af', fontSize: 12}} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#9ca3af', fontSize: 12}}
                  tickFormatter={(value) => `R$${value}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  name="Receitas"
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#ef4444" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorExpense)" 
                  name="Despesas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="space-y-8">
          <div className="bg-gray-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-lg font-bold mb-4">Ações Rápidas</h2>
              <div className="grid grid-cols-1 gap-3">
                <QuickActionLink href="/customers" label="Novo Cliente" icon={<Plus size={18} />} />
                <QuickActionLink href="/os" label="Nova O.S." icon={<ClipboardList size={18} />} />
                <QuickActionLink href="/finance" label="Lançar Conta" icon={<DollarSign size={18} />} />
              </div>
            </div>
            {/* Decorative element */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-600 rounded-full blur-3xl opacity-20"></div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">O.S. Recentes</h2>
            <div className="space-y-4">
              {[
                { name: 'Ricardo Silva', status: 'Ready', date: 'Hoje' },
                { name: 'Ana Costa', status: 'In_Laboratory', date: 'Ontem' },
                { name: 'Marcos Lima', status: 'Delivered', date: '2 dias atrás' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                      {item.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{item.date}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${
                    item.status === 'Ready' ? 'bg-yellow-100 text-yellow-600' : 
                    item.status === 'Delivered' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/os" className="block text-center mt-6 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
              Ver todas as ordens →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, trendUp, icon, color }: any) {
  const colorClasses: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colorClasses[color]} transition-transform group-hover:scale-110 duration-300`}>
          {icon}
        </div>
        <div className={`flex items-center text-xs font-bold ${trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
          {trend}
          {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        </div>
      </div>
      <p className="text-gray-500 text-sm font-medium">{title}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function QuickActionLink({ href, label, icon }: any) {
  return (
    <Link 
      href={href} 
      className="flex items-center justify-between p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="text-blue-400 group-hover:text-white transition-colors">
          {icon}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ArrowUpRight size={16} className="text-gray-400 group-hover:text-white transition-colors" />
    </Link>
  );
}
