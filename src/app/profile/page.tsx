'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Loader2, Save, ArrowLeft, Shield, Store, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopId, setShopId] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      setEmail(session.user.email || '');

      const { data } = await supabase
        .from('profiles')
        .select('full_name, shop_id, shops(id, name)')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setFullName(data.full_name || '');
        setShopName(data.shops?.name || '');
        setShopId(data.shop_id || '');
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleUpdateProfile() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setSuccess('Perfil atualizado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEmail() {
    if (!newEmail.trim() || newEmail === email) {
      setError('Digite um novo e-mail diferente do atual.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
      if (emailError) throw emailError;

      setSuccess('E-mail de confirmação enviado para o novo endereço. Confirme para concluir.');
      setNewEmail('');
    } catch (err: any) {
      let msg = err.message || 'Erro ao atualizar e-mail.';
      if (msg.includes('rate limit')) {
        msg = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePassword() {
    if (!newPassword || !confirmPassword) {
      setError('Preencha a nova senha e a confirmação.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) throw pwError;

      setSuccess('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar senha.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-2xl mx-auto p-4 md:p-6 lg:p-8 pb-24">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl ml-14 md:ml-0 p-5 md:p-6 mb-6 text-white">
          <div className="flex items-center gap-3">
            <Link href="/" className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Minha Conta</p>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Meu Perfil</h1>
            </div>
          </div>
        </div>

        {/* MENSAGENS */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-sm text-red-700 font-medium flex items-center gap-2">
            <span className="shrink-0 w-2 h-2 bg-red-500 rounded-full" />
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 text-sm text-green-700 font-medium flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0 text-green-500" />
            {success}
          </div>
        )}

        {/* PERFIL */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 md:p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-gray-100 p-2.5 rounded-xl">
              <User size={20} className="text-gray-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Dados Pessoais</h2>
              <p className="text-xs text-gray-400">Nome e informações da conta</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nome Completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-950"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-400 mt-1">E-mail de login da conta</p>
            </div>

            {shopName && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Loja</label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <Store size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 font-medium">{shopName}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleUpdateProfile}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salvar Alterações
            </button>
          </div>
        </div>

        {/* TROCAR E-MAIL */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 md:p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-blue-100 p-2.5 rounded-xl">
              <Mail size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Alterar E-mail</h2>
              <p className="text-xs text-gray-400">Um link de confirmação será enviado</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Novo E-mail</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="novo@email.com"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-950"
              />
            </div>

            <button
              onClick={handleUpdateEmail}
              disabled={saving || !newEmail.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
              Atualizar E-mail
            </button>
          </div>
        </div>

        {/* TROCAR SENHA */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 md:p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-amber-100 p-2.5 rounded-xl">
              <Lock size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Alterar Senha</h2>
              <p className="text-xs text-gray-400">Escolha uma nova senha segura</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nova Senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 caracteres"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-gray-950"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Confirmar Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-gray-950"
              />
            </div>

            <button
              onClick={handleUpdatePassword}
              disabled={saving || !newPassword || !confirmPassword}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />}
              Alterar Senha
            </button>
          </div>
        </div>

        {/* SEGURANCA */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-100 p-2.5 rounded-xl">
              <Shield size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Segurança</h2>
              <p className="text-xs text-gray-400">Informações da sua conta</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">E-mail</span>
              <span className="font-medium text-gray-800">{email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Conta criada em</span>
              <span className="font-medium text-gray-800">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Último login</span>
              <span className="font-medium text-gray-800">
                {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : '—'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
