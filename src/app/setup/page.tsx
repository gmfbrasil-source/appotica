'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Store, ArrowRight, Loader2 } from 'lucide-react';

export default function SetupPage() {
  const [shopName, setShopName] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Criar a ótica
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .insert([{ name: shopName }])
        .select()
        .single();

      if (shopError) throw shopError;

      // 2. Criar o perfil vinculado à ótica
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          shop_id: shop.id,
          full_name: fullName,
          role: 'admin'
        }]);

      if (profileError) throw profileError;

      router.push('/');
      router.refresh();
    } catch (error: any) {
      alert('Erro na configuração: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Store className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Configuração Inicial</h1>
          <p className="text-gray-500 text-sm mt-2">Vamos configurar sua ótica para começar a gerenciar tudo!</p>
        </div>

        <form onSubmit={handleSetup} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da sua Ótica</label>
            <input 
              type="text" 
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Ex: Ótica Visão Perfeita"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seu Nome Completo</label>
            <input 
              type="text" 
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <button 
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                Finalizar Configuração <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
