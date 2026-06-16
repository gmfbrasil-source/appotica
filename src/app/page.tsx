import { Users, ClipboardList, DollarSign, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Olá, Bem-vindo! 👋</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="bg-blue-100 p-2 rounded-lg w-fit mb-3">
            <Users className="text-blue-600" size={20} />
          </div>
          <p className="text-gray-500 text-sm">Clientes</p>
          <p className="text-2xl font-bold">124</p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="bg-green-100 p-2 rounded-lg w-fit mb-3">
            <ClipboardList className="text-green-600" size={20} />
          </div>
          <p className="text-gray-500 text-sm">O.S. Ativas</p>
          <p className="text-2xl font-bold">12</p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="bg-yellow-100 p-2 rounded-lg w-fit mb-3">
            <DollarSign className="text-yellow-600" size={20} />
          </div>
          <p className="text-gray-500 text-sm">A Receber</p>
          <p className="text-2xl font-bold">R$ 2.450</p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="bg-purple-100 p-2 rounded-lg w-fit mb-3">
            <TrendingUp className="text-purple-600" size={20} />
          </div>
          <p className="text-gray-500 text-sm">Vendas Mês</p>
          <p className="text-2xl font-bold">R$ 8.200</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4 text-gray-700">Ações Rápidas</h2>
      <div className="space-y-3">
        <Link href="/customers" className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors">
          <span className="font-medium text-gray-700">Novo Cliente</span>
          <span className="text-blue-600 font-bold">+</span>
        </Link>
        <Link href="/os" className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors">
          <span className="font-medium text-gray-700">Nova Ordem de Serviço</span>
          <span className="text-blue-600 font-bold">+</span>
        </Link>
        <Link href="/finance" className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors">
          <span className="font-medium text-gray-700">Lançar Conta</span>
          <span className="text-blue-600 font-bold">+</span>
        </Link>
      </div>
    </div>
  );
}
