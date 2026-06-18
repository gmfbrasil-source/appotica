'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { formatCurrency, companyInfo } from '@/lib/format';
import { Printer, ArrowLeft, FileText, User, Calendar, Package, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function OSDetailPage() {
  const params = useParams();
  const osId = params.id as string;
  const [osData, setOsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (osId) fetchOSDetails();
  }, [osId]);

  async function fetchOSDetails() {
    setLoading(true);
    try {
      const { data: osDataResult, error: osError } = await supabase
        .from('service_orders')
        .select('*, customers(*)')
        .eq('id', osId)
        .single();

      if (osError) throw osError;

      const customerId = osDataResult.customers?.id || osDataResult.customer_id;
      
      const { data: prescription, error: prescError } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (prescError && prescError.code !== 'PGRST116') { 
        console.warn('Erro ao buscar receita:', prescError.message);
      }

      setOsData({ ...osDataResult, prescription });
    } catch (error: any) {
      console.error('Erro ao carregar O.S:', error);
      alert('Erro ao carregar detalhes da Ordem de Serviço.');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    const printContent = printAreaRef.current?.innerHTML;
    const originalContent = document.body.innerHTML;

    if (printContent) {
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
  }

  async function handleDeleteOS() {
    if (!confirm('ATENÇÃO: Esta ação excluirá a Ordem de Serviço e TODOS os lançamentos financeiros vinculados a ela. Deseja realmente excluir?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('service_orders')
        .delete()
        .eq('id', osId);

      if (error) throw error;

      alert('Ordem de Serviço e registros financeiros excluídos com sucesso.');
      window.location.href = '/os';
    } catch (error: any) {
      alert('Erro ao excluir: ' + error.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!osData) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold text-red-600">O.S. não encontrada.</h1>
        <Link href="/os" className="text-blue-600 underline mt-4 block">Voltar para a lista</Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-24">
        <div className="flex items-center justify-between mb-6">
          <Link 
            href="/os" 
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium"
          >
            <ArrowLeft size={20} /> Voltar para O.S.
          </Link>
          <div className="flex gap-3">
            <button 
              onClick={handlePrint}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-100 font-bold"
            >
              <Printer size={18} /> Imprimir O.S.
            </button>
            <button 
              onClick={handleDeleteOS}
              className="bg-red-50 text-red-600 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-red-100 transition-all font-bold border border-red-100"
            >
              <Trash2 size={18} /> Excluir
            </button>
          </div>
        </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gray-900 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Ordem de Serviço</h1>
              <p className="text-gray-400 text-sm font-mono"># {osData.id.slice(0, 8)}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              osData.status === 'Ready' ? 'bg-yellow-500 text-white' : 
              osData.status === 'Delivered' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
            }`}>
              {osData.status.replace('_', ' ')}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
              <User size={16} /> Dados do Cliente
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Nome Completo</p>
                <p className="font-bold text-gray-800">{osData.customers?.name || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Telefone/WhatsApp</p>
                <p className="font-bold text-gray-800">{osData.customers?.phone || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">CPF</p>
                <p className="font-bold text-gray-800">{osData.customers?.cpf || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Previsão de Entrega</p>
                <p className="font-bold text-blue-600">{osData.scheduled_date ? new Date(osData.scheduled_date).toLocaleDateString('pt-BR') : 'Não definida'}</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
              <FileText size={16} /> Prescrição Óptica
            </h2>
            {osData.prescription ? (
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 font-bold text-gray-600">Olho</th>
                      <th className="py-2 font-bold text-gray-600">Esférico</th>
                      <th className="py-2 font-bold text-gray-600">Cilíndrico</th>
                      <th className="py-2 font-bold text-gray-600">Eixo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 font-bold text-gray-800">OD</td>
                      <td className="py-3">{osData.prescription.od_sphere || '0.00'}</td>
                      <td className="py-3">{osData.prescription.od_cylinder || '0.00'}</td>
                      <td className="py-3">{osData.prescription.od_axis || '0'}°</td>
                    </tr>
                    <tr>
                      <td className="py-3 font-bold text-gray-800">OE</td>
                      <td className="py-3">{osData.prescription.oe_sphere || '0.00'}</td>
                      <td className="py-3">{osData.prescription.oe_cylinder || '0.00'}</td>
                      <td className="py-3">{osData.prescription.oe_axis || '0'}°</td>
                    </tr>
                  </tbody>
                </table>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">Adição</p>
                    <p className="font-bold text-gray-800">{osData.prescription.addition || '---'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">D.P.</p>
                    <p className="font-bold text-gray-800">{osData.prescription.dp || '---'} mm</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center text-gray-500 text-sm italic">
                Nenhuma receita vinculada a este cliente.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
              <Package size={16} /> Especificações de Laboratório
            </h2>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Armação</p>
                  <p className="font-bold text-gray-800">{osData.notes?.split('\n')[0]?.replace('Armação: ', '') || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Lentes</p>
                  <p className="font-bold text-gray-800">{osData.notes?.split('\n')[1]?.replace('Lente: ', '') || 'Não informado'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Observações Adicionais</p>
                <p className="text-sm text-gray-700 bg-white p-3 rounded-xl border border-gray-200 mt-1">
                  {osData.notes?.split('\n')[2]?.replace('Observações: ', '') || 'Nenhuma observação.'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div style={{ display: 'none' }}>
        <div ref={printAreaRef} className="p-8 text-black font-mono text-sm bg-white w-[80mm]">
          <div className="text-center border-b-2 border-black pb-4 mb-4">
            <h3 className="font-bold text-lg uppercase">ORDEM DE SERVIÇO - LAB</h3>
            <p className="text-xs">OS: #{osData.id.slice(0,8)} | Data: {new Date().toLocaleDateString('pt-BR')}</p>
            <p className="font-bold text-xs mt-2 text-red-600 uppercase">Entrega: {new Date(osData.scheduled_date).toLocaleDateString('pt-BR')}</p>
          </div>
          <div className="mb-4 space-y-1">
            <p className="font-bold text-xs uppercase border-b">Cliente</p>
            <p><strong>Nome:</strong> {osData.customers?.name}</p>
            <p><strong>CPF:</strong> {osData.customers?.cpf}</p>
            <p><strong>Tel:</strong> {osData.customers?.phone}</p>
          </div>
          {osData.prescription && (
            <div className="mb-4 space-y-1">
              <p className="font-bold text-xs uppercase border-b">Prescrição</p>
              <div className="grid grid-cols-4 text-center border border-black">
                <div className="border-r border-black p-1 font-bold">Olho</div>
                <div className="border-r border-black p-1 font-bold">Sph</div>
                <div className="border-r border-black p-1 font-bold">Cyl</div>
                <div className="p-1 font-bold">Eixo</div>
                <div className="border-t border-black p-1">OD</div>
                <div className="border-t border-r border-black p-1">{osData.prescription.od_sphere || '0'}</div>
                <div className="border-t border-r border-black p-1">{osData.prescription.od_cylinder || '0'}</div>
                <div className="border-t border-black p-1">{osData.prescription.od_axis || '0'}°</div>
                <div className="border-t p-1">OE</div>
                <div className="border-t border-r border-black p-1">{osData.prescription.oe_sphere || '0'}</div>
                <div className="border-t border-r border-black p-1">{osData.prescription.oe_cylinder || '0'}</div>
                <div className="border-t border-black p-1">{osData.prescription.oe_axis || '0'}°</div>
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span><strong>ADD:</strong> {osData.prescription.addition || '---'}</span>
                <span><strong>DP:</strong> {osData.prescription.dp || '---'}mm</span>
              </div>
            </div>
          )}
          <div className="mb-4 space-y-1">
            <p className="font-bold text-xs uppercase border-b">Especificações</p>
            <p><strong>Armação:</strong> {osData.notes?.split('\n')[0]?.replace('Armação: ', '') || '---'}</p>
            <p><strong>Lentes:</strong> {osData.notes?.split('\n')[1]?.replace('Lente: ', '') || '---'}</p>
            <p><strong>Obs:</strong> {osData.notes?.split('\n')[2]?.replace('Observações: ', '') || '---'}</p>
          </div>
          <div className="text-center text-[10px] mt-10 border-t pt-2 space-y-0.5">
            <p className="font-bold">{companyInfo.nomeFantasia}</p>
            <p>{companyInfo.razaoSocial} | CNPJ: {companyInfo.cnpj}</p>
            <p>{companyInfo.enderecoCompleto}</p>
            <p className="mt-2">Impresso via AppÓtica - Sistema de Gestão</p>
          </div>
        </div>
      </div>
    </div>
  );
}
