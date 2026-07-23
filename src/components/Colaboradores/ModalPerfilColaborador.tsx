'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  X, User, Camera, ChevronDown,
  Plus, FileText, AlertTriangle, CheckSquare, Eye, Edit3,
  Clock, BadgeCheck, UserX, RefreshCw, Calendar, KeyRound,
} from 'lucide-react';

import {
  getColaboradorCompleto, updateColaboradorDados,
  getCargos, createCargo, getModalidades, createModalidade,
  criarContratoColaborador, renovarContratoColaborador,
  efetivarColaborador, desligarColaborador,
  saveChecklist, alterarSenhaAdmin,
} from '@/actions/ColaboradorRH';
import { getSetoresParaSelect } from '@/actions/gestaoSetores';

// ─── Explicit types (independent of Prisma client version) ───────────────────

interface ContratoColaborador {
  id: string;
  tipo: string;
  modalidade: string;
  dataInicio: Date;
  dataFim: Date | null;
  renovacaoNumero: number;
  status: string;
  contratoUrl: string | null;
  observacoes: string | null;
  createdAt: Date;
}

interface ChecklistDocumental {
  carteiraTrabalho: boolean;
  pis: boolean;
  identidade: boolean;
  cpfDoc: boolean;
  cnh: boolean;
  tituloEleitor: boolean;
  reservista: boolean;
  comprovanteResidencia: boolean;
  certidao: boolean;
  foto3x4: boolean;
  exameAdmissional: boolean;
  escolaridade: boolean;
}

interface ColaboradorFull {
  id: number;
  nome: string;
  usuario: string;
  email: string;
  role: string;
  imagemUrl: string | null;
  cargo: string | null;
  status: string;
  data_contratacao: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  telefone_corporativo: string | null;
  contato_emerg_1_nome: string | null;
  contato_emerg_1_tel: string | null;
  contato_emerg_2_nome: string | null;
  contato_emerg_2_tel: string | null;
  observacoes_internas: string | null;
  // Só indica SE há token (valor nunca trafega ao cliente).
  tem_token_onyx?: boolean;
  contratosColaborador: ContratoColaborador[];
  checklistDocumental: ChecklistDocumental | null;
}

type ChecklistKey = keyof ChecklistDocumental;

interface ModalPerfilColaboradorProps {
  usuarioId: number | null;
  currentUserRole: string;
  open: boolean;
  onClose: () => void;
  onAtualizado: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['ATIVO', 'INATIVO', 'AFASTADO', 'FÉRIAS'];

const CHECKLIST_ITEMS: { key: ChecklistKey; label: string }[] = [
  { key: 'carteiraTrabalho', label: 'Carteira de Trabalho' },
  { key: 'pis', label: 'PIS' },
  { key: 'identidade', label: 'Cópia da Carteira de Identidade' },
  { key: 'cpfDoc', label: 'CPF' },
  { key: 'cnh', label: 'CNH' },
  { key: 'tituloEleitor', label: 'Título de Eleitor' },
  { key: 'reservista', label: 'Certificado de Reservista' },
  { key: 'comprovanteResidencia', label: 'Comprovante de Residência' },
  { key: 'certidao', label: 'Certidão de Casamento / Declaração de Convivência' },
  { key: 'foto3x4', label: '01 Foto 3x4' },
  { key: 'exameAdmissional', label: 'Exame Admissional' },
  { key: 'escolaridade', label: 'Grau de Escolaridade' },
];

const CONTRACT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  EXPERIENCIA: { label: 'Experiência', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  RENOVADA: { label: 'Renovada', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  EFETIVADO: { label: 'Efetivado', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  DESLIGADO: { label: 'Desligado', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
};

const EMPTY_CHECKLIST: ChecklistDocumental = {
  carteiraTrabalho: false, pis: false, identidade: false, cpfDoc: false,
  cnh: false, tituloEleitor: false, reservista: false, comprovanteResidencia: false,
  certidao: false, foto3x4: false, exameAdmissional: false, escolaridade: false,
};

function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-10 px-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[11px] font-bold text-white placeholder:text-slate-700 focus:border-indigo-500/40 focus:bg-indigo-500/5 outline-none transition-all disabled:opacity-40"
    />
  );
}

function SelectInput({ value, onChange, options, disabled }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="h-10 px-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[11px] font-bold text-white focus:border-indigo-500/40 outline-none transition-all appearance-none disabled:opacity-40"
      style={{ backgroundColor: '#0f172a', color: 'white' }}
    >
      <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>Selecionar...</option>
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ backgroundColor: '#0f172a', color: 'white' }}>{o.label}</option>
      ))}
    </select>
  );
}

function TabBtn({ active, onClick, label, icon: Icon }: {
  active: boolean; onClick: () => void; label: string; icon: React.ElementType;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
        active
          ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400'
          : 'text-slate-600 hover:text-slate-400 border border-transparent'
      }`}
    >
      <Icon size={11} />
      {label}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ModalPerfilColaborador({
  usuarioId,
  currentUserRole,
  open,
  onClose,
  onAtualizado,
}: ModalPerfilColaboradorProps) {
  const [tab, setTab] = useState<'dados' | 'contrato' | 'documentos' | 'observacoes' | 'senha'>('dados');
  const [loading, setLoading] = useState(true);
  const [saving, startSave] = useTransition();
  const [usuario, setUsuario] = useState<ColaboradorFull | null>(null);

  // Form state
  const [nome, setNome] = useState('');
  const [usuarioLogin, setUsuarioLogin] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [cargo, setCargo] = useState('');
  const [status, setStatus] = useState('ATIVO');
  const [dataContratacao, setDataContratacao] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [telefoneCorp, setTelefoneCorp] = useState('');
  const [emerg1Nome, setEmerg1Nome] = useState('');
  const [emerg1Tel, setEmerg1Tel] = useState('');
  const [emerg2Nome, setEmerg2Nome] = useState('');
  const [emerg2Tel, setEmerg2Tel] = useState('');
  const [obsInternas, setObsInternas] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  // Token Onyx — só admin/CEO. Vazio = não alterar (mantém o atual no banco).
  const [tokenOnyx, setTokenOnyx] = useState('');
  const [temTokenOnyx, setTemTokenOnyx] = useState(false);

  // Lists
  const [setoresLista, setSetoresLista] = useState<string[]>([]);
  const [cargos, setCargos] = useState<{ id: number; nome: string }[]>([]);
  const [modalidades, setModalidades] = useState<{ id: number; nome: string }[]>([]);
  const [novoCargo, setNovoCargo] = useState('');
  const [showNovoCargo, setShowNovoCargo] = useState(false);
  const [novaModalidade, setNovaModalidade] = useState('');
  const [showNovaModalidade, setShowNovaModalidade] = useState(false);

  // Contract form
  const [contratoTipo, setContratoTipo] = useState<'EXPERIENCIA' | 'EFETIVO'>('EXPERIENCIA');
  const [contratoModalidade, setContratoModalidade] = useState('');
  const [contratoDataInicio, setContratoDataInicio] = useState('');
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [criandoContrato, setCriandoContrato] = useState(false);

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistDocumental>({ ...EMPTY_CHECKLIST });
  const [savingChecklist, setSavingChecklist] = useState(false);

  // Upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Senha (Admin only)
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const isAdmin = currentUserRole === 'Admin' || currentUserRole === 'CEO';
  const isRH = currentUserRole === 'RECURSOS HUMANOS';
  const podeVerObs = isAdmin || isRH || currentUserRole === 'FINANCEIRO';
  const podeEditarRole = isAdmin || isRH;
  const podeGerenciarContrato = isAdmin || isRH;

  useEffect(() => {
    if (!open || !usuarioId) return;
    setTab('dados');
    setShowNovoContrato(false);
    void load();
  }, [open, usuarioId]);

  async function load() {
    if (!usuarioId) return;
    setLoading(true);

    const [res, cargosRes, modalRes, setoresRes] = await Promise.all([
      getColaboradorCompleto(usuarioId),
      getCargos(),
      getModalidades(),
      getSetoresParaSelect(),
    ]);

    if (res.success) {
      const u = res.usuario as unknown as ColaboradorFull;
      setUsuario(u);
      setNome(u.nome ?? '');
      setUsuarioLogin(u.usuario ?? '');
      setEmail(u.email ?? '');
      setRole(u.role ?? '');
      setCargo(u.cargo ?? '');
      setStatus(u.status ?? 'ATIVO');
      setDataContratacao(u.data_contratacao ?? '');
      setCpf(u.cpf ?? '');
      setDataNascimento(u.data_nascimento ?? '');
      setTelefone(u.telefone ?? '');
      setTelefoneCorp(u.telefone_corporativo ?? '');
      setEmerg1Nome(u.contato_emerg_1_nome ?? '');
      setEmerg1Tel(u.contato_emerg_1_tel ?? '');
      setEmerg2Nome(u.contato_emerg_2_nome ?? '');
      setEmerg2Tel(u.contato_emerg_2_tel ?? '');
      setObsInternas(u.observacoes_internas ?? '');
      setImagemUrl(u.imagemUrl ?? '');
      setTemTokenOnyx(!!u.tem_token_onyx);
      setTokenOnyx(''); // nunca pré-preenche (valor não trafega)

      const cl = u.checklistDocumental;
      setChecklist(cl ? { ...cl } : { ...EMPTY_CHECKLIST });
    }

    if (cargosRes.success) setCargos(cargosRes.cargos);
    if (modalRes.success) setModalidades(modalRes.modalidades);
    setSetoresLista(setoresRes);

    setLoading(false);
  }

  async function handleSaveDados() {
    if (!usuarioId) return;
    startSave(async () => {
      const res = await updateColaboradorDados(usuarioId, {
        nome, usuario: usuarioLogin, email, role, cargo, status,
        data_contratacao: dataContratacao, cpf, data_nascimento: dataNascimento,
        telefone, telefone_corporativo: telefoneCorp,
        contato_emerg_1_nome: emerg1Nome, contato_emerg_1_tel: emerg1Tel,
        contato_emerg_2_nome: emerg2Nome, contato_emerg_2_tel: emerg2Tel,
        observacoes_internas: obsInternas,
        ...(imagemUrl ? { imagemUrl } : {}),
        // Token só vai quando admin digitou algo (define/atualiza). Para limpar,
        // o botão de remover envia a string vazia separadamente.
        ...(isAdmin && tokenOnyx.trim() ? { token_onyx: tokenOnyx.trim() } : {}),
      });
      if (res.success) {
        toast.success('Dados salvos');
        if (isAdmin && tokenOnyx.trim()) { setTemTokenOnyx(true); setTokenOnyx(''); }
        onAtualizado();
        void load();
      }
      else toast.error(res.error ?? 'Erro ao salvar');
    });
  }

  async function handleRemoverToken() {
    if (!usuarioId || !isAdmin) return;
    startSave(async () => {
      const res = await updateColaboradorDados(usuarioId, {
        nome, usuario: usuarioLogin, email, role, cargo, status,
        data_contratacao: dataContratacao, cpf, data_nascimento: dataNascimento,
        telefone, telefone_corporativo: telefoneCorp,
        contato_emerg_1_nome: emerg1Nome, contato_emerg_1_tel: emerg1Tel,
        contato_emerg_2_nome: emerg2Nome, contato_emerg_2_tel: emerg2Tel,
        observacoes_internas: obsInternas,
        ...(imagemUrl ? { imagemUrl } : {}),
        token_onyx: '', // string vazia = limpar o token no banco
      });
      if (res.success) {
        toast.success('Token Onyx removido');
        setTemTokenOnyx(false);
        setTokenOnyx('');
        onAtualizado();
        void load();
      } else toast.error(res.error ?? 'Erro ao remover token');
    });
  }

  async function handleUploadFoto(file: File) {
    setUploadingFoto(true);
    try {
      const res = await fetch(`/api/chat/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST', body: file,
      });
      const data = await res.json() as { url?: string };
      if (data.url) { setImagemUrl(data.url); toast.success('Foto carregada — salve para confirmar'); }
    } catch { toast.error('Erro ao enviar foto'); }
    setUploadingFoto(false);
  }

  async function handleAddCargo() {
    if (!novoCargo.trim()) return;
    const res = await createCargo(novoCargo);
    if (res.success) {
      setCargos(prev => [...prev, res.cargo].sort((a, b) => a.nome.localeCompare(b.nome)));
      setCargo(res.cargo.nome);
      setNovoCargo(''); setShowNovoCargo(false);
    } else toast.error(res.error);
  }

  async function handleAddModalidade() {
    if (!novaModalidade.trim()) return;
    const res = await createModalidade(novaModalidade);
    if (res.success) {
      setModalidades(prev => [...prev, res.modalidade].sort((a, b) => a.nome.localeCompare(b.nome)));
      setContratoModalidade(res.modalidade.nome);
      setNovaModalidade(''); setShowNovaModalidade(false);
    } else toast.error(res.error);
  }

  async function handleCriarContrato() {
    if (!usuarioId || !contratoModalidade || !contratoDataInicio) {
      toast.error('Preencha todos os campos'); return;
    }
    setCriandoContrato(true);
    const res = await criarContratoColaborador(usuarioId, {
      tipo: contratoTipo, modalidade: contratoModalidade, dataInicio: contratoDataInicio,
    });
    setCriandoContrato(false);
    if (res.success) { toast.success('Contrato criado'); setShowNovoContrato(false); void load(); }
    else toast.error(res.error);
  }

  async function handleRenovar(id: string) {
    const res = await renovarContratoColaborador(id);
    if (res.success) { toast.success('Contrato renovado +45 dias'); void load(); }
    else toast.error(res.error);
  }

  async function handleEfetivar(id: string) {
    const res = await efetivarColaborador(id);
    if (res.success) { toast.success('Colaborador efetivado'); void load(); }
    else toast.error(res.error);
  }

  async function handleDesligar(id: string) {
    const res = await desligarColaborador(id);
    if (res.success) { toast.success('Colaborador desligado'); void load(); }
    else toast.error(res.error);
  }

  async function handleSaveChecklist() {
    if (!usuarioId) return;
    setSavingChecklist(true);
    const res = await saveChecklist(usuarioId, checklist);
    setSavingChecklist(false);
    if (res.success) toast.success('Checklist salvo');
    else toast.error(res.error);
  }

  async function handleSalvarSenha() {
    if (!usuarioId) return;
    if (novaSenha.length < 6) { toast.error('Senha deve ter ao menos 6 caracteres'); return; }
    if (novaSenha !== confirmarSenha) { toast.error('Senhas não coincidem'); return; }
    setSalvandoSenha(true);
    const res = await alterarSenhaAdmin(usuarioId, novaSenha);
    setSalvandoSenha(false);
    if (res.success) { toast.success('Senha alterada com sucesso'); setNovaSenha(''); setConfirmarSenha(''); }
    else toast.error(res.error ?? 'Erro ao alterar senha');
  }

  const initials = (nome || 'CO').substring(0, 2).toUpperCase();
  const contratos = usuario?.contratosColaborador ?? [];
  const contratoAtivo = contratos.find(c => c.status !== 'DESLIGADO') ?? null;
  const diasVencimento = contratoAtivo ? daysUntil(contratoAtivo.dataFim) : null;
  const alertVencimento = diasVencimento !== null && diasVencimento <= 7 && diasVencimento >= 0;

  const checklistCount = CHECKLIST_ITEMS.filter(i => checklist[i.key]).length;

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#080f1e] border border-white/[0.08] rounded-3xl shadow-[0_40px_80px_rgba(0,0,0,0.9)] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div className="shrink-0 flex items-center gap-4 p-6 border-b border-white/5">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                    {imagemUrl ? (
                      <Image src={imagemUrl} alt={nome} width={64} height={64} className="object-cover w-full h-full" unoptimized />
                    ) : (
                      <span className="text-indigo-400 font-black text-xl">{initials}</span>
                    )}
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingFoto}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Camera size={10} className="text-white" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadFoto(f);
                    e.target.value = '';
                  }} />
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-black text-white uppercase italic truncate">{nome || 'Colaborador'}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">{role}</span>
                    {cargo && <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border bg-white/5 border-white/10 text-slate-400">{cargo}</span>}
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${status === 'ATIVO' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                      {status}
                    </span>
                    {alertVencimento && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border bg-amber-500/10 border-amber-500/30 text-amber-400">
                        <AlertTriangle size={9} />
                        Contrato vence em {diasVencimento}d
                      </span>
                    )}
                  </div>
                </div>

                <button onClick={onClose} className="shrink-0 p-2 rounded-xl text-slate-600 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* ── Tabs ── */}
              <div className="shrink-0 flex items-center gap-1 px-6 py-3 border-b border-white/5 overflow-x-auto">
                <TabBtn active={tab === 'dados'} onClick={() => setTab('dados')} label="Dados" icon={User} />
                <TabBtn active={tab === 'contrato'} onClick={() => setTab('contrato')} label="Contrato" icon={FileText} />
                <TabBtn active={tab === 'documentos'} onClick={() => setTab('documentos')} label={`Documentos ${checklistCount}/${CHECKLIST_ITEMS.length}`} icon={CheckSquare} />
                {podeVerObs && <TabBtn active={tab === 'observacoes'} onClick={() => setTab('observacoes')} label="Observações" icon={Eye} />}
                {currentUserRole === 'Admin' && <TabBtn active={tab === 'senha'} onClick={() => setTab('senha')} label="Senha" icon={KeyRound} />}
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="flex items-center justify-center py-20 text-slate-600 text-xs font-black uppercase tracking-widest animate-pulse">
                    Carregando...
                  </div>
                ) : (
                  <>
                    {/* TAB: DADOS */}
                    {tab === 'dados' && (
                      <div className="p-6 space-y-6">
                        <section>
                          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-indigo-500 mb-4">Identificação</p>
                          <div className="grid gap-4">
                            <Field label="Nome Completo">
                              <TextInput value={nome} onChange={setNome} placeholder="Nome completo" />
                            </Field>
                            <div className="grid grid-cols-2 gap-4">
                              <Field label="Username">
                                <TextInput value={usuarioLogin} onChange={setUsuarioLogin} placeholder="@usuario" />
                              </Field>
                              <Field label="E-mail">
                                <TextInput value={email} onChange={setEmail} placeholder="email@empresa.com" type="email" />
                              </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <Field label="Setor / Role">
                                <SelectInput value={role} onChange={setRole} disabled={!podeEditarRole}
                                  options={setoresLista.map(s => ({ value: s, label: s }))} />
                              </Field>
                              <Field label="Status">
                                <div className="space-y-1.5">
                                  <SelectInput value={status} onChange={setStatus}
                                    options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} />
                                  <p className="text-[8px] leading-relaxed text-amber-400/80">
                                    Qualquer status diferente de ATIVO bloqueia o acesso ao Painel Alpha.
                                  </p>
                                </div>
                              </Field>
                            </div>
                          </div>
                        </section>

                        <section>
                          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-500 mb-4">Dados Profissionais</p>
                          <div className="grid gap-4">
                            <Field label="Cargo">
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <SelectInput value={cargo} onChange={setCargo}
                                    options={cargos.map(c => ({ value: c.nome, label: c.nome }))} />
                                </div>
                                <button onClick={() => setShowNovoCargo(v => !v)}
                                  className="h-10 px-3 rounded-xl bg-white/5 border border-white/[0.08] text-[9px] font-black uppercase text-slate-500 hover:text-white transition-all cursor-pointer shrink-0">
                                  <Plus size={12} />
                                </button>
                              </div>
                              {showNovoCargo && (
                                <div className="flex gap-2 mt-2">
                                  <input value={novoCargo} onChange={e => setNovoCargo(e.target.value)}
                                    placeholder="Nome do cargo..." onKeyDown={e => e.key === 'Enter' && void handleAddCargo()}
                                    className="flex-1 h-9 px-3 rounded-xl bg-white/[0.03] border border-indigo-500/30 text-[11px] font-bold text-white placeholder:text-slate-700 outline-none" />
                                  <button onClick={() => void handleAddCargo()}
                                    className="h-9 px-4 rounded-xl bg-indigo-600 text-white text-[9px] font-black uppercase cursor-pointer hover:bg-indigo-500">
                                    Salvar
                                  </button>
                                </div>
                              )}
                            </Field>

                            <div className="grid grid-cols-2 gap-4">
                              <Field label="Data de Contratação">
                                <TextInput value={dataContratacao} onChange={setDataContratacao} type="date" />
                              </Field>
                              <Field label="CPF">
                                <TextInput value={cpf} onChange={v => {
                                  const raw = v.replace(/\D/g, '').slice(0, 11);
                                  const fmt = raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                                  setCpf(fmt);
                                }} placeholder="000.000.000-00" />
                              </Field>
                            </div>

                            <Field label="Data de Nascimento">
                              <TextInput value={dataNascimento} onChange={setDataNascimento} type="date" />
                            </Field>
                          </div>
                        </section>

                        <section>
                          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-4">Contatos</p>
                          <div className="grid grid-cols-2 gap-4">
                            <Field label="Telefone Pessoal">
                              <TextInput value={telefone} onChange={setTelefone} placeholder="(11) 99999-0000" />
                            </Field>
                            <Field label="Telefone Corporativo">
                              <TextInput value={telefoneCorp} onChange={setTelefoneCorp} placeholder="(11) 99999-0000" />
                            </Field>
                          </div>
                        </section>

                        <section>
                          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-rose-500 mb-4">Contatos de Emergência</p>
                          <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                              <Field label="Nome — Contato 01">
                                <TextInput value={emerg1Nome} onChange={setEmerg1Nome} placeholder="Nome completo" />
                              </Field>
                              <Field label="Telefone — Contato 01">
                                <TextInput value={emerg1Tel} onChange={setEmerg1Tel} placeholder="(11) 99999-0000" />
                              </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <Field label="Nome — Contato 02">
                                <TextInput value={emerg2Nome} onChange={setEmerg2Nome} placeholder="Nome completo" />
                              </Field>
                              <Field label="Telefone — Contato 02">
                                <TextInput value={emerg2Tel} onChange={setEmerg2Tel} placeholder="(11) 99999-0000" />
                              </Field>
                            </div>
                          </div>
                        </section>

                        {/* Integração Onyx — só admin/CEO */}
                        {isAdmin && (
                          <section>
                            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-cyan-500 mb-4 flex items-center gap-1.5">
                              <KeyRound size={11} /> Integração Onyx (IA)
                            </p>
                            <Field label="Token Onyx do usuário">
                              <div className="flex items-center gap-2">
                                <input
                                  type="password"
                                  autoComplete="off"
                                  value={tokenOnyx}
                                  onChange={(e) => setTokenOnyx(e.target.value)}
                                  placeholder={temTokenOnyx ? '•••••••• (configurado — digite para substituir)' : 'onyx_pat_… (opcional)'}
                                  className="flex-1 h-11 rounded-xl bg-black/40 border border-white/10 text-[11px] font-bold text-white px-3 placeholder:text-slate-600 focus:border-cyan-500/50 outline-none"
                                />
                                {temTokenOnyx && (
                                  <button
                                    type="button"
                                    onClick={() => void handleRemoverToken()}
                                    disabled={saving}
                                    className="shrink-0 h-11 px-3 rounded-xl border border-red-500/30 text-red-400 text-[9px] font-black uppercase tracking-wider hover:bg-red-500/10 transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                            </Field>
                            <p className="text-[8px] text-slate-600 leading-relaxed mt-1.5">
                              {temTokenOnyx
                                ? 'Há um token configurado. As conversas e agentes deste usuário usam a identidade dele no Onyx. Digite um novo valor para substituir, ou Remover para voltar à conta de serviço.'
                                : 'Cole o PAT individual deste usuário no Onyx. Sem token, ele usa a conta de serviço compartilhada.'}
                            </p>
                          </section>
                        )}

                        <div className="flex justify-end pt-2">
                          <button onClick={() => void handleSaveDados()} disabled={saving}
                            className="flex items-center gap-2 h-11 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50 shadow-xl shadow-indigo-900/40">
                            <Edit3 size={13} />
                            {saving ? 'Salvando...' : 'Salvar Dados'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB: CONTRATO */}
                    {tab === 'contrato' && (
                      <div className="p-6 space-y-5">
                        {contratoAtivo ? (
                          <div className={`p-5 rounded-2xl border ${CONTRACT_CONFIG[contratoAtivo.status]?.bg ?? 'border-white/10'}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <BadgeCheck size={14} className={CONTRACT_CONFIG[contratoAtivo.status]?.color} />
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${CONTRACT_CONFIG[contratoAtivo.status]?.color}`}>
                                    {CONTRACT_CONFIG[contratoAtivo.status]?.label ?? contratoAtivo.status}
                                  </span>
                                  {contratoAtivo.renovacaoNumero > 0 && (
                                    <span className="text-[8px] font-bold text-slate-500 uppercase">({contratoAtivo.renovacaoNumero}ª renovação)</span>
                                  )}
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{contratoAtivo.modalidade}</p>
                                <div className="flex items-center gap-4 mt-2 text-[9px] text-slate-500 font-bold uppercase">
                                  <span className="flex items-center gap-1"><Calendar size={9} />Início: {formatDate(contratoAtivo.dataInicio)}</span>
                                  {contratoAtivo.dataFim && (
                                    <span className={`flex items-center gap-1 ${alertVencimento ? 'text-amber-400' : ''}`}>
                                      <Clock size={9} />
                                      Vence: {formatDate(contratoAtivo.dataFim)}
                                      {diasVencimento !== null && diasVencimento >= 0 && ` (${diasVencimento}d)`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {contratoAtivo.contratoUrl && (
                                <a href={contratoAtivo.contratoUrl} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1 h-8 px-3 rounded-xl bg-white/5 border border-white/[0.08] text-[8px] font-black uppercase text-slate-400 hover:text-white transition-all shrink-0">
                                  <Eye size={10} />Ver PDF
                                </a>
                              )}
                            </div>

                            {podeGerenciarContrato && (
                              <div className="flex gap-2 mt-4 pt-4 border-t border-white/5 flex-wrap">
                                {['EXPERIENCIA', 'RENOVADA'].includes(contratoAtivo.status) && (
                                  <>
                                    <button onClick={() => void handleRenovar(contratoAtivo.id)}
                                      className="flex items-center gap-1 h-8 px-3 rounded-xl bg-blue-600/10 border border-blue-500/20 text-[8px] font-black uppercase text-blue-400 hover:bg-blue-600/20 cursor-pointer">
                                      <RefreshCw size={10} />Renovar +45d
                                    </button>
                                    <button onClick={() => void handleEfetivar(contratoAtivo.id)}
                                      className="flex items-center gap-1 h-8 px-3 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-[8px] font-black uppercase text-emerald-400 hover:bg-emerald-600/20 cursor-pointer">
                                      <BadgeCheck size={10} />Efetivar
                                    </button>
                                  </>
                                )}
                                <button onClick={() => void handleDesligar(contratoAtivo.id)}
                                  className="flex items-center gap-1 h-8 px-3 rounded-xl bg-red-600/10 border border-red-500/20 text-[8px] font-black uppercase text-red-400 hover:bg-red-600/20 cursor-pointer ml-auto">
                                  <UserX size={10} />Desligar
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-700">
                            <FileText size={32} />
                            <p className="text-xs font-black uppercase tracking-widest">Nenhum contrato ativo</p>
                          </div>
                        )}

                        {contratos.length > 1 && (
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-600 mb-3">Histórico</p>
                            <div className="space-y-2">
                              {contratos.slice(1).map(c => (
                                <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5">
                                  <div className="flex items-center gap-3">
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${CONTRACT_CONFIG[c.status]?.bg ?? 'border-white/10'} ${CONTRACT_CONFIG[c.status]?.color ?? 'text-slate-400'}`}>
                                      {CONTRACT_CONFIG[c.status]?.label ?? c.status}
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-bold">{c.modalidade}</span>
                                  </div>
                                  <span className="text-[8px] text-slate-600">{formatDate(c.createdAt)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {podeGerenciarContrato && (
                          <div>
                            <button onClick={() => setShowNovoContrato(v => !v)}
                              className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white/5 border border-white/[0.08] text-[9px] font-black uppercase text-slate-400 hover:text-white transition-all cursor-pointer">
                              <Plus size={12} />Novo Contrato
                              <ChevronDown size={11} className={`transition-transform ${showNovoContrato ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                              {showNovoContrato && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                  <div className="mt-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <Field label="Tipo">
                                        <SelectInput value={contratoTipo} onChange={v => setContratoTipo(v as 'EXPERIENCIA' | 'EFETIVO')}
                                          options={[{ value: 'EXPERIENCIA', label: 'Experiência (+45d)' }, { value: 'EFETIVO', label: 'Efetivo' }]} />
                                      </Field>
                                      <Field label="Data de Início">
                                        <TextInput value={contratoDataInicio} onChange={setContratoDataInicio} type="date" />
                                      </Field>
                                    </div>
                                    <Field label="Modalidade">
                                      <div className="flex gap-2">
                                        <div className="flex-1">
                                          <SelectInput value={contratoModalidade} onChange={setContratoModalidade}
                                            options={modalidades.map(m => ({ value: m.nome, label: m.nome }))} />
                                        </div>
                                        <button onClick={() => setShowNovaModalidade(v => !v)}
                                          className="h-10 px-3 rounded-xl bg-white/5 border border-white/[0.08] text-slate-500 hover:text-white cursor-pointer shrink-0">
                                          <Plus size={12} />
                                        </button>
                                      </div>
                                      {showNovaModalidade && (
                                        <div className="flex gap-2 mt-2">
                                          <input value={novaModalidade} onChange={e => setNovaModalidade(e.target.value)}
                                            placeholder="Nova modalidade..." onKeyDown={e => e.key === 'Enter' && void handleAddModalidade()}
                                            className="flex-1 h-9 px-3 rounded-xl bg-white/[0.03] border border-indigo-500/30 text-[11px] font-bold text-white placeholder:text-slate-700 outline-none" />
                                          <button onClick={() => void handleAddModalidade()} className="h-9 px-4 rounded-xl bg-indigo-600 text-white text-[9px] font-black uppercase cursor-pointer">Salvar</button>
                                        </div>
                                      )}
                                    </Field>
                                    {contratoTipo === 'EXPERIENCIA' && (
                                      <p className="text-[9px] text-amber-400/80 font-bold flex items-center gap-1">
                                        <Clock size={9} />Vencimento calculado: início + 45 dias
                                      </p>
                                    )}
                                    <button onClick={() => void handleCriarContrato()} disabled={criandoContrato}
                                      className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-50">
                                      {criandoContrato ? 'Criando...' : 'Criar Contrato'}
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB: DOCUMENTOS */}
                    {tab === 'documentos' && (
                      <div className="p-6 space-y-3">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500">
                            {checklistCount} / {CHECKLIST_ITEMS.length} entregues
                          </p>
                          <button onClick={() => void handleSaveChecklist()} disabled={savingChecklist}
                            className="h-8 px-5 rounded-xl bg-indigo-600 text-white text-[9px] font-black uppercase cursor-pointer hover:bg-indigo-500 disabled:opacity-50">
                            {savingChecklist ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>

                        {CHECKLIST_ITEMS.map(item => {
                          const checked = checklist[item.key];
                          return (
                            <motion.button key={item.key}
                              onClick={() => setChecklist(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                              whileTap={{ scale: 0.98 }}
                              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 text-left cursor-pointer ${
                                checked ? 'bg-emerald-500/[0.08] border-emerald-500/25' : 'bg-white/[0.03] border-white/5 hover:border-white/10'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                                checked ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'
                              }`}>
                                {checked && (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </motion.div>
                                )}
                              </div>
                              <span className={`text-[11px] font-bold uppercase tracking-wide transition-all ${
                                checked ? 'text-emerald-400 line-through opacity-60' : 'text-slate-400'
                              }`}>
                                {item.label}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {/* TAB: OBSERVAÇÕES */}
                    {tab === 'observacoes' && podeVerObs && (
                      <div className="p-6 space-y-4">
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                          <Eye size={12} className="text-amber-400 shrink-0" />
                          <p className="text-[9px] font-bold text-amber-400/80 uppercase tracking-wide">
                            Visível apenas para RH, Financeiro e Admin
                          </p>
                        </div>
                        <textarea
                          value={obsInternas}
                          onChange={e => setObsInternas(e.target.value)}
                          placeholder="Observações internas sobre o colaborador..."
                          rows={12}
                          className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-[11px] font-bold text-white placeholder:text-slate-700 focus:border-indigo-500/40 outline-none resize-none leading-relaxed"
                        />
                        <div className="flex justify-end">
                          <button onClick={() => void handleSaveDados()} disabled={saving}
                            className="flex items-center gap-2 h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-50">
                            {saving ? 'Salvando...' : 'Salvar Observações'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB: SENHA — Admin only */}
                    {tab === 'senha' && currentUserRole === 'Admin' && (
                      <div className="p-6 space-y-6">
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                          <KeyRound size={12} className="text-red-400 shrink-0" />
                          <p className="text-[9px] font-bold text-red-400/80 uppercase tracking-wide">
                            Visível apenas para Admin · Senha antiga não é necessária
                          </p>
                        </div>

                        <div className="space-y-4 max-w-sm">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">
                              Nova Senha
                            </label>
                            <input
                              type="password"
                              value={novaSenha}
                              onChange={e => setNovaSenha(e.target.value)}
                              placeholder="Mínimo 6 caracteres"
                              className="w-full h-10 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 text-sm text-white placeholder:text-slate-700 focus:border-red-500/40 outline-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">
                              Confirmar Nova Senha
                            </label>
                            <input
                              type="password"
                              value={confirmarSenha}
                              onChange={e => setConfirmarSenha(e.target.value)}
                              placeholder="Repita a nova senha"
                              className="w-full h-10 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 text-sm text-white placeholder:text-slate-700 focus:border-red-500/40 outline-none"
                            />
                          </div>

                          {novaSenha && confirmarSenha && novaSenha !== confirmarSenha && (
                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">
                              Senhas não coincidem
                            </p>
                          )}

                          <button
                            onClick={() => void handleSalvarSenha()}
                            disabled={salvandoSenha || !novaSenha || !confirmarSenha}
                            className="flex items-center gap-2 h-10 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-40 transition-colors"
                          >
                            <KeyRound size={13} />
                            {salvandoSenha ? 'Salvando...' : 'Alterar Senha'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
