'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ShoppingBag, 
  UserPlus, 
  UserCheck, 
  Search, 
  Printer, 
  Check, 
  CreditCard, 
  Calendar, 
  FileText, 
  Plus, 
  Loader2, 
  Eye 
} from 'lucide-react';

export default function SalesPage() {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  
  // Modos de cliente
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Dados do novo cliente
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    cpf: '',
    email: '',
    address: ''
  });

  // Dados da Receita (Prescription)
  const [prescription, setPrescription] = useState({
    oe_sphere: '',
    oe_cylinder: '',
    oe_axis: '',
    od_sphere: '',
    od_cylinder: '',
    od_axis: '',
    addition: '',
    dp: '',
    notes: ''
  });

  // Detalhes da Venda e O.S.
  const [saleDetails, setSaleDetails] = useState({
    frame: '',
    lenses: '',
    total_value: '',
    scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias de prazo padrão
    notes: ''
  });

  // Dados de Pagamento / Financeiro
  const [payment, setPayment] = useState({
    method: 'Pix', // Pix, Cartao_Credito, Cartao_Debito, Dinheiro, Boleto
    installments: '1',
    status: 'Paid' // Paid, Pending
  });

  // Estado da venda realizada com sucesso (para modal de impressão)
  const [createdOS, setCreatedOS] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });
    if (!error) setCustomers(data || []);
  }

  // Auto-filtro dos clientes
  const filteredCustomers = customerSearch
    ? customers.filter(c => 
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.cpf && c.cpf.includes(customerSearch))
      )
    : [];

  async function handleCreateSale(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Obter o shop_id
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('shop_id')
        .single();

      if (profileErr || !profile?.shop_id) {
        throw new Error('Você não está vinculado a nenhuma ótica.');
      }

      const shopId = profile.shop_id;
      let finalCustomerId = selectedCustomerId;

      // 2. Cadastrar novo cliente, se aplicável
      if (isNewCustomer) {
        if (!newCustomer.name) throw new Error('O nome do cliente é obrigatório.');
        
        const { data: customerData, error: custErr } = await supabase
          .from('customers')
          .insert([{
            ...newCustomer,
            shop_id: shopId
          }])
          .select()
          .single();

        if (custErr) throw custErr;
        finalCustomerId = customerData.id;
      }

      if (!finalCustomerId) throw new Error('Selecione ou cadastre um cliente.');

      // 3. Cadastrar a Receita (Prescription), se algum dado foi preenchido
      const hasPrescriptionData = Object.values(prescription).some(val => val !== '');
      let finalPrescriptionId = null;

      if (hasPrescriptionData) {
        const parsedPrescription = {
          customer_id: finalCustomerId,
          shop_id: shopId,
          oe_sphere: prescription.oe_sphere ? parseFloat(prescription.oe_sphere) : null,
          oe_cylinder: prescription.oe_cylinder ? parseFloat(prescription.oe_cylinder) : null,
          oe_axis: prescription.oe_axis ? parseInt(prescription.oe_axis) : null,
          od_sphere: prescription.od_sphere ? parseFloat(prescription.od_sphere) : null,
          od_cylinder: prescription.od_cylinder ? parseFloat(prescription.od_cylinder) : null,
          od_axis: prescription.od_axis ? parseInt(prescription.od_axis) : null,
          addition: prescription.addition ? parseFloat(prescription.addition) : null,
          dp: prescription.dp ? parseFloat(prescription.dp) : null,
          notes: prescription.notes || null
        };

        const { data: prescData, error: prescErr } = await supabase
          .from('prescriptions')
          .insert([parsedPrescription])
          .select()
          .single();

        if (prescErr) throw prescErr;
        finalPrescriptionId = prescData.id;
      }

      // 4. Cadastrar Ordem de Serviço (O.S.)
      const totalVal = parseFloat(saleDetails.total_value);
      if (isNaN(totalVal)) throw new Error('Insira um valor total válido para a venda.');

      const notesOS = `Armação: ${saleDetails.frame || 'Não informada'}\nLente: ${saleDetails.lenses || 'Não informada'}\nObservações: ${saleDetails.notes || 'Nenhuma'}`;

      const { data: osData, error: osErr } = await supabase
        .from('service_orders')
        .insert([{
          customer_id: finalCustomerId,
          shop_id: shopId,
          status: 'In_Laboratory', // Direto para o laboratório
          total_value: totalVal,
          scheduled_date: saleDetails.scheduled_date,
          notes: notesOS
        }])
        .select('*, customers(name, phone, cpf)')
        .single();

      if (osErr) throw osErr;

      // 5. Cadastrar lançamentos financeiros no caixa
      const instCount = parseInt(payment.installments) || 1;
      const amountPerInstallment = totalVal / instCount;

      const financialInserts = [];
      const baseDate = new Date();

      for (let i = 0; i < instCount; i++) {
        const dueDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
        
        financialInserts.push({
          shop_id: shopId,
          type: 'Income',
          description: `Venda O.S. #${osData.id.slice(0,8)} ${instCount > 1 ? `(Parc. ${i+1}/${instCount})` : ''}`,
          amount: amountPerInstallment,
          due_date: dueDate.toISOString().split('T')[0],
          payment_date: payment.status === 'Paid' && i === 0 ? baseDate.toISOString().split('T')[0] : null,
          status: i === 0 ? payment.status : 'Pending', // Primeira parcela conforme status, as outras pendentes
          order_id: osData.id,
          customer_id: finalCustomerId
        });
      }

      const { error: finErr } = await supabase
        .from('financial_records')
        .insert(financialInserts);

      if (finErr) throw finErr;

      // Tudo deu certo! Definimos os dados para exibição do modal de impressão
      const clientName = isNewCustomer ? newCustomer.name : (customers.find(c => c.id === finalCustomerId)?.name || 'Cliente');
      setCreatedOS({
        id: osData.id,
        clientName,
        phone: isNewCustomer ? newCustomer.phone : (customers.find(c => c.id === finalCustomerId)?.phone || ''),
        cpf: isNewCustomer ? newCustomer.cpf : (customers.find(c => c.id === finalCustomerId)?.cpf || ''),
        frame: saleDetails.frame,
        lenses: saleDetails.lenses,
        scheduled_date: saleDetails.scheduled_date,
        total_value: totalVal,
        prescription: hasPrescriptionData ? prescription : null,
        notes: saleDetails.notes
      });

      setShowPrintModal(true);
      resetForm();
      fetchCustomers();
    } catch (err: any) {
      alert('Erro ao finalizar venda: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setIsNewCustomer(false);
    setSelectedCustomerId(null);
    setCustomerSearch('');
    setNewCustomer({ name: '', phone: '', cpf: '', email: '', address: '' });
    setPrescription({
      oe_sphere: '', oe_cylinder: '', oe_axis: '',
      od_sphere: '', od_cylinder: '', od_axis: '',
      addition: '', dp: '', notes: ''
    });
    setSaleDetails({
      frame: '',
      lenses: '',
      total_value: '',
      scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: ''
    });
    setPayment({ method: 'Pix', installments: '1', status: 'Paid' });
  }

  const printAreaRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const printContent = printAreaRef.current?.innerHTML;
    const originalContent = document.body.innerHTML;

    if (printContent) {
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload(); // Recarrega para voltar o estado normal do Next
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-24">
      <header className="mb-6 flex items-center gap-3">
        <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-md shadow-blue-100">
          <ShoppingBag size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Venda Completa</h1>
          <p className="text-sm text-gray-500">Cadastre cliente, crie a O.S. e lance no financeiro em um clique.</p>
        </div>
      </header>

      <form onSubmit={handleCreateSale} className="space-y-6">
        
        {/* SEÇÃO 1: CLIENTE */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <UserCheck size={20} className="text-blue-600" /> 1. Cliente
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsNewCustomer(!isNewCustomer);
                setSelectedCustomerId(null);
                setCustomerSearch('');
              }}
              className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              <UserPlus size={14} />
              {isNewCustomer ? 'Buscar Existente' : 'Novo Cliente'}
            </button>
          </div>

          {!isNewCustomer ? (
            /* Buscar Cliente Existente */
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Cliente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Comece a digitar o nome do cliente..."
                  className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-950"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomerId(null);
                    setShowCustomerSuggestions(true);
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                />
                {selectedCustomerId && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                )}
              </div>

              {/* Sugestões de Clientes */}
              {showCustomerSuggestions && filteredCustomers.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerSearch(c.name);
                        setShowCustomerSuggestions(false);
                      }}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 text-sm flex justify-between items-center"
                    >
                      <div>
                        <p className="font-semibold text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400">CPF: {c.cpf || 'Sem CPF'} | Cel: {c.phone || 'Sem celular'}</p>
                      </div>
                      {selectedCustomerId === c.id && <Check className="text-green-500" size={16} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Formulário Novo Cliente */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nome do cliente"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Celular / WhatsApp</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="(00) 00000-0000"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="000.000.000-00"
                  value={newCustomer.cpf}
                  onChange={(e) => setNewCustomer({...newCustomer, cpf: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Rua, número, bairro"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                />
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO 2: GRAU (PRESCRIÇÃO) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> 2. Receita / Grau do Cliente
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            {/* Olho Direito */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-gray-700 border-b pb-1 text-center sm:text-left">Olho Direito (OD)</h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase">Esférico</label>
                  <input type="text" placeholder="-2.00" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm text-center text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={prescription.od_sphere} onChange={e => setPrescription({...prescription, od_sphere: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase">Cilíndrico</label>
                  <input type="text" placeholder="-0.50" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm text-center text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={prescription.od_cylinder} onChange={e => setPrescription({...prescription, od_cylinder: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase">Eixo (°)</label>
                  <input type="text" placeholder="180" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm text-center text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={prescription.od_axis} onChange={e => setPrescription({...prescription, od_axis: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Olho Esquerdo */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-gray-700 border-b pb-1 text-center sm:text-left">Olho Esquerdo (OE)</h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase">Esférico</label>
                  <input type="text" placeholder="-1.75" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm text-center text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={prescription.oe_sphere} onChange={e => setPrescription({...prescription, oe_sphere: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase">Cilíndrico</label>
                  <input type="text" placeholder="-0.75" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm text-center text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={prescription.oe_cylinder} onChange={e => setPrescription({...prescription, oe_cylinder: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase">Eixo (°)</label>
                  <input type="text" placeholder="90" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm text-center text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={prescription.oe_axis} onChange={e => setPrescription({...prescription, oe_axis: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adição (Perto)</label>
              <input 
                type="text" 
                placeholder="+2.00" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                value={prescription.addition}
                onChange={(e) => setPrescription({...prescription, addition: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">D.P. (Distância Pupilar)</label>
              <input 
                type="text" 
                placeholder="62" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                value={prescription.dp}
                onChange={(e) => setPrescription({...prescription, dp: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: DETALHES DE ARMAÇÃO / LENTE / O.S. */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList size={20} className="text-blue-600" /> 3. Detalhes de Laboratório / Armações
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de Armação</label>
              <input 
                type="text" 
                placeholder="Ex: Ray-Ban Aviador Preto"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                value={saleDetails.frame}
                onChange={(e) => setSaleDetails({...saleDetails, frame: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo / Grau da Lente</label>
              <input 
                type="text" 
                placeholder="Ex: Varilux Crizal Sapphire"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                value={saleDetails.lenses}
                onChange={(e) => setSaleDetails({...saleDetails, lenses: e.target.value})}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total da Venda</label>
              <input 
                type="number" 
                step="0.01" 
                required
                placeholder="R$ 0.00"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                value={saleDetails.total_value}
                onChange={(e) => setSaleDetails({...saleDetails, total_value: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prazo de Entrega</label>
              <input 
                type="date" 
                required
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                value={saleDetails.scheduled_date}
                onChange={(e) => setSaleDetails({...saleDetails, scheduled_date: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionais O.S.</label>
            <textarea 
              rows={2}
              placeholder="Ex: Fazer tratamento antirreflexo..."
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
              value={saleDetails.notes}
              onChange={(e) => setSaleDetails({...saleDetails, notes: e.target.value})}
            />
          </div>
        </div>

        {/* SEÇÃO 4: FINANCEIRO / PAGAMENTO */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <CreditCard size={20} className="text-blue-600" /> 4. Condição de Pagamento (Financeiro)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
              <select 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                value={payment.method}
                onChange={(e) => setPayment({...payment, method: e.target.value})}
              >
                <option value="Pix">Pix</option>
                <option value="Cartao_Credito">Cartão de Crédito</option>
                <option value="Cartao_Debito">Cartão de Débito</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Boleto">Boleto Bancário</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº Parcelas</label>
              <select 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                value={payment.installments}
                onChange={(e) => setPayment({...payment, installments: e.target.value})}
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1}x</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status do Lançamento</label>
              <select 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                value={payment.status}
                onChange={(e) => setPayment({...payment, status: e.target.value})}
              >
                <option value="Paid">Já Pago / Recebido</option>
                <option value="Pending">A Receber (Aberto)</option>
              </select>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 bg-blue-600 text-white font-extrabold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 text-lg"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={24} /> Salvando tudo...
            </>
          ) : (
            'Finalizar Venda & Gerar O.S.'
          )}
        </button>

      </form>

      {/* MODAL DE SUCESSO / IMPRESSÃO DA O.S. DO LABORATÓRIO */}
      {showPrintModal && createdOS && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-6">
            <div className="text-center">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center text-green-600 mx-auto mb-3">
                <Check size={28} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Venda Salva com Sucesso!</h2>
              <p className="text-gray-500 text-sm mt-1">A O.S. já foi criada e lançada no módulo do laboratório e financeiro.</p>
            </div>

            {/* ÁREA DE IMPRESSÃO DA O.S. */}
            <div 
              ref={printAreaRef}
              className="border-2 border-dashed border-gray-200 p-6 rounded-2xl bg-gray-50 text-black font-mono text-sm max-h-96 overflow-y-auto"
            >
              <div className="text-center border-b pb-4 mb-4">
                <h3 className="font-bold text-lg uppercase">ORDEM DE SERVIÇO - LABORATÓRIO</h3>
                <p className="text-xs">Identificador: #{createdOS.id.slice(0,8)}</p>
                <p className="text-xs">Data da Venda: {new Date().toLocaleDateString('pt-BR')}</p>
                <p className="font-bold text-xs mt-2 text-red-600">PREVISÃO DE ENTREGA: {new Date(createdOS.scheduled_date).toLocaleDateString('pt-BR')}</p>
              </div>

              {/* DADOS DO CLIENTE */}
              <div className="space-y-1 mb-4 pb-4 border-b">
                <p className="font-bold text-xs uppercase text-gray-500">Dados do Cliente</p>
                <p><strong>Nome:</strong> {createdOS.clientName}</p>
                {createdOS.phone && <p><strong>WhatsApp:</strong> {createdOS.phone}</p>}
                {createdOS.cpf && <p><strong>CPF:</strong> {createdOS.cpf}</p>}
              </div>

              {/* RECEITA / GRAUS */}
              {createdOS.prescription && (
                <div className="space-y-2 mb-4 pb-4 border-b">
                  <p className="font-bold text-xs uppercase text-gray-500">Prescrição Óptica</p>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="py-1">Olho</th>
                        <th className="py-1">Esférico</th>
                        <th className="py-1">Cilíndrico</th>
                        <th className="py-1">Eixo</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-1 font-bold">OD</td>
                        <td className="py-1">{createdOS.prescription.od_sphere || '0.00'}</td>
                        <td className="py-1">{createdOS.prescription.od_cylinder || '0.00'}</td>
                        <td className="py-1">{createdOS.prescription.od_axis || '0'}°</td>
                      </tr>
                      <tr>
                        <td className="py-1 font-bold">OE</td>
                        <td className="py-1">{createdOS.prescription.oe_sphere || '0.00'}</td>
                        <td className="py-1">{createdOS.prescription.oe_cylinder || '0.00'}</td>
                        <td className="py-1">{createdOS.prescription.oe_axis || '0'}°</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                    {createdOS.prescription.addition && <p><strong>Adição:</strong> {createdOS.prescription.addition}</p>}
                    {createdOS.prescription.dp && <p><strong>D.P.:</strong> {createdOS.prescription.dp} mm</p>}
                  </div>
                </div>
              )}

              {/* ESPECIFICAÇÃO DE PRODUTOS */}
              <div className="space-y-1 mb-4">
                <p className="font-bold text-xs uppercase text-gray-500">Especificações Físicas</p>
                <p><strong>Armação:</strong> {createdOS.frame || 'Armação Própria'}</p>
                <p><strong>Lentes:</strong> {createdOS.lenses || 'Lentes de Estoque'}</p>
                {createdOS.notes && <p><strong>Obs:</strong> {createdOS.notes}</p>}
              </div>

              <div className="text-center text-xs mt-6 border-t pt-4 text-gray-500">
                <p>AppÓtica - Gestão na palma da mão.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
              >
                Fechar Painel
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Printer size={18} /> Imprimir O.S. (Lab)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
