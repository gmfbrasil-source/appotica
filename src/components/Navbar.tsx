'use client';
import Link from 'next/link';
import { Home, Users, DollarSign, ClipboardList } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  // Não mostra a barra de navegação na página de login ou setup
  if (pathname === '/login' || pathname === '/setup') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex justify-around items-center z-50">
      <Link href="/" className={`flex flex-col items-center transition-colors ${pathname === '/' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
        <Home size={24} />
        <span className="text-xs">Home</span>
      </Link>
      <Link href="/customers" className={`flex flex-col items-center transition-colors ${pathname === '/customers' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
        <Users size={24} />
        <span className="text-xs">Clientes</span>
      </Link>
      <Link href="/os" className={`flex flex-col items-center transition-colors ${pathname === '/os' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
        <ClipboardList size={24} />
        <span className="text-xs">O.S.</span>
      </Link>
      <Link href="/finance" className={`flex flex-col items-center transition-colors ${pathname === '/finance' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
        <DollarSign size={24} />
        <span className="text-xs">Financeiro</span>
      </Link>
    </nav>
  );
}
