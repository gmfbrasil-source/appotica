import './globals.css';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { Home, Users, DollarSign, ClipboardList } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'AppÓtica - Gestão Simplificada',
  description: 'Gestão de ótica na palma da mão',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        <main className="pb-20 bg-gray-50 min-h-screen">
          {children}
        </main>
        
        {/* Mobile Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex justify-around items-center z-50">
          <Link href="/" className="flex flex-col items-center text-gray-600 hover:text-blue-600">
            <Home size={24} />
            <span className="text-xs">Home</span>
          </Link>
          <Link href="/customers" className="flex flex-col items-center text-gray-600 hover:text-blue-600">
            <Users size={24} />
            <span className="text-xs">Clientes</span>
          </Link>
          <Link href="/os" className="flex flex-col items-center text-gray-600 hover:text-blue-600">
            <ClipboardList size={24} />
            <span className="text-xs">O.S.</span>
          </Link>
          <Link href="/finance" className="flex flex-col items-center text-gray-600 hover:text-blue-600">
            <DollarSign size={24} />
            <span className="text-xs">Financeiro</span>
          </Link>
        </nav>
      </body>
    </html>
  );
}
