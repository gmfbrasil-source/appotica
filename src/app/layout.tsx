import './globals.css';
import { Inter } from 'next/font/google';
import AuthGuard from '@/components/AuthGuard';
import Navbar from '@/components/Navbar';

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
        <AuthGuard>
          <main className="pb-20 bg-gray-50 min-h-screen">
            {children}
          </main>
          <Navbar />
        </AuthGuard>
      </body>
    </html>
  );
}
