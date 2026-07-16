'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2, User, Sparkles, Store } from 'lucide-react';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });

        if (signUpError) throw signUpError;

        const finalShopName = shopName.trim() || `${fullName.split(' ')[0]} - Ótica`;

        // Se tem sessão (confirmação de email DESATIVADA), cria loja direto
        if (data.session) {
          const { error: rpcError } = await supabase.rpc('create_user_with_shop', {
            user_id: data.user!.id,
            full_name: fullName,
            shop_name: finalShopName,
          });
          if (rpcError) throw rpcError;
          await supabase.rpc('create_default_message_templates');
          router.push('/');
          router.refresh();
          return;
        }

        // Se NÃO tem sessão (confirmação de email ATIVADA), tenta criar loja com o user id mesmo assim
        if (data.user) {
          const { error: rpcError } = await supabase.rpc('create_user_with_shop', {
            user_id: data.user.id,
            full_name: fullName,
            shop_name: finalShopName,
          });
          if (rpcError) {
            console.error('Erro ao criar loja:', rpcError);
          }
          await supabase.rpc('create_default_message_templates');
        }

        setNeedsConfirmation(!data.session);
        setSuccess(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      let msg = err.message || 'Ocorreu um erro inesperado.';
      if (msg.includes('rate limit') || msg.includes('email')) {
        msg = 'Muitas tentativas aguarde alguns minutos e tente novamente, ou desative a confirmação de e-mail no Supabase (Dashboard > Auth > Settings).';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 text-center">
          <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Cadastro realizado!</h1>
          <p className="text-gray-500 text-sm mb-6">
            {needsConfirmation
              ? 'Confirme seu e-mail e depois faça login.'
              : 'Sua loja foi criada. Faça login para começar.'}
          </p>
          <button
            onClick={() => { setSuccess(false); setIsSignUp(false); setEmail(''); setPassword(''); setFullName(''); setShopName(''); }}
            className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-sm"
          >
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="bg-gray-900 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Sparkles className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">AppÓtica</h1>
          <p className="text-gray-500 text-sm mt-2">
            {isSignUp ? 'Crie sua conta e sua loja' : 'Entre com suas credenciais'}
          </p>
        </div>

        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isSignUp ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isSignUp ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Criar Conta
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-950"
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nome da Ótica</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-950"
                    placeholder="Ex: Minha Ótica (opcional)"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Se vazio, será criado automaticamente</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                required
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-950"
                placeholder="exemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                required
                minLength={6}
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-950"
                placeholder="Min. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              isSignUp ? 'Criar Conta e Loja' : 'Entrar'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          {isSignUp ? 'Já tem uma conta?' : 'Não tem conta?'}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-gray-900 font-bold hover:underline"
          >
            {isSignUp ? 'Entrar' : 'Criar conta agora'}
          </button>
        </p>
      </div>
    </div>
  );
}
