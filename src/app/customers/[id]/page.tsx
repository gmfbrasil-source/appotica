'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, MessageCircle, Calendar, DollarSign, AlertCircle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customerId) {
      loadCustomerData();
    }
  }, [customerId]);

  async function loadCustomerData() {
    setLoading(true);
    try {
      // 1. Busca dados do cliente
      const { data: customerData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (custErr) throw custErr;
      setCustomer(customerData);

      // 2. Busca histórico de ordens de serviço
      const { data: ordersData, error: ordersErr } = await supabase
        .from('service_orders')
        .select('*, customers(name)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (ordersErr) throw ordersErr;
      setOrders(ordersData || []);

      // 3. Busca histórico financeiro
      const { data: finData, error: finErr } = await supabase
        .from('financial_records')
        .select('*')
        .eq('customer_id', customerId)
        .order('due_date', { ascending: true });

      if (finErr) throw finErr;
      setFinancials(finData || []);

    } catch (error: any) {
      console.error('Erro ao carregar dados do cliente:', error);
      alert('Erro ao carregar dados do cliente.');
    } finally {
      setLoading(false);
    }
  }

  const totalPaid = (financials || []).reduce((acc, curr) => {
    return acc + (curr?.status === 'Paid' ? (Number(curr?.amount) || 0) : 0);
  }, 0);

  const totalPending = (financials || []).reduce((acc, curr) => {
    return acc + (curr?.status === 'Pending' ? (Number(curr?.amount) || 0) : 0);
  }, 0);

  const overdueRecords = (financials || []).filter(f => {
    if (!f || !f.due_date) return false;
    try {
      const dueDate = new Date(f.due_date);
      const today = new Date();
      return f.status === 'Pending' && dueDate < today;
    } catch {
      return false;
    }
  });

  function sendWhatsAppReminder() {
    if (!customer?.phone) {
      alert('Este cliente não possui telefone cadastrado.');
      return;
    }

    const phone = String(customer.phone).replace(/\D/g, '');
    const message = `Olá ${customer.name}, tudo bem? Aqui é da Ótica. Notamos que você possui parcelas em aberto no valor de R$ ${totalPending.toFixed(2)}. Podemos te ajudar a regularizar?`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold text-red-600">Cliente não encontrado.</h1>
        <Link href="/customers" className="text-blue-600 underline mt-4 block">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <Link 
          href="/customers" 
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium"
        >
          <ArrowLeft size={20} /> Voltar para Clientes
        </Link>
      </div>

      {/* Cabeçalho do Cliente */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-4 rounded-2xl text-blue-600">
            <User size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <p className="text-gray-500 text-sm">{customer.email || 'Sem e-mail cadastrado'}</p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          {customer?.phone && (
            <button 
              onClick={() => {
                const phone = String(customer.phone).replace(/\D/g, '');
                window.open(`https://wa.me/${phone}`, '_blank');
              }}
              className="flex-1 md:flex-none bg-green-500 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 transition-all font-bold shadow-sm"
            >
              <MessageCircle size={18} /> WhatsApp
            </button>
          )}
          {overdueRecords && overdueRecords.length > 0 && (
            <button 
              onClick={sendWhatsAppReminder}
              className="flex-1 md:flex-none bg-red-500 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-red-600 transition-all font-bold shadow-sm"
            >
              <AlertCircle size={18} /> Cobrar Atrasos
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna Dados & Financeiro */}
        <div className="lg:col-span-1 space-y-6">
          {/* Dados Cadastrais */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Dados Cadastrais</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">CPF</p>
                <p className="text-gray-800 font-medium">{customer.cpf || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Telefone</p>
                <p className="text-gray-800 font-medium">{customer.phone || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Endereço</p>
                <p className="text-gray-800 font-medium">{customer.address || 'Não informado'}</p>
              </div>
            </div>
          </div>

          {/* Resumo Financeiro */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Resumo Financeiro</h2>
            <div className="grid grid-cols-1 gap-3">
              <div className="p-3 bg-green-50 rounded-2xl border border-green-100 flex justify-between items-center">
                <span className="text-green-700 text-sm font-medium">Total Pago</span>
                <span className="text-green-700 font-bold">R$ {totalPaid.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 flex justify-between items-center">
                <span className="text-amber-700 text-sm font-medium">A Receber</span>
                <span className="text-amber-700 font-bold">R$ {totalPending.toFixed(2)}</span>
              </div>
              {overdueRecords.length > 0 && (
                <div className="p-3 bg-red-50 rounded-2xl border border-red-100 flex justify-between items-center">
                  <span className="text-red-700 text-sm font-medium">Em Atraso</span>
                  <span className="text-red-700 font-bold">
                    R$ {overdueRecords.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Histórico */}
        <div className="lg:col-span-2 space-y-8">
          {/* Histórico de Compras */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <ShoppingBag size={20} className="text-blue-600" /> Histórico de Compras
            </h2>
            <div className="space-y-3">
              {orders.length > 0 ? orders.map((order) => (
                <Link 
                  key={order.id} 
                  href={`/os/${order.id}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">O.S. #{order.id.slice(0,8)}</p>
                      <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">R$ {order.total_value?.toFixed(2)}</p>
                    <p className={`text-[10px] font-bold uppercase ${
                      order.status === 'Delivered' ? 'text-green-500' : 'text-blue-500'
                    }`}>
                      {order.status.replace('_', ' ')}
                    </p>
                  </div>
                </Link>
              )) : (
                <p className="text-center text-gray-500 py-4">Nenhuma compra realizada.</p>
              )}
            </div>
          </div>

          {/* Detalhes Financeiros (Parcelas) */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign size={20} className="text-blue-600" /> Detalhes Financeiros
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-medium">
                    <th className="py-3 px-2">Descrição</th>
                    <th className="py-3 px-2">Vencimento</th>
                    <th className="py-3 px-2">Valor</th>
                    <th className="py-3 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {financials.length > 0 ? financials.map((fin) => (
                    <tr key={fin.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-2 font-medium text-gray-800">{fin.description}</td>
                      <td className="py-3 px-2 text-gray-500">{fin?.due_date ? new Date(fin.due_date).toLocaleDateString('pt-BR') : '---'}</td>
                      <td className="py-3 px-2 font-bold">R$ {(fin?.amount || 0).toFixed(2)}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          fin.status === 'Paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {fin.status === 'Paid' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-gray-500 italic">Nenhum registro financeiro encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
