'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, User, Menu, X } from 'lucide-react';

export default function SidebarMenu() {
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

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

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
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors"
      >
        <Menu size={20} className="text-white" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[80] transition-opacity" onClick={() => setOpen(false)} />

          <div className="fixed top-0 left-0 h-full w-[280px] bg-white z-[90] shadow-2xl flex flex-col animate-sidebar-in">
            <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-5 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-sm font-bold">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{profile?.full_name || 'Usuario'}</p>
                    <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
              {profile?.shops?.name && (
                <div className="bg-white/10 rounded-xl px-3 py-1.5 inline-flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-[11px] font-medium text-gray-300">{profile.shops.name}</span>
                </div>
              )}
            </div>

            <div className="flex-1 p-3 space-y-1">
              <button
                onClick={() => { setOpen(false); router.push('/'); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <User size={18} className="text-gray-400" /> Painel
              </button>
              <button
                onClick={() => { setOpen(false); router.push('/profile'); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <Settings size={18} className="text-gray-400" /> Meu Perfil
              </button>
            </div>

            <div className="p-3 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <LogOut size={18} /> Sair da conta
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
