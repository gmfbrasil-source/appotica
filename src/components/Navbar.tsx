'use client';
import Link from 'next/link';
import { Home, Users, DollarSign, ShoppingBag, Wallet, Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 flex justify-around items-center z-50">
      <Link href="/" className={`flex flex-col items-center transition-colors ${pathname === '/' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
        <Home size={22} />
        <span className="text-[10px]">Home</span>
      </Link>
      <Link href="/customers" className={`flex flex-col items-center transition-colors ${pathname === '/customers' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
        <Users size={22} />
        <span className="text-[10px]">Clientes</span>
      </Link>
      <Link href="/sales" className={`flex flex-col items-center transition-colors ${pathname === '/sales' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
        <ShoppingBag size={22} />
        <span className="text-[10px]">Vendas</span>
      </Link>
      <Link href="/caixa" className={`flex flex-col items-center transition-colors ${pathname === '/caixa' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
        <Wallet size={22} />
        <span className="text-[10px]">Caixa</span>
      </Link>
      <Link href="/finance" className={`flex flex-col items-center transition-colors ${pathname === '/finance' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
        <DollarSign size={22} />
        <span className="text-[10px]">Financeiro</span>
      </Link>
      <Link href="/settings" className={`flex flex-col items-center transition-colors ${pathname === '/settings' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
        <Settings size={22} />
        <span className="text-[10px]">Config</span>
      </Link>
    </nav>
  );
}
