'use client';
import Link from 'next/link';
import { Home, Users, DollarSign, ShoppingBag, Wallet } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="fixed bottom-4 left-4 right-4 bg-white/90 backdrop-blur-xl border border-gray-200/50 px-2 py-2 flex justify-around items-center z-50 rounded-2xl shadow-lg shadow-black/5">
      <Link href="/" className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${pathname === '/' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
        <Home size={20} />
        <span className="text-[9px] font-bold">Home</span>
      </Link>
      <Link href="/customers" className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${pathname === '/customers' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
        <Users size={20} />
        <span className="text-[9px] font-bold">Clientes</span>
      </Link>
      <Link href="/sales" className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${pathname === '/sales' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
        <ShoppingBag size={20} />
        <span className="text-[9px] font-bold">Vendas</span>
      </Link>
      <Link href="/caixa" className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${pathname === '/caixa' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
        <Wallet size={20} />
        <span className="text-[9px] font-bold">Caixa</span>
      </Link>
      <Link href="/finance" className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${pathname === '/finance' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
        <DollarSign size={20} />
        <span className="text-[9px] font-bold">Financeiro</span>
      </Link>
    </nav>
  );
}
