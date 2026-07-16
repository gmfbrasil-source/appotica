'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogOut, User, ChevronDown, Settings } from 'lucide-react';

export default function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('profiles')
          .select('full_name, shop_id, shops(name)')
          .eq('id', session.user.id)
          .single();
        setProfile(data);
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (!user) return null;

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-colors"
      >
        <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-[11px] font-bold text-white">
          {initials}
        </div>
        <span className="text-sm font-medium text-white hidden sm:block max-w-[120px] truncate">
          {profile?.full_name || user.email}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 sm:right-0 left-auto sm:left-auto left-0 top-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 min-w-[220px] max-w-[280px] overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-800 truncate">{profile?.full_name || 'Usuário'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
              {profile?.shops?.name && (
                <p className="text-[10px] text-blue-600 font-medium mt-0.5">{profile.shops.name}</p>
              )}
            </div>
            <button
              onClick={() => { setOpen(false); router.push('/profile'); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings size={16} /> Meu Perfil
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
            >
              <LogOut size={16} /> Sair da conta
            </button>
          </div>
        </>
      )}
    </div>
  );
}
