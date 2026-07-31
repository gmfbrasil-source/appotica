'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function checkUser() {
      if (!supabase) {
        setError(true);
        setChecked(true);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();

      if (!session && pathname !== '/login') {
        router.push('/login');
      } else {
        setChecked(true);
      }
    }
    checkUser();

    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && pathname !== '/login') {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  if (pathname === '/login') return <>{children}</>;

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-2 text-gray-400" size={28} />
          <span className="text-sm text-gray-400">Verificando acesso...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-6">
        <div className="text-center max-w-sm">
          <div className="text-3xl mb-3">⚠️</div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">Erro de configuração</h1>
          <p className="text-sm text-gray-500 mb-4">
            As variáveis de ambiente do Supabase (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY) não estão configuradas.
          </p>
          <p className="text-xs text-gray-400">
            Adicione-as no painel da Vercel: Project → Settings → Environment Variables.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
