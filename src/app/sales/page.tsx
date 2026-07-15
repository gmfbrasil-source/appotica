'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency, companyInfo } from '@/lib/format';
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
  ClipboardList,
  ChevronDown,
  MessageCircle
} from 'lucide-react';

function getLocalDate(date?: Date): string {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Parse "YYYY-MM-DD" em timezone local (evita que new Date("2026-06-01") interprete como UTC)
function parseDateStr(dateStr: string): Date {
  const parts = dateStr.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function AccordionSection({ num, title, done, isOpen, canOpen, onToggle, children, summary }: {
  num: number;
  title: string;
  done: boolean;
  isOpen: boolean;
  canOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  summary?: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-visible">
      <button
        type="button"
        onClick={() => { if (canOpen || isOpen) onToggle(); }}
        className={`w-full flex items-center justify-between p-4 transition-colors ${canOpen || isOpen ? 'hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
            {done ? <Check size={14} /> : num}
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-800 text-sm">{num}. {title}</p>
            {done && !isOpen && summary && (
              <p className="text-xs text-gray-500">{summary}</p>
            )}
          </div>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  );
}

export default function SalesPage() {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentMethodsError, setPaymentMethodsError] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [activeSection, setActiveSection] = useState(1);
  
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
    saleDate: getLocalDate(new Date()),
    frame: '',
    lenses: '',
    total_value: '',
    scheduled_date: getLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    notes: '',
    frame_width: '',
    bridge_rim: '',
    major_angle: '',
    dp_os: '',
    altura: ''
  });

  // Opções de venda
  const [isSunglasses, setIsSunglasses] = useState(false);
  const [osNumber, setOsNumber] = useState('');
  const [geraOS, setGeraOS] = useState(true);
  const [entregueAgora, setEntregueAgora] = useState(false);
  const [firstDueDate, setFirstDueDate] = useState(getLocalDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));

  // Dados de Pagamento / Financeiro
  const [payment, setPayment] = useState({
    method: '',
    downPayment: '',
    entryStatus: 'Paid',
    installments: '1',
    status: 'Paid',
    hasCardEntry: false,
  });

  // Seções do acordeão
  const section1Done = isNewCustomer ? !!newCustomer.name : !!selectedCustomerId;
  const section2Done = isSunglasses || Object.values(prescription).some(v => v !== '') ||
    saleDetails.frame_width || saleDetails.bridge_rim || saleDetails.major_angle ||
    saleDetails.dp_os || saleDetails.altura;
  const section3Done = !!saleDetails.total_value;

  function getCustomerName(): string {
    if (isNewCustomer) return newCustomer.name || 'Novo cliente';
    const c = customers.find(c => c.id === selectedCustomerId);
    return c?.name || 'Cliente';
  }

  // Estado da venda realizada com sucesso (para modal de impressão)
  const [createdOS, setCreatedOS] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Edição de venda existente
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  async function loadForEdit(orderId: string, methods?: any[]) {
    setLoadingEdit(true);
    try {
      const { data: os, error } = await supabase
        .from('service_orders')
        .select('*, customers(*)')
        .eq('id', orderId)
        .single();
      if (error || !os) throw new Error('Ordem de serviço não encontrada.');

      // Parse notes (frame/lenses/observations are concatenated)
      let frame = '', lenses = '', notes = '';
      if (os.notes) {
        const frameMatch = os.notes.match(/Armação: (.+?)(?:\n|$)/);
        const lensesMatch = os.notes.match(/Lente: (.+?)(?:\n|$)/);
        const notesMatch = os.notes.match(/Observações: (.+?)$/);
        if (frameMatch) frame = frameMatch[1].trim();
        if (lensesMatch) lenses = lensesMatch[1].trim();
        if (notesMatch) notes = notesMatch[1].trim();
        if (frameMatch && frame === 'Não informada') frame = '';
        if (lensesMatch && lenses === 'Não informada') lenses = '';
        if (notesMatch && notes === 'Nenhuma') notes = '';
      }
      if (frame === 'Não informada') frame = '';
      if (lenses === 'Não informada') lenses = '';

      // Set customer
      if (os.customers) {
        setSelectedCustomerId(os.customer_id);
        setCustomerSearch(os.customers.name || '');
      }

      // Set sale details
      setSaleDetails({
        saleDate: os.sale_date || getLocalDate(new Date(os.created_at)),
        frame,
        lenses,
        total_value: String(os.total_value || ''),
        scheduled_date: os.scheduled_date || getLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        notes,
        frame_width: String(os.frame_width ?? ''),
        bridge_rim: String(os.bridge_rim ?? ''),
        major_angle: String(os.major_angle ?? ''),
        dp_os: String(os.dp_os ?? ''),
        altura: String(os.altura ?? '')
      });

      // Set OS number e opções
      setOsNumber(os.os_number || '');
      setGeraOS(true);
      setEntregueAgora(os.status === 'Delivered');

      // Fetch latest prescription for this customer
      let hasPresc = false;
      const { data: presc, error: prescErr } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('customer_id', os.customer_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (presc && !prescErr) {
        setPrescription({
          oe_sphere: presc.oe_sphere != null ? String(presc.oe_sphere) : '',
          oe_cylinder: presc.oe_cylinder != null ? String(presc.oe_cylinder) : '',
          oe_axis: presc.oe_axis != null ? String(presc.oe_axis) : '',
          od_sphere: presc.od_sphere != null ? String(presc.od_sphere) : '',
          od_cylinder: presc.od_cylinder != null ? String(presc.od_cylinder) : '',
          od_axis: presc.od_axis != null ? String(presc.od_axis) : '',
          addition: presc.addition != null ? String(presc.addition) : '',
          dp: presc.dp != null ? String(presc.dp) : '',
          notes: presc.notes || ''
        });
        hasPresc = true;
      }
      setIsSunglasses(!hasPresc);

      // Fetch financial records to restore payment data
      const { data: fins } = await supabase
        .from('financial_records')
        .select('*')
        .eq('order_id', orderId)
        .order('due_date', { ascending: true });

      if (fins && fins.length > 0) {
        const incomeRecords = fins.filter((f: any) => f.type === 'Income');
        const instRecords = incomeRecords.filter((f: any) => f.description.match(/- \d{2}\/\d{2}$/));
        const entryRecord = incomeRecords.find((f: any) => f.description.includes('(Entrada)'));
        const vistaRecord = incomeRecords.find((f: any) => f.description.includes('(À Vista)'));

        // Find payment method by matching description with method names
        const availMethods = methods || paymentMethods;
        let matchedMethodId = '';
        for (const m of availMethods) {
          if (incomeRecords.some((f: any) => f.description.includes(m.name))) {
            matchedMethodId = m.id;
            break;
          }
        }

        // Detect card payment (has fee records)
        const hasFeeRecord = fins.some((f: any) => f.type === 'Expense' && f.description.startsWith('Taxa'));
        // Detect entry+card combo: has both entry record and fee record
        const hasCardEntry = hasFeeRecord && !!entryRecord && entryRecord.amount > 0;

        const instCount = instRecords.length;
        const entryAmount = entryRecord ? entryRecord.amount : 0;
        const hasPending = fins.some((f: any) => f.status === 'Pending');

        setPayment({
          method: matchedMethodId || payment.method,
          downPayment: entryAmount > 0 ? String(entryAmount) : '0',
          entryStatus: entryRecord?.status || 'Paid',
          installments: String(hasFeeRecord ? 1 : (instCount || 1)),
          status: hasPending ? 'Pending' : 'Paid',
          hasCardEntry,
        });

        // Set first due date from the first installment or entry
        if (instRecords.length > 0 && instRecords[0].due_date) {
          setFirstDueDate(instRecords[0].due_date);
        } else if (entryRecord?.due_date) {
          setFirstDueDate(entryRecord.due_date);
        }
      } else {
        setPayment(prev => ({ ...prev, method: (methods || paymentMethods)[0]?.id || '', hasCardEntry: false }));
      }

      setActiveSection(1);
    } catch (err: any) {
      alert('Erro ao carregar venda para edição: ' + err.message);
    } finally {
      setLoadingEdit(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const edit = params.get('edit');
    fetchCustomers();
    if (edit) {
      setEditOrderId(edit);
      fetchPaymentMethods().then(methods => loadForEdit(edit, methods));
    } else {
      fetchPaymentMethods();
    }
  }, []);

  async function fetchPaymentMethods(): Promise<any[]> {
    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    if (!profile?.shop_id) return [];
    const { data, error } = await supabase.from('payment_methods').select('*').eq('shop_id', profile.shop_id).eq('active', true).order('name');
    if (error || !data || data.length === 0) {
      setPaymentMethodsError(true);
      setPaymentMethods([]);
      return [];
    }
    setPaymentMethods(data);
    if (!editOrderId) setPayment(prev => ({ ...prev, method: data[0].id }));
    return data;
  }

  const selectedMethod = paymentMethods.find(m => m.id === payment.method);
  const instCountCard = selectedMethod?.is_card ? Math.max(parseInt(payment.installments) || 1, 1) : 1;
  const effectiveFeePercent = selectedMethod?.fee_by_installment?.[instCountCard] ?? selectedMethod?.fee_percent ?? 0;

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
      const hasPrescriptionData = Object.values(prescription).some(val => val !== '');

      // --- VALIDAÇÃO DE SANIDADE (só se informou receita) ---
      if (hasPrescriptionData) {
        const warnings: string[] = [];
        const valuesToCheck = [
          { name: 'Esférico OD', val: prescription.od_sphere, limit: 10 },
          { name: 'Cilíndrico OD', val: prescription.od_cylinder, limit: 6 },
          { name: 'Esférico OE', val: prescription.oe_sphere, limit: 10 },
          { name: 'Cilíndrico OE', val: prescription.oe_cylinder, limit: 6 },
          { name: 'Adição', val: prescription.addition, limit: 4 },
        ];
        valuesToCheck.forEach(item => {
          const num = Math.abs(parseFloat(item.val) || 0);
          if (num > item.limit) warnings.push(`O valor de ${item.name} (${item.val}) está muito alto. Verifique se está correto.`);
        });
        const axisOD = parseInt(prescription.od_axis);
        const axisOE = parseInt(prescription.oe_axis);
        if (isNaN(axisOD) || axisOD < 0 || axisOD > 180) warnings.push('O Eixo OD deve estar entre 0 e 180.');
        if (isNaN(axisOE) || axisOE < 0 || axisOE > 180) warnings.push('O Eixo OE deve estar entre 0 e 180.');
        const dp = parseFloat(prescription.dp);
        if (!isNaN(dp) && (dp < 40 || dp > 80)) warnings.push('A Distância Pupilar (DP) parece incomum (fora de 40-80mm).');
        if (warnings.length > 0) {
          const confirmed = window.confirm(`Atenção: Foram encontrados valores incomuns:\n\n${warnings.join('\n')}\n\nDeseja continuar com a venda mesmo assim?`);
          if (!confirmed) { setLoading(false); return; }
        }
      }
      // --- FIM DA VALIDAÇÃO ---

      const { data: profile, error: profileErr } = await supabase
        .from('profiles').select('shop_id').single();
      if (profileErr || !profile?.shop_id) throw new Error('Você não está vinculado a nenhuma ótica.');
      const shopId = profile.shop_id;
      let finalCustomerId = selectedCustomerId;

      if (isNewCustomer) {
        if (!newCustomer.name) throw new Error('O nome do cliente é obrigatório.');
        const { data: customerData, error: custErr } = await supabase
          .from('customers').insert([{ ...newCustomer, shop_id: shopId }]).select().single();
        if (custErr) throw custErr;
        finalCustomerId = customerData.id;
      }
      if (!finalCustomerId) throw new Error('Selecione ou cadastre um cliente.');

      let finalPrescriptionId = null;
      if (hasPrescriptionData) {
        const parsedPrescription = {
          customer_id: finalCustomerId, shop_id: shopId,
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
          .from('prescriptions').insert([parsedPrescription]).select().single();
        if (prescErr) throw prescErr;
        finalPrescriptionId = prescData.id;
      }

      const totalVal = parseFloat(saleDetails.total_value);
      if (isNaN(totalVal)) throw new Error('Insira um valor total válido para a venda.');

      // Validação da data da venda
      const saleDateObj = parseDateStr(saleDetails.saleDate);
      if (isNaN(saleDateObj.getTime())) throw new Error('Data da venda inválida.');
      const dateCheck = getLocalDate(saleDateObj);
      if (dateCheck !== saleDetails.saleDate) throw new Error(`Data da venda inválida: ${saleDetails.saleDate} não existe (ex: 31/06 não é válido).`);

      // 4. Cadastrar ou atualizar Ordem de Serviço (O.S.)
      let osData: any = null;
      if (geraOS) {
        const notesOS = `Armação: ${saleDetails.frame || 'Não informada'}\nLente: ${saleDetails.lenses || 'Não informada'}\nObservações: ${saleDetails.notes || 'Nenhuma'}`;
        const osPayload: any = {
          customer_id: finalCustomerId, shop_id: shopId,
          status: 'In_Laboratory',
          total_value: totalVal,
          scheduled_date: saleDetails.scheduled_date,
          sale_date: saleDetails.saleDate,
          notes: notesOS,
          frame_width: saleDetails.frame_width ? parseFloat(saleDetails.frame_width) : null,
          bridge_rim: saleDetails.bridge_rim ? parseFloat(saleDetails.bridge_rim) : null,
          major_angle: saleDetails.major_angle ? parseFloat(saleDetails.major_angle) : null,
          dp_os: saleDetails.dp_os ? parseFloat(saleDetails.dp_os) : null,
          altura: saleDetails.altura ? parseFloat(saleDetails.altura) : null
        };
        if (osNumber.trim()) osPayload.os_number = osNumber.trim();

        if (editOrderId) {
          const { data: osResult, error: osErr } = await supabase
            .from('service_orders')
            .update(osPayload)
            .eq('id', editOrderId)
            .select('*, customers(name, phone, cpf)')
            .single();
          if (osErr) {
            // Se a coluna sale_date ainda não existir, tenta sem ela
            if (osErr.message?.includes('sale_date')) {
              delete osPayload.sale_date;
              const { data: retry, error: retryErr } = await supabase
                .from('service_orders')
                .update(osPayload)
                .eq('id', editOrderId)
                .select('*, customers(name, phone, cpf)')
                .single();
              if (retryErr) throw retryErr;
              osData = retry;
            } else {
              throw osErr;
            }
          } else {
            osData = osResult;
          }
        } else {
          const { data: osResult, error: osErr } = await supabase
            .from('service_orders')
            .insert([osPayload])
            .select('*, customers(name, phone, cpf)')
            .single();
          if (osErr) {
            if (osErr.message?.includes('sale_date')) {
              delete osPayload.sale_date;
              const { data: retry, error: retryErr } = await supabase
                .from('service_orders')
                .insert([osPayload])
                .select('*, customers(name, phone, cpf)')
                .single();
              if (retryErr) throw retryErr;
              osData = retry;
            } else {
              throw osErr;
            }
          } else {
            osData = osResult;
          }
        }
      }

      // 5. Cadastrar lançamentos financeiros
      const financialInserts = [];
       const hoje = parseDateStr(saleDetails.saleDate);
       const hojeStr = getLocalDate(hoje);
       const entrada = Math.min(parseFloat(payment.downPayment) || 0, totalVal);
       const restante = Math.round((totalVal - entrada) * 100) / 100;
       const instCount = Math.max(parseInt(payment.installments) || 0, 0);
       const osPrefix = osData?.os_number ? `OS ${osData.os_number}` : 'Venda';

        if (selectedMethod?.is_card) {
          // Cartão: pode ser apenas cartão, ou entrada + cartão
          const cardAmount = payment.hasCardEntry ? restante : totalVal;
          const instForFee = Math.max(parseInt(payment.installments) || 1, 1);
          const feePerc = ((selectedMethod.fee_by_installment?.[instForFee] ?? selectedMethod.fee_percent) || 0) / 100;
          const feeAmount = Math.round(cardAmount * feePerc * 100) / 100;

          // Entrada + Cartão: gera entrada separada
          if (payment.hasCardEntry && entrada > 0) {
            financialInserts.push({
              shop_id: shopId, type: 'Income',
               description: `${osPrefix} (Entrada)`,
              amount: entrada,
              due_date: hojeStr,
              payment_date: payment.entryStatus === 'Paid' ? hojeStr : null,
              status: payment.entryStatus,
              order_id: osData?.id || null,
              customer_id: finalCustomerId
            });
          }

          // Recebimento do cartão
          financialInserts.push({
            shop_id: shopId, type: 'Income',
             description: `${osPrefix} (${selectedMethod.name})`,
            amount: cardAmount,
            due_date: hojeStr,
            payment_date: hojeStr,
            status: 'Paid',
            order_id: osData?.id || null,
            customer_id: finalCustomerId
          });

          if (feeAmount > 0) {
            financialInserts.push({
              shop_id: shopId, type: 'Expense',
               description: `Taxa ${selectedMethod.name} - ${osPrefix}`,
              amount: feeAmount,
              due_date: hojeStr,
              payment_date: hojeStr,
              status: 'Paid',
              order_id: osData?.id || null,
              customer_id: finalCustomerId
            });
          }
        } else {
          // Demais métodos (Pix, Dinheiro, Boleto, Carnê)
          // Entrada (só se > 0)
          if (entrada > 0) {
            const entryDue = instCount > 0 ? parseDateStr(firstDueDate) : hoje;
            financialInserts.push({
              shop_id: shopId, type: 'Income',
               description: `${osPrefix} (Entrada)`,
              amount: entrada,
              due_date: getLocalDate(entryDue),
              payment_date: payment.entryStatus === 'Paid' ? hojeStr : null,
              status: payment.entryStatus,
              order_id: osData?.id || null,
              customer_id: finalCustomerId
            });
          }

          // Parcelas
          if (instCount > 0 && restante > 0) {
            const firstDate = parseDateStr(firstDueDate);
            for (let i = 0; i < instCount; i++) {
              const baseValor = restante / instCount;
              let valorParcela = Math.floor(baseValor * 100) / 100;
              if (i === instCount - 1) valorParcela = Math.round((restante - valorParcela * (instCount - 1)) * 100) / 100;
              const due = parseDateStr(firstDueDate);
              due.setDate(due.getDate() + i * 30);
              financialInserts.push({
                shop_id: shopId, type: 'Income',
                 description: `${osPrefix} - ${String(i+1).padStart(2, '0')}/${String(instCount).padStart(2, '0')}`,
                amount: valorParcela,
                due_date: getLocalDate(due),
                payment_date: null,
                status: 'Pending',
                order_id: osData?.id || null,
                customer_id: finalCustomerId
              });
            }
          }

          // À vista (sem entrada nem parcelas)
          if (entrada === 0 && instCount === 0) {
            financialInserts.push({
              shop_id: shopId, type: 'Income',
               description: `${osPrefix} (À Vista)`,
              amount: totalVal,
              due_date: hojeStr,
              payment_date: payment.status === 'Paid' ? hojeStr : null,
              status: payment.status,
              order_id: osData?.id || null,
              customer_id: finalCustomerId
            });
          }
        }



       // Se editando, remove lançamentos financeiros antigos e recria
       if (editOrderId) {
         await supabase.from('financial_records').delete().eq('order_id', editOrderId);
       }

       const { error: finErr } = await supabase.from('financial_records').insert(financialInserts);
       if (finErr) throw finErr;

      const clientName = isNewCustomer ? newCustomer.name : (customers.find(c => c.id === finalCustomerId)?.name || 'Cliente');
      const clientPhone = isNewCustomer ? newCustomer.phone : (customers.find(c => c.id === finalCustomerId)?.phone || '');
      // Monta dados das parcelas para o carnê
      const installmentData: { num: number; due: string; amount: number }[] = [];
      if (!selectedMethod?.is_card && instCount > 0 && restante > 0) {
        const firstDate = parseDateStr(firstDueDate);
        for (let i = 0; i < instCount; i++) {
          const baseValor = restante / instCount;
          let valorParcela = Math.floor(baseValor * 100) / 100;
          if (i === instCount - 1) valorParcela = Math.round((restante - valorParcela * (instCount - 1)) * 100) / 100;
          const due = parseDateStr(firstDueDate);
          due.setDate(due.getDate() + i * 30);
          installmentData.push({ num: i + 1, due: due.toLocaleDateString('pt-BR'), amount: valorParcela });
        }
      }
      setCreatedOS({
        id: osData?.id || null,
        geraOS,
        entregueAgora,
        clientName,
        phone: clientPhone,
        cpf: isNewCustomer ? newCustomer.cpf : (customers.find(c => c.id === finalCustomerId)?.cpf || ''),
        email: isNewCustomer ? newCustomer.email : (customers.find(c => c.id === finalCustomerId)?.email || ''),
        osNumber: osNumber.trim() || osData?.os_number || null,
        frame: saleDetails.frame,
        lenses: saleDetails.lenses,
        scheduled_date: saleDetails.scheduled_date,
        total_value: totalVal,
        entrada,
        restante,
        instCount,
        installmentData,
        paymentMethod: selectedMethod?.name || payment.method,
        prescription: hasPrescriptionData ? prescription : null,
        notes: saleDetails.notes
      });

      if (editOrderId) {
        alert('Venda atualizada com sucesso!');
        window.location.href = '/os';
        return;
      }
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
        scheduled_date: getLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        notes: '',
        saleDate: getLocalDate(new Date()),
        frame_width: '',
        bridge_rim: '',
        major_angle: '',
        dp_os: '',
        altura: ''
      });
    setPayment({ method: paymentMethods[0]?.id || '', downPayment: '', entryStatus: 'Paid', installments: '1', status: 'Paid', hasCardEntry: false });
    setIsSunglasses(false);
    setOsNumber('');
    setGeraOS(true);
    setEntregueAgora(false);
    setFirstDueDate(getLocalDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
  }

  const printAreaRef = useRef<HTMLDivElement>(null);
  const carneRef = useRef<HTMLDivElement>(null);

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
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{editOrderId ? 'Editando Venda' : 'Nova Venda'}</h1>
        <p className="text-sm text-gray-500">{editOrderId ? 'Altere os dados necessários e salve as alterações.' : 'Preencha cada etapa para criar a venda completa.'}</p>
        {loadingEdit && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-xl">
            <Loader2 className="animate-spin" size={16} /> Carregando dados da venda...
          </div>
        )}
      </header>

      <form onSubmit={handleCreateSale} className="space-y-3">
        
        {/* SEÇÃO 1: CLIENTE */}
        <AccordionSection num={1} title="Cliente" done={section1Done} canOpen={true} isOpen={activeSection === 1} onToggle={() => setActiveSection(activeSection === 1 ? 0 : 1)} summary={section1Done ? getCustomerName() : ''}>
          <div className="flex justify-between items-center mb-3">
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

              {showCustomerSuggestions && filteredCustomers.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerSearch(c.name);
                        setShowCustomerSuggestions(false);
                        setActiveSection(2);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          {section1Done && (
            <button type="button" onClick={() => setActiveSection(2)} className="w-full mt-3 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm">
              Próximo
            </button>
          )}
        </AccordionSection>

        {/* SEÇÃO 2: GRAU (PRESCRIÇÃO) */}
        <AccordionSection num={2} title="Receita / Grau" done={section2Done} canOpen={section1Done} isOpen={activeSection === 2} onToggle={() => setActiveSection(activeSection === 2 ? 0 : 2)} summary={section2Done ? (isSunglasses ? 'Óculos de Sol' : saleDetails.frame_width ? 'Medidas informadas' : 'Grau informado') : ''}>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={isSunglasses}
              onChange={(e) => setIsSunglasses(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Óculos de Sol (sem grau)</span>
          </label>
          {!isSunglasses && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-2">
                  <h3 className="font-bold text-xs text-gray-700 border-b pb-1 text-center sm:text-left">Olho Direito (OD)</h3>
                  <div className="grid grid-cols-3 gap-1.5">
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
                <div className="space-y-2">
                  <h3 className="font-bold text-xs text-gray-700 border-b pb-1 text-center sm:text-left">Olho Esquerdo (OE)</h3>
                  <div className="grid grid-cols-3 gap-1.5">
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
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adição</label>
                  <input type="text" placeholder="+2.00" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={prescription.addition} onChange={(e) => setPrescription({...prescription, addition: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">D.P.</label>
                  <input type="text" placeholder="62" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={prescription.dp} onChange={(e) => setPrescription({...prescription, dp: e.target.value})} />
                </div>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Des. Arm. (mm)</label>
              <input type="number" step="0.1" min="0" placeholder="Ex: 52" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.frame_width} onChange={(e) => setSaleDetails({...saleDetails, frame_width: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ponte + Aro (mm)</label>
              <input type="number" step="0.1" min="0" placeholder="Ex: 18" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.bridge_rim} onChange={(e) => setSaleDetails({...saleDetails, bridge_rim: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ang. Maior (°)</label>
              <input type="number" step="0.1" min="0" placeholder="Ex: 10" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.major_angle} onChange={(e) => setSaleDetails({...saleDetails, major_angle: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DNP</label>
              <input type="number" step="0.5" min="0" placeholder="Ex: 62" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.dp_os} onChange={(e) => setSaleDetails({...saleDetails, dp_os: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Altura (mm)</label>
              <input type="number" step="0.5" min="0" placeholder="Ex: 22" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.altura} onChange={(e) => setSaleDetails({...saleDetails, altura: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => setActiveSection(3)} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm">
              {section2Done ? 'Próximo' : 'Pular (Sem Grau)'}
            </button>
          </div>
        </AccordionSection>

        {/* SEÇÃO 3: DETALHES DA VENDA */}
        <AccordionSection num={3} title="Produto / Valor" done={section3Done} canOpen={section1Done} isOpen={activeSection === 3} onToggle={() => setActiveSection(activeSection === 3 ? 0 : 3)} summary={section3Done ? formatCurrency(parseFloat(saleDetails.total_value || '0')) : ''}>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={geraOS}
              onChange={(e) => setGeraOS(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Gerar Ordem de Serviço (Laboratório)</span>
          </label>

          {geraOS && (
            <div className="space-y-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data da Venda</label>
                <input type="date" required className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.saleDate} onChange={(e) => setSaleDetails({...saleDetails, saleDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nº da O.S. (opcional)</label>
                <input type="text" placeholder="Ex: 001/2026" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={osNumber} onChange={(e) => setOsNumber(e.target.value)} />
              </div>
            </div>
          )}

          {geraOS && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de Armação</label>
                <input type="text" placeholder="Ex: Ray-Ban Aviador Preto" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.frame} onChange={(e) => setSaleDetails({...saleDetails, frame: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo / Grau da Lente</label>
                <input type="text" placeholder="Ex: Varilux Crizal Sapphire" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.lenses} onChange={(e) => setSaleDetails({...saleDetails, lenses: e.target.value})} />
              </div>
            </div>
          )}

          {geraOS && (
            <div className="mt-3 mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prazo de Entrega</label>
              <input type="date" required className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.scheduled_date} onChange={(e) => setSaleDetails({...saleDetails, scheduled_date: e.target.value})} />
            </div>
          )}

          {!geraOS && (
            <label className="flex items-center gap-2 mt-3 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={entregueAgora}
                onChange={(e) => setEntregueAgora(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">Cliente levou no ato (Entregue)</span>
            </label>
          )}

          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total da Venda</label>
            <input type="number" step="0.01" required placeholder="R$ 0.00" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.total_value} onChange={(e) => setSaleDetails({...saleDetails, total_value: e.target.value})} />
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionais</label>
            <textarea rows={2} placeholder="Ex: Fazer tratamento antirreflexo..." className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={saleDetails.notes} onChange={(e) => setSaleDetails({...saleDetails, notes: e.target.value})} />
          </div>
          {section3Done && (
            <button type="button" onClick={() => setActiveSection(4)} className="w-full mt-3 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm">
              Próximo
            </button>
          )}
        </AccordionSection>

        {/* SEÇÃO 4: FINANCEIRO / PAGAMENTO */}
        <AccordionSection num={4} title="Pagamento" done={false} canOpen={section1Done && section3Done} isOpen={activeSection === 4} onToggle={() => setActiveSection(activeSection === 4 ? 0 : 4)}>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={payment.method} onChange={(e) => setPayment({...payment, method: e.target.value, hasCardEntry: false})}>
                  {paymentMethods.length === 0 && <option value="">Selecione...</option>}
                  {paymentMethods.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              {selectedMethod?.is_card && (
                <p className="text-[10px] text-purple-600 mt-1">Taxa {instCountCard}x: {effectiveFeePercent}% — recebimento integral</p>
              )}
              {paymentMethodsError && (
                <p className="text-[10px] text-yellow-600 mt-1">Nenhum método configurado. Vá em <Link href="/settings" className="underline font-bold">Config</Link>.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor de Entrada</label>
              <input type="number" step="0.01" min="0" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="R$ 0,00" value={payment.downPayment} onChange={(e) => setPayment({...payment, downPayment: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
              <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={payment.installments} onChange={(e) => {
                setPayment({...payment, installments: e.target.value});
                if (parseInt(e.target.value) > 0) {
                  setFirstDueDate(getLocalDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
                }
              }}>
                {selectedMethod?.is_card ? (
                  [...Array(selectedMethod.max_installments || 1)].map((_, i) => (
                    <option key={i+1} value={i+1}>{i+1}x (Taxa: {selectedMethod.fee_by_installment?.[i+1] ?? selectedMethod.fee_percent}%)</option>
                  ))
                ) : (
                  <>
                    <option value="0">0x (Só Entrada)</option>
                    {[...Array(selectedMethod?.max_installments || 12)].map((_, i) => (
                      <option key={i+1} value={i+1}>{i+1}x</option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Card: checkbox para incluir entrada */}
          {selectedMethod?.is_card && (
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={payment.hasCardEntry}
                onChange={(e) => setPayment({...payment, hasCardEntry: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Incluir Entrada (recebimento separado da maquininha)</span>
            </label>
          )}

          {/* Status da Entrada: visível quando tem entrada */}
          {(parseFloat(payment.downPayment) > 0 || payment.hasCardEntry) && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status da Entrada</label>
              <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={payment.entryStatus} onChange={(e) => setPayment({...payment, entryStatus: e.target.value})}>
                <option value="Paid">Recebido</option>
                <option value="Pending">Receber na Entrega</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Pagamento da entrada: já recebido ou a receber na entrega dos óculos.</p>
            </div>
          )}

          {/* Status do Pagamento (à vista): sem entrada e sem parcelas */}
          {!selectedMethod?.is_card && !parseFloat(payment.downPayment) && parseInt(payment.installments) === 0 && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status do Pagamento</label>
              <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none" value={payment.status} onChange={(e) => setPayment({...payment, status: e.target.value})}>
                <option value="Paid">Recebido</option>
                <option value="Pending">Pendente</option>
              </select>
            </div>
          )}

          {/* Data do primeiro vencimento das parcelas */}
          {!selectedMethod?.is_card && parseInt(payment.installments) > 0 && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Data do 1º Vencimento</label>
              <input type="date" required
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
              />
              <p className="text-[11px] text-gray-400 mt-1">As demais parcelas vencerão a cada 30 dias.</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-4 py-3 bg-blue-600 text-white font-extrabold rounded-2xl hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="animate-spin" size={20} /> Salvando...</>
            ) : (
              editOrderId ? 'Salvar Alterações' : (geraOS ? 'Finalizar Venda & Gerar O.S.' : 'Finalizar Venda')
            )}
          </button>
        </AccordionSection>

      </form>

      {/* MODAL DE SUCESSO / IMPRESSÃO */}
      {showPrintModal && createdOS && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto">
          <div className="flex items-start justify-center min-h-full p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-6">
            <div className="text-center">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center text-green-600 mx-auto mb-3">
                <Check size={28} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Venda Salva com Sucesso!</h2>
              <p className="text-gray-500 text-sm mt-1">
                {createdOS.geraOS
                  ? 'A O.S. foi criada e os lançamentos financeiros foram registrados.'
                  : `Venda registrada no financeiro.${createdOS.entregueAgora ? ' Produto entregue ao cliente.' : ''}`}
              </p>
            </div>

            {/* ÁREA DE IMPRESSÃO DA O.S. (só quando geraOS) */}
            {createdOS.geraOS && (
              <div
                ref={printAreaRef}
                className="border-2 border-dashed border-gray-200 p-6 rounded-2xl bg-gray-50 text-black font-mono text-sm max-h-96 overflow-y-auto"
              >
                <div className="text-center border-b pb-4 mb-4">
                  <h3 className="font-bold text-lg uppercase">ORDEM DE SERVIÇO - LABORATÓRIO</h3>
                  <p className="text-xs">{createdOS.osNumber ? `O.S. Nº ${createdOS.osNumber}` : `Identificador: #${createdOS.id?.slice(0, 8)}`}</p>
                  <p className="text-xs">Data da Venda: {new Date().toLocaleDateString('pt-BR')}</p>
                  <p className="font-bold text-xs mt-2 text-red-600">PREVISÃO DE ENTREGA: {new Date(createdOS.scheduled_date).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="space-y-1 mb-4 pb-4 border-b">
                  <p className="font-bold text-xs uppercase text-gray-500">Dados do Cliente</p>
                  <p><strong>Nome:</strong> {createdOS.clientName}</p>
                  {createdOS.phone && <p><strong>WhatsApp:</strong> {createdOS.phone}</p>}
                  {createdOS.cpf && <p><strong>CPF:</strong> {createdOS.cpf}</p>}
                </div>
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
                <div className="space-y-1 mb-4">
                  <p className="font-bold text-xs uppercase text-gray-500">Especificações Físicas</p>
                  <p><strong>Armação:</strong> {createdOS.frame || 'Armação Própria'}</p>
                  <p><strong>Lentes:</strong> {createdOS.lenses || 'Lentes de Estoque'}</p>
                  {createdOS.notes && <p><strong>Obs:</strong> {createdOS.notes}</p>}
                </div>
                <div className="text-center text-xs mt-6 border-t pt-4 text-gray-500 space-y-0.5">
                  <p className="font-bold text-black">{companyInfo.nomeFantasia}</p>
                  <p>{companyInfo.razaoSocial} | CNPJ: {companyInfo.cnpj}</p>
                  <p className="mt-1">AppÓtica - Gestão na palma da mão.</p>
                </div>
              </div>
            )}

            {/* CARNÊ DE PAGAMENTO (para todas as vendas com parcelas) */}
            {createdOS.installmentData && createdOS.installmentData.length > 0 && (
              <div className="space-y-3">
                <div
                  ref={carneRef}
                  className="border-2 border-dashed border-gray-200 p-5 rounded-2xl bg-gray-50 text-black font-mono text-sm max-h-72 overflow-y-auto"
                >
                  <div className="text-center border-b pb-3 mb-3">
                    <h3 className="font-bold text-lg uppercase">CARNÊ DE PAGAMENTO</h3>
                    <p className="text-xs">{companyInfo.nomeFantasia} | {companyInfo.cnpj}</p>
                  </div>
                  <div className="space-y-1 mb-4 pb-3 border-b text-xs">
                    <p><strong>Cliente:</strong> {createdOS.clientName}</p>
                    {createdOS.cpf && <p><strong>CPF:</strong> {createdOS.cpf}</p>}
                    <p><strong>Total:</strong> {formatCurrency(createdOS.total_value)}</p>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="py-1">Parcela</th>
                        <th className="py-1">Vencimento</th>
                        <th className="py-1">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {createdOS.installmentData.map((inst: any) => (
                        <tr key={inst.num} className="border-b border-gray-100">
                          <td className="py-1">{inst.num}/{createdOS.instCount}</td>
                          <td className="py-1">{inst.due}</td>
                          <td className="py-1 font-bold">{formatCurrency(inst.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-center text-[10px] mt-4 pt-3 border-t text-gray-400">
                    <p>AppÓtica - Gestão na palma da mão.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => {
                    const content = carneRef.current?.innerHTML;
                    if (content) {
                      document.body.innerHTML = `<html><head><style>body{font-family:monospace;padding:20px;}</style></head><body>${content}</body></html>`;
                      window.print();
                      window.location.reload();
                    }
                  }} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-1.5 min-w-[120px]">
                    <Printer size={16} /> Imprimir Carnê
                  </button>
                  {createdOS.phone && (
                    <button onClick={() => {
                      const phoneClean = createdOS.phone.replace(/\D/g, '');
                      let msg = `Oi ${createdOS.clientName}! Tudo bem? 😊 Aqui é da ${companyInfo.nomeFantasia}.\n\nSegue o carnê com as parcelinhas da sua compra:\n\n`;
                      createdOS.installmentData.forEach((inst: any) => {
                        msg += `• ${inst.num}/${createdOS.instCount} - Vence ${inst.due} - ${formatCurrency(inst.amount)}\n`;
                      });
                      msg += `\nTotal: ${formatCurrency(createdOS.total_value)}\n\nQualquer dúvida é só chamar! 💙`;
                      window.open(`https://wa.me/55${phoneClean}?text=${encodeURIComponent(msg)}`, '_blank');
                    }} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-1.5 min-w-[120px]">
                      <MessageCircle size={16} /> WhatsApp
                    </button>
                  )}
                  {createdOS.email && (
                    <button onClick={() => {
                      let body = `Olá ${createdOS.clientName}! Tudo bem?\n\nSegue o carnê com as parcelinhas da sua compra na ${companyInfo.nomeFantasia}:\n\n`;
                      createdOS.installmentData.forEach((inst: any) => {
                        body += `${inst.num}/${createdOS.instCount} - ${inst.due} - ${formatCurrency(inst.amount)}\n`;
                      });
                      body += `\nTotal: ${formatCurrency(createdOS.total_value)}\n\nQualquer dúvida é só responder esse e-mail!\n\n${companyInfo.nomeFantasia}`;
                      window.open(`mailto:${createdOS.email}?subject=Carnê de Pagamento - ${companyInfo.nomeFantasia}&body=${encodeURIComponent(body)}`, '_blank');
                    }} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-1.5 min-w-[120px]">
                      <FileText size={16} /> E-mail
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* BOTÕES PRINCIPAIS */}
            <div className="flex gap-3">
              {createdOS.geraOS && (
                <>
                <button onClick={() => setShowPrintModal(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                  Fechar Painel
                </button>
                <button onClick={handlePrint} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                  <Printer size={18} /> Imprimir O.S. (Lab)
                </button>
                </>
              )}
              <button onClick={() => { setShowPrintModal(false); window.location.reload(); }} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
                Nova Venda
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
