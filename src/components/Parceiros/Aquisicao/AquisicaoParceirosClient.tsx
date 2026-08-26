"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Star, CalendarClock, Building2, MapPin } from "lucide-react";
import { getTema } from "@/lib/temas";
import {
  CriarLeadAquisicaoParceiro,
  MoverLeadAquisicaoParceiro,
  RegistrarSaidaLateralLeadAquisicao,
  AtualizarPotencialLeadAquisicao,
  RegistrarProximaAcaoLeadAquisicao,
  PromoverLeadParaParceiro,
  ListarLeadsAquisicaoParceiros,
} from "@/actions/parceiros-aquisicao";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Permissao = { isAdmin: boolean; podeEditar: boolean; podeExcluir: boolean; podeAprovar: boolean };
type Lead = Awaited<ReturnType<typeof ListarLeadsAquisicaoParceiros>>["leads"][number];
type Responsavel = { id: number; nome: string };

const ETAPAS: { status: string; label: string }[] = [
  { status: "NOVO_LEAD", label: "Novo Lead" },
  { status: "EM_PROSPECCAO", label: "Em Prospecção" },
  { status: "CONTATO_REALIZADO", label: "Contato Realizado" },
  { status: "EM_QUALIFICACAO", label: "Em Qualificação" },
  { status: "REUNIAO_AGENDADA", label: "Reunião Agendada" },
  { status: "REUNIAO_REALIZADA", label: "Reunião Realizada" },
  { status: "NEGOCIACAO_FOLLOWUP", label: "Negociação / Follow-up" },
  { status: "AGUARDANDO_CADASTRO", label: "Aguardando Cadastro" },
  { status: "PRE_CADASTRO", label: "Pré-cadastro" },
];

const SAIDAS: { status: string; label: string }[] = [
  { status: "STANDBY", label: "Stand-by" },
  { status: "SEM_PERFIL", label: "Sem Perfil" },
  { status: "PERDIDO", label: "Perdido" },
];

function PotencialBadge({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-[10px] text-slate-500">Sem score</span>;
  return (
    <div className="flex items-center gap-0.5" title={`Potencial de recorrência: ${valor}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={11} className={i < valor ? "fill-amber-400 text-amber-400" : "text-slate-700"} />
      ))}
    </div>
  );
}

export default function AquisicaoParceirosClient({
  temaName,
  permissao,
  leadsIniciais,
  responsaveis,
}: {
  temaName: string;
  permissao: Permissao;
  leadsIniciais: Lead[];
  responsaveis: Responsavel[];
}) {
  const tema = getTema(temaName);
  const accent = tema.accent;
  const [leads, setLeads] = useState<Lead[]>(leadsIniciais);
  const [novoLeadOpen, setNovoLeadOpen] = useState(false);
  const [leadFoco, setLeadFoco] = useState<Lead | null>(null);
  const [isPending, startTransition] = useTransition();

  const podeEditar = permissao.isAdmin || permissao.podeEditar;

  async function recarregar() {
    const r = await ListarLeadsAquisicaoParceiros();
    if (r.success) setLeads(r.leads);
  }

  const colunas = useMemo(() => {
    return [...ETAPAS, ...SAIDAS].map((col) => ({
      ...col,
      itens: leads.filter((l) => l.status === col.status),
    }));
  }, [leads]);

  return (
    <div className="min-h-screen w-full" style={{ background: "#05070d" }}>
      <header className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <Link href="/PainelAlpha/Parceiros" className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white transition-colors" style={{ background: "rgba(255,255,255,0.05)" }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-black text-slate-100">Aquisição de Parceiros</h1>
            <p className="text-[11px] text-slate-500">Funil de potencial parceiro até o cadastro formal — {leads.length} em andamento</p>
          </div>
        </div>
        {podeEditar && (
          <button
            onClick={() => setNovoLeadOpen(true)}
            className="h-10 px-4 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest text-black hover:brightness-110 transition-all"
            style={{ background: `rgba(${accent},1)` }}
          >
            <Plus size={15} strokeWidth={2.6} /> Novo Lead
          </button>
        )}
      </header>

      <div className="p-6 flex gap-3 overflow-x-auto">
        {colunas.map((col) => (
          <div key={col.status} className="shrink-0 w-[280px] flex flex-col">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{col.label}</span>
              <span className="text-[10px] font-bold text-slate-500 rounded-full px-2 py-0.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                {col.itens.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 min-h-[80px]">
              {col.itens.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setLeadFoco(lead)}
                  className="w-full text-left rounded-xl p-3 transition-all hover:brightness-110"
                  style={{ background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.18)` }}
                >
                  <p className="text-[12.5px] font-bold text-slate-200 truncate">{lead.nome}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                    {lead.segmento && <span className="flex items-center gap-1"><Building2 size={10} /> {lead.segmento}</span>}
                    {lead.uf && <span className="flex items-center gap-1"><MapPin size={10} /> {lead.uf}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <PotencialBadge valor={lead.potencialRecorrencia} />
                    {lead.proximaAcaoEm && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <CalendarClock size={11} /> {new Date(lead.proximaAcaoEm).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                  {lead.responsavel && (
                    <p className="text-[10px] text-slate-600 mt-1.5 truncate">Resp.: {lead.responsavel.nome}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {novoLeadOpen && (
        <NovoLeadDialog
          accent={accent}
          responsaveis={responsaveis}
          onClose={() => setNovoLeadOpen(false)}
          onCriado={() => {
            setNovoLeadOpen(false);
            startTransition(() => void recarregar());
          }}
        />
      )}

      {leadFoco && (
        <LeadDetalheDialog
          lead={leadFoco}
          accent={accent}
          podeEditar={podeEditar}
          onClose={() => setLeadFoco(null)}
          onAtualizado={() => {
            setLeadFoco(null);
            startTransition(() => void recarregar());
          }}
        />
      )}

      {isPending && (
        <div className="fixed bottom-4 right-4 text-[11px] text-slate-500 px-3 py-1.5 rounded-full" style={{ background: "rgba(15,23,42,0.9)" }}>
          Atualizando...
        </div>
      )}
    </div>
  );
}

function NovoLeadDialog({
  accent,
  responsaveis,
  onClose,
  onCriado,
}: {
  accent: string;
  responsaveis: Responsavel[];
  onClose: () => void;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"PF" | "PJ" | "">("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [segmento, setSegmento] = useState("");
  const [origem, setOrigem] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSalvando(true);
    const r = await CriarLeadAquisicaoParceiro({
      nome: nome.trim(),
      tipo: tipo || undefined,
      email: email || undefined,
      telefone: telefone || undefined,
      segmento: segmento || undefined,
      origem: origem || undefined,
      cidade: cidade || undefined,
      uf: uf || undefined,
      responsavelId: responsavelId ? Number(responsavelId) : undefined,
    });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Lead criado");
    onCriado();
  }

  const inputCls = "w-full h-10 rounded-xl px-3 text-[12px] outline-none text-slate-200";
  const inputStyle = { background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)` };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#0a1020] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Novo lead de aquisição</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome *" className={inputCls} style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={tipo} onValueChange={(v) => setTipo(v as "PF" | "PJ")}>
              <SelectTrigger className={inputCls} style={inputStyle}><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent><SelectItem value="PF">Pessoa Física</SelectItem><SelectItem value="PJ">Pessoa Jurídica</SelectItem></SelectContent>
            </Select>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone" className={inputCls} style={inputStyle} />
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={inputCls} style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Segmento" className={inputCls} style={inputStyle} />
            <input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Origem" className={inputCls} style={inputStyle} />
          </div>
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" className={inputCls} style={inputStyle} />
            <input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="UF" className={inputCls} style={inputStyle} />
          </div>
          {responsaveis.length > 0 && (
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger className={inputCls} style={inputStyle}><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                {responsaveis.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <button
            onClick={() => void salvar()}
            disabled={salvando}
            className="w-full h-11 rounded-xl font-black uppercase text-[11px] tracking-widest text-black disabled:opacity-50"
            style={{ background: `rgba(${accent},1)` }}
          >
            {salvando ? "Salvando..." : "Criar lead"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeadDetalheDialog({
  lead,
  accent,
  podeEditar,
  onClose,
  onAtualizado,
}: {
  lead: Lead;
  accent: string;
  podeEditar: boolean;
  onClose: () => void;
  onAtualizado: () => void;
}) {
  const [statusDestino, setStatusDestino] = useState(lead.status);
  const [potencial, setPotencial] = useState<number>(lead.potencialRecorrencia ?? 0);
  const [proximaAcaoData, setProximaAcaoData] = useState("");
  const [proximaAcaoDesc, setProximaAcaoDesc] = useState("");
  const [motivoSaida, setMotivoSaida] = useState("");
  const [saidaSelecionada, setSaidaSelecionada] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [docPromocao, setDocPromocao] = useState(lead.documento ?? "");
  const [emailPromocao, setEmailPromocao] = useState(lead.email ?? "");

  const inputCls = "w-full h-10 rounded-xl px-3 text-[12px] outline-none text-slate-200";
  const inputStyle = { background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)` };

  async function mover() {
    if (statusDestino === lead.status) return;
    setSalvando(true);
    const r = await MoverLeadAquisicaoParceiro({ leadId: lead.id, statusDestino });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Etapa atualizada");
    onAtualizado();
  }

  async function salvarPotencial() {
    setSalvando(true);
    const r = await AtualizarPotencialLeadAquisicao({ leadId: lead.id, potencialRecorrencia: potencial });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Potencial atualizado");
    onAtualizado();
  }

  async function salvarProximaAcao() {
    if (!proximaAcaoData || !proximaAcaoDesc.trim()) return toast.error("Preencha data e descrição");
    setSalvando(true);
    const r = await RegistrarProximaAcaoLeadAquisicao({ leadId: lead.id, proximaAcaoEm: proximaAcaoData, proximaAcaoDescricao: proximaAcaoDesc.trim() });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Próxima ação registrada");
    onAtualizado();
  }

  async function registrarSaida() {
    if (!saidaSelecionada) return toast.error("Selecione o motivo da saída lateral");
    if (!motivoSaida.trim()) return toast.error("Descreva o motivo");
    setSalvando(true);
    const r = await RegistrarSaidaLateralLeadAquisicao({ leadId: lead.id, status: saidaSelecionada, motivo: motivoSaida.trim() });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Saída lateral registrada");
    onAtualizado();
  }

  async function promover() {
    setSalvando(true);
    const r = await PromoverLeadParaParceiro({
      leadId: lead.id,
      documento: docPromocao || undefined,
      email: emailPromocao || undefined,
    });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Parceiro cadastrado com sucesso!");
    onAtualizado();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0a1020] border-white/10 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-100">{lead.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-[11px] text-slate-500 space-y-1">
            {lead.email && <p>E-mail: {lead.email}</p>}
            {lead.telefone && <p>Telefone: {lead.telefone}</p>}
            {lead.segmento && <p>Segmento: {lead.segmento}</p>}
            {lead.origem && <p>Origem: {lead.origem}</p>}
            {lead.motivoSaidaLateral && <p className="text-amber-400">Motivo saída: {lead.motivoSaidaLateral}</p>}
          </div>

          {podeEditar && (
            <>
              <section className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mover etapa</p>
                <div className="flex gap-2">
                  <Select value={statusDestino} onValueChange={setStatusDestino}>
                    <SelectTrigger className={inputCls} style={inputStyle}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ETAPAS.map((e) => <SelectItem key={e.status} value={e.status}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button onClick={() => void mover()} disabled={salvando} className="h-10 px-4 rounded-xl text-[11px] font-bold text-black shrink-0" style={{ background: `rgba(${accent},1)` }}>
                    Mover
                  </button>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Potencial de recorrência (0-5)</p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setPotencial(n)} className="h-8 w-8 rounded-lg text-[11px] font-bold" style={{ background: potencial === n ? `rgba(${accent},0.4)` : "rgba(255,255,255,0.05)", color: potencial === n ? "#fff" : "#94a3b8" }}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => void salvarPotencial()} disabled={salvando} className="h-8 px-3 rounded-lg text-[10px] font-bold text-black" style={{ background: `rgba(${accent},1)` }}>Salvar</button>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Próxima ação</p>
                <div className="grid grid-cols-[130px_1fr] gap-2">
                  <input type="date" value={proximaAcaoData} onChange={(e) => setProximaAcaoData(e.target.value)} className={inputCls} style={inputStyle} />
                  <input value={proximaAcaoDesc} onChange={(e) => setProximaAcaoDesc(e.target.value)} placeholder="Ex: Ligação, WhatsApp..." className={inputCls} style={inputStyle} />
                </div>
                <button onClick={() => void salvarProximaAcao()} disabled={salvando} className="h-9 px-4 rounded-xl text-[11px] font-bold text-black" style={{ background: `rgba(${accent},1)` }}>Registrar</button>
              </section>

              {lead.status !== "PRE_CADASTRO" ? null : (
                <section className="space-y-2 p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)" }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Promover a parceiro cadastrado</p>
                  <input value={docPromocao} onChange={(e) => setDocPromocao(e.target.value)} placeholder="CPF/CNPJ *" className={inputCls} style={inputStyle} />
                  <input value={emailPromocao} onChange={(e) => setEmailPromocao(e.target.value)} placeholder="E-mail *" className={inputCls} style={inputStyle} />
                  <button onClick={() => void promover()} disabled={salvando} className="w-full h-10 rounded-xl text-[11px] font-black uppercase tracking-widest text-white" style={{ background: "rgb(16,185,129)" }}>
                    Cadastrar Parceiro
                  </button>
                </section>
              )}

              <section className="space-y-2 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Saída lateral</p>
                <Select value={saidaSelecionada} onValueChange={setSaidaSelecionada}>
                  <SelectTrigger className={inputCls} style={inputStyle}><SelectValue placeholder="Motivo" /></SelectTrigger>
                  <SelectContent>
                    {SAIDAS.map((s) => <SelectItem key={s.status} value={s.status}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <textarea value={motivoSaida} onChange={(e) => setMotivoSaida(e.target.value)} placeholder="Descreva o motivo..." className="w-full min-h-16 rounded-xl px-3 py-2 text-[12px] outline-none text-slate-200 resize-none" style={inputStyle} />
                <button onClick={() => void registrarSaida()} disabled={salvando} className="w-full h-9 rounded-xl text-[11px] font-bold text-red-300" style={{ background: "rgba(239,68,68,0.15)" }}>
                  Registrar saída
                </button>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
