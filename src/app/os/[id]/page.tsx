'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { formatCurrency, companyInfo } from '@/lib/format';
import { Printer, ArrowLeft, FileText, User, Calendar, Package, Trash2, CheckCircle, Clock, DollarSign, ChevronDown } from 'lucide-react';
import Link from 'next/link';

const STATUS_OPTIONS = [
  { value: 'Open', label: 'Aberto', color: 'bg-gray-100 text-gray-600' },
  { value: 'In_Laboratory', label: 'Laboratório', color: 'bg-blue-100 text-blue-600' },
  { value: 'Ready', label: 'Pronto', color: 'bg-yellow-100 text-yellow-600' },
  { value: 'Delivered', label: 'Entregue', color: 'bg-green-100 text-green-600' },
  { value: 'Cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-600' },
];

export default function OSDetailPage() {
  const params = useParams();
  const osId = params.id as string;
  const [osData, setOsData] = useState<any>(null);
  const [financialRecords, setFinancialRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
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

      const { data: finData } = await supabase
        .from('financial_records')
        .select('*')
        .eq('order_id', osId)
        .order('due_date', { ascending: true });

      setOsData({ ...osDataResult, prescription });
      setFinancialRecords(finData || []);
    } catch (error: any) {
      console.error('Erro ao carregar O.S:', error);
      alert('Erro ao carregar detalhes da Ordem de Serviço.');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeStatus(newStatus: string) {
    if (newStatus === osData.status) { setShowStatusMenu(false); return; }

    // Se for marcar como Entregue e tiver entrada pendente, pergunta
    const pendingEntry = financialRecords.find(
      r => r.status === 'Pending' && r.type === 'Income' && r.description.includes('(Entrada)')
    );
    if (newStatus === 'Delivered' && pendingEntry) {
      const receiveNow = confirm('Deseja receber a entrada agora?');
      if (receiveNow) {
        await supabase
          .from('financial_records')
          .update({ status: 'Paid', payment_date: new Date().toISOString().split('T')[0] })
          .eq('id', pendingEntry.id);
      }
    }

    setUpdatingStatus(true);
    const { error } = await supabase
      .from('service_orders')
      .update({ status: newStatus })
      .eq('id', osId);

    if (!error) {
      setOsData((prev: any) => ({ ...prev, status: newStatus }));
      fetchOSDetails();
    } else {
      alert('Erro ao atualizar status: ' + error.message);
    }
    setUpdatingStatus(false);
    setShowStatusMenu(false);
  }

  async function handleReceiveEntry(recordId: string) {
    if (!confirm('Receber esta entrada?')) return;
    const { error } = await supabase
      .from('financial_records')
      .update({ status: 'Paid', payment_date: new Date().toISOString().split('T')[0] })
      .eq('id', recordId);

    if (!error) {
      fetchOSDetails();
    } else {
      alert('Erro ao receber: ' + error.message);
    }
  }

  async function handleDeleteOS() {
    if (!confirm('ATENÇÃO: Esta ação excluirá a Ordem de Serviço e TODOS os lançamentos financeiros vinculados a ela. Deseja realmente excluir?')) return;

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

  const currentStatus = STATUS_OPTIONS.find(s => s.value === osData.status) || STATUS_OPTIONS[0];
  const pendingEntry = financialRecords.find(r => r.status === 'Pending' && r.type === 'Income' && r.description.includes('(Entrada)'));
  const entryRecord = financialRecords.find(r => r.type === 'Income' && r.description.includes('(Entrada)'));
  const feeRecords = financialRecords.filter(r => r.description.startsWith('Taxa'));
  const incomeRecords = financialRecords.filter(r => r.type === 'Income' && !r.description.startsWith('Taxa'));
  const totalIncome = incomeRecords.reduce((acc, r) => acc + (r.status === 'Paid' ? r.amount : 0), 0);
  const totalPending = incomeRecords.reduce((acc, r) => acc + (r.status === 'Pending' ? r.amount : 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <Link href="/os" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium">
          <ArrowLeft size={20} /> Voltar para O.S.
        </Link>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-100 font-bold">
            <Printer size={18} /> Imprimir O.S.
          </button>
          <button onClick={handleDeleteOS} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-red-100 transition-all font-bold border border-red-100">
            <Trash2 size={18} /> Excluir
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gray-900 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Ordem de Serviço</h1>
              <p className="text-gray-400 text-sm font-mono">{osData.os_number ? `Nº ${osData.os_number}` : `# ${osData.id.slice(0, 8)}`}</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase flex items-center gap-1.5 ${currentStatus.color} hover:opacity-80 transition-opacity`}
              >
                {currentStatus.label}
                <ChevronDown size={14} />
              </button>
              {showStatusMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[160px] overflow-hidden">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      disabled={updatingStatus}
                      onClick={() => handleChangeStatus(opt.value)}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase flex items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50 ${osData.status === opt.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${opt.color.split(' ')[0]}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
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

          {/* SEÇÃO FINANCEIRA */}
          {financialRecords.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
                <DollarSign size={16} /> Financeiro
              </h2>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                    <p className="text-[10px] font-bold text-green-600 uppercase">Recebido</p>
                    <p className="text-lg font-black text-green-700">{formatCurrency(totalIncome)}</p>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                    <p className="text-[10px] font-bold text-yellow-600 uppercase">A Receber</p>
                    <p className="text-lg font-black text-yellow-700">{formatCurrency(totalPending)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {financialRecords.map((rec) => (
                    <div key={rec.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-full flex-shrink-0 ${rec.type === 'Income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          <DollarSign size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{rec.description}</p>
                          <p className="text-[10px] text-gray-400">Vence: {new Date(rec.due_date).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <p className={`font-bold text-sm ${rec.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                          {rec.type === 'Income' ? '' : '-'}{formatCurrency(rec.amount)}
                        </p>
                        {rec.status === 'Paid' ? (
                          <span className="text-[10px] font-bold uppercase text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Pago</span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">Pendente</span>
                        )}
                        {rec.status === 'Pending' && rec.type === 'Income' && rec.description.includes('(Entrada)') && (
                          <button
                            onClick={() => handleReceiveEntry(rec.id)}
                            className="text-green-500 hover:text-green-700 p-1 rounded-lg hover:bg-green-50 transition-colors"
                            title="Receber entrada"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ÁREA DE IMPRESSÃO */}
      <div style={{ display: 'none' }}>
        <div ref={printAreaRef} className="p-8 text-black font-mono text-sm bg-white w-[80mm]">
          <div className="text-center border-b-2 border-black pb-4 mb-4">
            <h3 className="font-bold text-lg uppercase">ORDEM DE SERVIÇO - LAB</h3>
            <p className="text-xs">{osData.os_number ? `OS Nº ${osData.os_number}` : `OS: #${osData.id.slice(0,8)}`} | Data: {new Date().toLocaleDateString('pt-BR')}</p>
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
