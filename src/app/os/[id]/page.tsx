'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { formatCurrency, companyInfo } from '@/lib/format';
import { Printer, ArrowLeft, FileText, User, Calendar, Package, Trash2, CheckCircle, Clock, DollarSign, ChevronDown, Pencil, MessageSquare } from 'lucide-react';
import Link from 'next/link';

function getLocalDate(date?: Date): string {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

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
  const router = useRouter();
  const [osData, setOsData] = useState<any>(null);
  const [financialRecords, setFinancialRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageTitle, setMessageTitle] = useState('');
  const [messageStage, setMessageStage] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

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
      alert('Erro ao carregar detalhes da Ordem de Servico.');
    } finally {
      setLoading(false);
    }
  }

  function renderMessageVars(msg: string): string {
    if (!osData) return msg;
    const frame = osData.notes?.split('\n')[0]?.replace('Armação: ', '') || 'Produto';
    const val = formatCurrency(osData.total_value || 0);
    const prazo = osData.scheduled_date
      ? new Date(osData.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')
      : 'a definir';
    return msg
      .replace(/\{cliente\}/g, osData.customers?.name || 'Cliente')
      .replace(/\{numero\}/g, osData.os_number || osData.id.slice(0, 8))
      .replace(/\{produto\}/g, frame)
      .replace(/\{valor\}/g, val)
      .replace(/\{prazo\}/g, prazo)
      .replace(/\{loja\}/g, companyInfo.nomeFantasia);
  }

  async function handleChangeStatus(newStatus: string) {
    if (!osData) return;
    if (newStatus === osData.status) { setShowStatusMenu(false); return; }

    const pendingEntry = financialRecords.find(
      (r: any) => r.status === 'Pending' && r.type === 'Income' && r.description.includes('(Entrada)')
    );
    if (newStatus === 'Delivered' && pendingEntry) {
      const receiveNow = confirm('Deseja receber a entrada agora?');
      if (receiveNow) {
        await supabase
          .from('financial_records')
          .update({ status: 'Paid', payment_date: getLocalDate() })
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

      const statusToStage: Record<string, string> = {
        'Open': 'created',
        'In_Laboratory': 'preparing',
        'Ready': 'ready',
        'Delivered': 'delivered',
      };
      const stage = statusToStage[newStatus];
      if (stage) {
        const { data: template } = await supabase
          .from('message_templates')
          .select('*')
          .eq('stage', stage)
          .eq('active', true)
          .single();

        if (template) {
          const phone = osData.customers?.phone || '';
          setCustomerPhone(phone);
          setMessageStage(stage);
          setMessageTitle(template.title);
          setMessageText(renderMessageVars(template.message));
          setShowMessageModal(true);
        }
      }
    } else {
      alert('Erro ao atualizar status: ' + error.message);
    }
    setUpdatingStatus(false);
    setShowStatusMenu(false);
  }

  function handleSendWhatsApp() {
    const phone = customerPhone.replace(/\D/g, '');
    const msg = encodeURIComponent(messageText);
    window.open('https://wa.me/55' + phone + '?text=' + msg, '_blank');
  }

  async function handleReceiveEntry(recordId: string) {
    if (!confirm('Receber esta entrada?')) return;
    const { error } = await supabase
      .from('financial_records')
      .update({ status: 'Paid', payment_date: getLocalDate() })
      .eq('id', recordId);

    if (!error) {
      fetchOSDetails();
    } else {
      alert('Erro ao receber: ' + error.message);
    }
  }

  async function handleDeleteOS() {
    if (!confirm('ATENCAO: Esta acao excluirá a Ordem de Servico e TODOS os lancamentos financeiros vinculados a ela. Deseja realmente excluir?')) return;

    try {
      const { error } = await supabase
        .from('service_orders')
        .delete()
        .eq('id', osId);

      if (error) throw error;

      alert('Ordem de Servico e registros financeiros excluidos com sucesso.');
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
        <h1 className="text-xl font-bold text-red-600">O.S. nao encontrada.</h1>
        <Link href="/os" className="text-blue-600 underline mt-4 block">Voltar para a lista</Link>
      </div>
    );
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === osData.status) || STATUS_OPTIONS[0];
  const pendingEntry = financialRecords.find((r: any) => r.status === 'Pending' && r.type === 'Income' && r.description.includes('(Entrada)'));
  const incomeRecords = financialRecords.filter((r: any) => r.type === 'Income' && !r.description.startsWith('Taxa'));
  const totalIncome = incomeRecords.reduce((acc: number, r: any) => acc + (r.status === 'Paid' ? r.amount : 0), 0);
  const totalPending = incomeRecords.reduce((acc: number, r: any) => acc + (r.status === 'Pending' ? r.amount : 0), 0);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <Link href="/os" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium text-sm">
            <ArrowLeft size={18} /> Voltar para O.S.
          </Link>
          <div className="flex gap-2">
            <button onClick={() => router.push('/sales?edit=' + osId)} className="bg-white text-blue-600 px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-blue-50 transition-all font-bold border border-blue-100 text-xs shadow-sm">
              <Pencil size={14} /> Editar
            </button>
            <button onClick={handlePrint} className="bg-gray-900 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-gray-800 transition-all font-bold text-xs shadow-sm">
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={handleDeleteOS} className="bg-white text-red-600 px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-red-50 transition-all font-bold border border-red-100 text-xs shadow-sm">
              <Trash2 size={14} /> Excluir
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gray-900 text-white p-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight">Ordem de Servico</h1>
                <p className="text-gray-400 text-sm font-mono">{osData.os_number ? 'No ' + osData.os_number : '# ' + osData.id.slice(0, 8)}</p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className={'px-3 py-1.5 rounded-full text-xs font-bold uppercase flex items-center gap-1.5 ' + currentStatus.color + ' hover:opacity-80 transition-opacity'}
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
                        className={'w-full text-left px-4 py-2.5 text-xs font-bold uppercase flex items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50 ' + (osData.status === opt.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700')}
                      >
                        <span className={'w-2 h-2 rounded-full ' + opt.color.split(' ')[0]} />
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
                  <p className="font-bold text-gray-800">{osData.customers?.name || 'Nao informado'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Telefone/WhatsApp</p>
                  <p className="font-bold text-gray-800">{osData.customers?.phone || 'Nao informado'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CPF</p>
                  <p className="font-bold text-gray-800">{osData.customers?.cpf || 'Nao informado'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Previsao de Entrega</p>
                  <p className="font-bold text-blue-600">{osData.scheduled_date ? new Date(osData.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Nao definida'}</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
                <FileText size={16} /> Prescricao Optica
              </h2>
              {osData.prescription ? (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-2 font-bold text-gray-600">Olho</th>
                        <th className="py-2 font-bold text-gray-600">Esferico</th>
                        <th className="py-2 font-bold text-gray-600">Cilindrico</th>
                        <th className="py-2 font-bold text-gray-600">Eixo</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 font-bold text-gray-800">OD</td>
                        <td className="py-3">{osData.prescription.od_sphere || '0.00'}</td>
                        <td className="py-3">{osData.prescription.od_cylinder || '0.00'}</td>
                        <td className="py-3">{osData.prescription.od_axis || '0'}</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-bold text-gray-800">OE</td>
                        <td className="py-3">{osData.prescription.oe_sphere || '0.00'}</td>
                        <td className="py-3">{osData.prescription.oe_cylinder || '0.00'}</td>
                        <td className="py-3">{osData.prescription.oe_axis || '0'}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500">Adicao</p>
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
                <Package size={16} /> Especificacoes de Laboratorio
              </h2>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Armacao</p>
                    <p className="font-bold text-gray-800">{osData.notes?.split('\n')[0]?.replace('Armacao: ', '') || 'Nao informado'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Lentes</p>
                    <p className="font-bold text-gray-800">{osData.notes?.split('\n')[1]?.replace('Lente: ', '') || 'Nao informado'}</p>
                  </div>
                </div>
                {(osData.frame_width || osData.bridge_rim || osData.major_angle || osData.dp_os || osData.altura) && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Medicoes da Armacao</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {osData.frame_width != null && (
                        <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 uppercase">Des. Arm.</p>
                          <p className="font-bold text-gray-800">{osData.frame_width} mm</p>
                        </div>
                      )}
                      {osData.bridge_rim != null && (
                        <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 uppercase">Ponte + Aro</p>
                          <p className="font-bold text-gray-800">{osData.bridge_rim} mm</p>
                        </div>
                      )}
                      {osData.major_angle != null && (
                        <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 uppercase">Ang. Maior</p>
                          <p className="font-bold text-gray-800">{osData.major_angle}</p>
                        </div>
                      )}
                      {osData.dp_os != null && (
                        <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 uppercase">D.P.</p>
                          <p className="font-bold text-gray-800">{osData.dp_os} mm</p>
                        </div>
                      )}
                      {osData.altura != null && (
                        <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 uppercase">C.O.</p>
                          <p className="font-bold text-gray-800">{osData.altura} mm</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Observacoes Adicionais</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded-xl border border-gray-200 mt-1">
                    {osData.notes?.split('\n')[2]?.replace('Observacoes: ', '') || 'Nenhuma observacao.'}
                  </p>
                </div>
              </div>
            </section>

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
                    {financialRecords.map((rec: any) => (
                      <div key={rec.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={'p-1.5 rounded-full flex-shrink-0 ' + (rec.type === 'Income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>
                            <DollarSign size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{rec.description}</p>
                            <p className="text-[10px] text-gray-400">Vence: {new Date(rec.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <p className={'font-bold text-sm ' + (rec.type === 'Income' ? 'text-green-600' : 'text-red-600')}>
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

        <div style={{ display: 'none' }}>
          <div ref={printAreaRef} className="p-8 text-black font-mono text-sm bg-white w-[80mm]">
            <div className="text-center border-b-2 border-black pb-4 mb-4">
              <h3 className="font-bold text-lg uppercase">ORDEM DE SERVICO - LAB</h3>
              <p className="text-xs">{'OS ' + (osData.os_number || osData.id.slice(0,8)) + ' | Data: ' + new Date().toLocaleDateString('pt-BR')}</p>
              <p className="font-bold text-xs mt-2 text-red-600 uppercase">Entrega: {osData.scheduled_date ? new Date(osData.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}</p>
            </div>
            <div className="mb-4 space-y-1">
              <p className="font-bold text-xs uppercase border-b">Cliente</p>
              <p><strong>Nome:</strong> {osData.customers?.name}</p>
              <p><strong>CPF:</strong> {osData.customers?.cpf}</p>
              <p><strong>Tel:</strong> {osData.customers?.phone}</p>
            </div>
            {osData.prescription && (
              <div className="mb-4 space-y-1">
                <p className="font-bold text-xs uppercase border-b">Prescricao</p>
                <div className="grid grid-cols-4 text-center border border-black">
                  <div className="border-r border-black p-1 font-bold">Olho</div>
                  <div className="border-r border-black p-1 font-bold">Sph</div>
                  <div className="border-r border-black p-1 font-bold">Cyl</div>
                  <div className="p-1 font-bold">Eixo</div>
                  <div className="border-t border-black p-1">OD</div>
                  <div className="border-t border-r border-black p-1">{osData.prescription.od_sphere || '0'}</div>
                  <div className="border-t border-r border-black p-1">{osData.prescription.od_cylinder || '0'}</div>
                  <div className="border-t border-black p-1">{osData.prescription.od_axis || '0'}</div>
                  <div className="border-t p-1">OE</div>
                  <div className="border-t border-r border-black p-1">{osData.prescription.oe_sphere || '0'}</div>
                  <div className="border-t border-r border-black p-1">{osData.prescription.oe_cylinder || '0'}</div>
                  <div className="border-t border-black p-1">{osData.prescription.oe_axis || '0'}</div>
                </div>
                <div className="flex justify-between mt-1 text-xs">
                  <span><strong>ADD:</strong> {osData.prescription.addition || '---'}</span>
                  <span><strong>DP:</strong> {osData.prescription.dp || '---'}mm</span>
                </div>
              </div>
            )}
            <div className="mb-4 space-y-1">
              <p className="font-bold text-xs uppercase border-b">Especificacoes</p>
              <p><strong>Armacao:</strong> {osData.notes?.split('\n')[0]?.replace('Armacao: ', '') || '---'}</p>
              <p><strong>Lentes:</strong> {osData.notes?.split('\n')[1]?.replace('Lente: ', '') || '---'}</p>
              {(osData.frame_width != null || osData.bridge_rim != null || osData.major_angle != null || osData.dp_os != null || osData.altura != null) && (
                <div className="grid grid-cols-3 text-center border border-black mt-2">
                  <div className="border-r border-b border-black p-0.5 font-bold text-[9px]">Des.Arm.</div>
                  <div className="border-r border-b border-black p-0.5 font-bold text-[9px]">Ponte+Aro</div>
                  <div className="border-b border-black p-0.5 font-bold text-[9px]">Ang.Maior</div>
                  <div className="border-r border-black p-0.5 text-[9px]">{osData.frame_width != null ? osData.frame_width + 'mm' : '---'}</div>
                  <div className="border-r border-black p-0.5 text-[9px]">{osData.bridge_rim != null ? osData.bridge_rim + 'mm' : '---'}</div>
                  <div className="p-0.5 text-[9px]">{osData.major_angle != null ? osData.major_angle + '' : '---'}</div>
                  <div className="border-r border-t border-black p-0.5 font-bold text-[9px]">D.P.</div>
                  <div className="border-t border-black p-0.5 font-bold text-[9px]">C.O.</div>
                  <div></div>
                  <div className="border-r border-black p-0.5 text-[9px]">{osData.dp_os != null ? osData.dp_os + 'mm' : '---'}</div>
                  <div className="p-0.5 text-[9px]">{osData.altura != null ? osData.altura + 'mm' : '---'}</div>
                  <div></div>
                </div>
              )}
              <p><strong>Obs:</strong> {osData.notes?.split('\n')[2]?.replace('Observacoes: ', '') || '---'}</p>
            </div>
            <div className="text-center text-[10px] mt-10 border-t pt-2 space-y-0.5">
              <p className="font-bold">{companyInfo.nomeFantasia}</p>
              <p>{companyInfo.razaoSocial} | CNPJ: {companyInfo.cnpj}</p>
              <p>{companyInfo.enderecoCompleto}</p>
              <p className="mt-2">Impresso via AppOtica - Sistema de Gestao</p>
            </div>
          </div>
        </div>

      </div>

      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 p-2.5 rounded-xl">
                <MessageSquare size={20} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{messageTitle}</h3>
                <p className="text-xs text-gray-400">Mensagem para o cliente</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Mensagem</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={6}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-gray-950 text-sm leading-relaxed resize-none"
              />
            </div>
            {customerPhone && (
              <p className="text-xs text-gray-400 mb-4">
                Enviar para: <span className="font-medium text-gray-600">{customerPhone}</span>
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowMessageModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Pular
              </button>
              <button
                onClick={handleSendWhatsApp}
                disabled={!customerPhone}
                className="flex-1 py-2.5 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Enviar WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
