'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogOut, User, ChevronDown, Settings } from 'lucide-react';

export default function UserMenu({ light = false }: { light?: boolean }) {
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
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors ${light ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-white/10 hover:bg-white/20'}`}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold ${light ? 'bg-gray-900 text-white' : 'bg-white/20 text-white'}`}>
          {initials}
        </div>
        <span className={`text-sm font-medium hidden sm:block max-w-[120px] truncate ${light ? 'text-gray-700' : 'text-white'}`}>
          {profile?.full_name || user.email}
        </span>
        <ChevronDown size={14} className={`${light ? 'text-gray-500' : 'text-gray-400'} transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setOpen(false)} />

          {/* DESKTOP: dropdown no canto superior direito */}
          <div className="hidden sm:block absolute right-0 top-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl z-[70] min-w-[220px] overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-800 truncate">{profile?.full_name || 'Usuario'}</p>
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

          {/* MOBILE: bottom sheet fixo embaixo */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[70] shadow-2xl p-4 pb-8 animate-slide-up">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <div className="p-3 bg-gray-50 rounded-xl mb-3">
              <p className="text-xs font-bold text-gray-800 truncate">{profile?.full_name || 'Usuario'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
              {profile?.shops?.name && (
                <p className="text-[10px] text-blue-600 font-medium mt-0.5">{profile.shops.name}</p>
              )}
            </div>
            <button
              onClick={() => { setOpen(false); router.push('/profile'); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <Settings size={18} /> Meu Perfil
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors border-t border-gray-100 mt-1"
            >
              <LogOut size={18} /> Sair da conta
            </button>
          </div>
        </>
      )}
    </div>
  );
}
