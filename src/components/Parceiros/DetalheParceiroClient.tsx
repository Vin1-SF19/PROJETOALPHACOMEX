"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, User, Mail, Phone, MapPin, CreditCard, ShieldCheck,
  Pencil, X, Loader2, Save, Sparkles, Unlink, ChevronDown, Receipt, FileCheck2, Calendar,
  CheckCircle2, Clock, TrendingUp, MessageSquareText, Plus, Trash2, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { editarParceiro, desvincularIndicacao, gerarMensagemLoginParceiro } from "@/actions/parceiros";
import type { ObterIndicadoresDesenvolvimentoParceiro, ListarHistoricoParceiro } from "@/actions/parceiros-desenvolvimento";
import type { ListarIndicacoesDoParceiro } from "@/actions/parceiros-indicacoes";
import { getTema } from "@/lib/temas";
import { TRIBUTOS } from "@/lib/tributos";
import TrocarSenhaParceiro from "./TrocarSenhaParceiro";
import ModalComprovante from "./ModalComprovante";
import ModalCredenciais from "./ModalCredenciais";
import Relacionamento360Section from "./Relacionamento360Section";
import {
  criarFormularioResponsaveis,
  criarResponsavelVazio,
  formatarCpf,
  montarPayloadResponsaveis,
  type RepresentantePersistido,
  type ResponsavelForm,
} from "./responsaveis-form";

type Endereco = { cep: string; logradouro: string; numero: string | null; complemento: string | null; bairro: string; cidade: string; uf: string };
type Indicacao = {
  id: number;
  comprovanteUrl: string | null;
  comprovanteNome: string | null;
  comprovanteTipo: string | null;
  comprovanteEnviadoEm: Date | string | null;
  comprovanteEnviadoPor: string | null;
  cliente: {
    id: number; razaoSocial: string; nomeFantasia: string | null; cnpj: string;
    dataConstituicao: string | null; dataContratacao: string | null; uf: string | null; regimeTributario: string | null; status: string | null;
    servico: string | null; valorContrato: number | null; receitaLiquida: number | null; comissaoValor: number | null;
    comissaoPercentual: number | null;
  };
};

export type DetalheParceiro = {
  id: number; tipo: string; documento: string; nome: string; nomeFantasia: string | null;
  dataNascimento: string | null;
  sobre: string | null;
  email: string; telefone: string | null; telefone2: string | null;
  chavePix: string | null; tipoChavePix: string | null;
  nomeBanco: string | null; agencia: string | null; conta: string | null;
  pixConfirmado: boolean; nivel: string;
  tipoParceiro: string;
  comissaoPercentual: number | null; loginEmail: string;
  endereco: Endereco | null; representantes: RepresentantePersistido[]; indicacoes: Indicacao[];
};

const NIVEL_COLOR: Record<string, string> = {
  GOLD: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  PLATINUM: "text-slate-300 border-slate-400/40 bg-slate-400/10",
  BLACK: "text-white border-white/20 bg-black",
};
const NIVEL_ICON: Record<string, string> = { GOLD: "★", PLATINUM: "◆", BLACK: "■" };
const COMISSAO_POR_NIVEL: Record<string, number> = { GOLD: 5, PLATINUM: 10, BLACK: 15 };

/** Formata datas do CS&NPS (ISO, YYYY-MM-DD ou DD/MM/AAAA) para DD/MM/AAAA. */
function fmtDataBR(valor: string | null | undefined): string {
  if (!valor) return "";
  const v = valor.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v; // já está em BR
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  }
  return v;
}

function fmtBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type TemplateOnboarding = { id: number; nome: string; mensagem: string };

export default function DetalheParceiroClient({
  parceiro, permissao, temaName = "blue", template, relacionamento360,
}: {
  parceiro: DetalheParceiro;
  permissao: { isAdmin: boolean; podeEditar: boolean; podeExcluir: boolean };
  temaName?: string;
  template?: TemplateOnboarding | null;
  relacionamento360?: {
    estagioDesenvolvimento: string;
    potencialRecorrencia: number | null;
    segmento: string | null;
    origem: string | null;
    responsavelNome: string | null;
    indicadores: Awaited<ReturnType<typeof ObterIndicadoresDesenvolvimentoParceiro>>;
    historico: Awaited<ReturnType<typeof ListarHistoricoParceiro>>["historico"];
    indicacoesFunil: Awaited<ReturnType<typeof ListarIndicacoesDoParceiro>>["indicacoes"];
  };
}) {
  const router = useRouter();
  const tema = getTema(temaName);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregandoLogin, setCarregandoLogin] = useState(false);
  const [modalLogin, setModalLogin] = useState<{ loginEmail: string; senhaGerada: string; nomeParceiro: string } | null>(null);

  // Empresa indicada — expande os dados já salvos no CS&NPS (sem gastar API)
  const [empresaAberta, setEmpresaAberta] = useState<number | null>(null);
  const toggleEmpresa = (indId: number) => setEmpresaAberta(prev => (prev === indId ? null : indId));

  // Comprovante de comissão por indicação
  const [comprovanteInd, setComprovanteInd] = useState<Indicacao | null>(null);

  // form
  const [nome, setNome] = useState(parceiro.nome);
  const [nomeFantasia, setNomeFantasia] = useState(parceiro.nomeFantasia ?? "");
  const [dataNascimento, setDataNascimento] = useState(parceiro.dataNascimento ?? "");
  const [sobre, setSobre] = useState(parceiro.sobre ?? "");
  const [email, setEmail] = useState(parceiro.email);
  const [telefone] = useState(parceiro.telefone ?? "");
  const [telefone2, setTelefone2] = useState(parceiro.telefone2 ?? "");
  const [chavePix, setChavePix] = useState(parceiro.chavePix ?? "");
  const [tipoChavePix, setTipoChavePix] = useState(parceiro.tipoChavePix ?? "");
  const [nomeBanco, setNomeBanco] = useState(parceiro.nomeBanco ?? "");
  const [agencia, setAgencia] = useState(parceiro.agencia ?? "");
  const [conta, setConta] = useState(parceiro.conta ?? "");
  const [tipoParceiro, setTipoParceiro] = useState<"PADRAO" | "SEM_COMISSAO" | "ESPECIAL">(
    (parceiro.tipoParceiro as "PADRAO" | "SEM_COMISSAO" | "ESPECIAL") ?? "PADRAO",
  );
  const comissaoFixaInicial = parceiro.tipoParceiro === "ESPECIAL" && parceiro.comissaoPercentual != null ? parceiro.comissaoPercentual : null;
  const [comissaoFixaOpcao, setComissaoFixaOpcao] = useState<string>(
    comissaoFixaInicial !== null && ["5", "10", "15", "20", "25", "30"].includes(String(comissaoFixaInicial))
      ? String(comissaoFixaInicial)
      : comissaoFixaInicial !== null ? "outro" : "5",
  );
  const [comissaoFixaOutro, setComissaoFixaOutro] = useState(
    comissaoFixaInicial !== null && !["5", "10", "15", "20", "25", "30"].includes(String(comissaoFixaInicial))
      ? String(comissaoFixaInicial)
      : "",
  );
  const [end, setEnd] = useState<Endereco>(parceiro.endereco ?? { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });
  const [responsaveis, setResponsaveis] = useState<ResponsavelForm[]>(() =>
    criarFormularioResponsaveis(parceiro.representantes),
  );
  const [responsavelAbertoIdx, setResponsavelAbertoIdx] = useState(0);

  const atualizarResponsavel = (indice: number, campo: keyof ResponsavelForm, valor: string) => {
    setResponsaveis((atuais) =>
      atuais.map((responsavel, i) => i === indice ? { ...responsavel, [campo]: valor } : responsavel),
    );
  };

  const adicionarResponsavel = () => {
    setResponsaveis((atuais) => [...atuais, criarResponsavelVazio()]);
    setResponsavelAbertoIdx(responsaveis.length);
  };

  const removerResponsavel = (indice: number) => {
    setResponsaveis((atuais) => atuais.filter((_, i) => i !== indice));
    setResponsavelAbertoIdx(-1);
  };

  const restaurarResponsaveisPersistidos = () => {
    setResponsaveis(criarFormularioResponsaveis(parceiro.representantes));
    setResponsavelAbertoIdx(0);
  };

  const iniciarEdicao = () => {
    restaurarResponsaveisPersistidos();
    setEditando(true);
  };

  const cancelarEdicao = () => {
    restaurarResponsaveisPersistidos();
    setEditando(false);
  };

  function fmtDoc(doc: string): string {
    const d = doc.replace(/\D/g, "");
    if (parceiro.tipo === "PJ" && d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    if (parceiro.tipo === "PF" && d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return doc;
  }

  const comissaoEfetiva = parceiro.tipoParceiro === "SEM_COMISSAO"
    ? null
    : parceiro.comissaoPercentual ?? COMISSAO_POR_NIVEL[parceiro.nivel] ?? 5;

  const TIPO_PARCEIRO_LABEL: Record<string, string> = { PADRAO: "Padrão", SEM_COMISSAO: "Sem Comissão", ESPECIAL: "Especial" };

  const salvar = async () => {
    if (!nome.trim() || !email.trim()) { toast.error("Nome e e-mail são obrigatórios"); return; }
    const responsaveisParaSalvar = parceiro.tipo === "PJ"
      ? montarPayloadResponsaveis(responsaveis)
      : undefined;
    if (parceiro.tipo === "PJ" && responsaveisParaSalvar?.length === 0) {
      toast.error("Informe ao menos um responsável com nome");
      return;
    }
    if (tipoParceiro === "ESPECIAL" && comissaoFixaOpcao === "outro" && !comissaoFixaOutro) {
      toast.error("Informe o valor da comissão fixa");
      return;
    }
    const comissaoPercentual = tipoParceiro === "ESPECIAL"
      ? Number(comissaoFixaOpcao === "outro" ? comissaoFixaOutro : comissaoFixaOpcao)
      : null;

    setSalvando(true);
    const res = await editarParceiro(parceiro.id, {
      nome, nomeFantasia: nomeFantasia || null,
      dataNascimento: parceiro.tipo === "PF" ? (dataNascimento || null) : null,
      sobre: sobre || null,
      email,
      telefone: telefone || null, telefone2: telefone2 || null,
      chavePix: chavePix || null,
      tipoChavePix: (tipoChavePix as "cpf" | "cnpj" | "email" | "telefone" | "aleatoria") || null,
      nomeBanco: nomeBanco || null,
      agencia: agencia || null,
      conta: conta || null,
      tipoParceiro,
      comissaoPercentual,
      endereco: end.cep && end.logradouro && end.bairro && end.cidade && end.uf
        ? { cep: end.cep, logradouro: end.logradouro, numero: end.numero || undefined, complemento: end.complemento || undefined, bairro: end.bairro, cidade: end.cidade, uf: end.uf }
        : undefined,
      responsaveis: responsaveisParaSalvar,
    });
    setSalvando(false);
    if (res.success) { toast.success("Parceiro atualizado"); setEditando(false); router.refresh(); }
    else toast.error(res.error ?? "Erro ao salvar");
  };

  const desvincular = async (indicacaoId: number) => {
    if (!confirm("Desvincular esta indicação? O nível do parceiro será recalculado.")) return;
    const res = await desvincularIndicacao(indicacaoId);
    if (res.success) { toast.success("Indicação desvinculada"); router.refresh(); }
    else toast.error(res.error ?? "Erro");
  };

  const verLogin = async () => {
    setCarregandoLogin(true);
    const res = await gerarMensagemLoginParceiro(parceiro.id);
    setCarregandoLogin(false);
    if (res.success) {
      setModalLogin({ loginEmail: res.loginEmail, senhaGerada: res.senhaGerada, nomeParceiro: res.nomeParceiro });
    } else {
      toast.error(res.error ?? "Erro ao gerar a mensagem de login");
    }
  };

  const cardCls = "bg-slate-900/40 border border-white/5 rounded-[2rem] p-6 space-y-4";
  const inputCls = "w-full bg-black/40 border border-white/10 rounded-xl h-11 px-3 text-sm text-white outline-none focus:border-white/30";
  const labelCls = "text-[9px] text-slate-600 uppercase tracking-widest font-bold";

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 p-6 lg:p-10">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="flex items-center gap-4">
          <Link href="/PainelAlpha/Parceiros" className="p-2 text-slate-500 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black uppercase italic tracking-tight text-white line-clamp-1">{parceiro.nome}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${NIVEL_COLOR[parceiro.nivel] ?? NIVEL_COLOR.GOLD}`}>
                {NIVEL_ICON[parceiro.nivel] ?? "★"} {parceiro.nivel}{comissaoEfetiva !== null ? ` · ${comissaoEfetiva}%` : ""}
              </span>
              {parceiro.tipoParceiro !== "PADRAO" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest text-slate-300 border-white/20 bg-white/5">
                  {TIPO_PARCEIRO_LABEL[parceiro.tipoParceiro] ?? parceiro.tipoParceiro}
                </span>
              )}
            </div>
          </div>
          {/* Lápis — só quem pode editar */}
          {(permissao.podeEditar) && !editando && (
            <button onClick={iniciarEdicao} title="Editar"
              className="h-10 px-3 flex items-center gap-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest text-white"
              style={{ background: `rgba(${tema.accent}, 0.85)` }}>
              <Pencil size={13} /> Editar
            </button>
          )}
          {editando && (
            <div className="flex items-center gap-2">
              <button onClick={cancelarEdicao} className="h-10 px-3 flex items-center gap-1.5 rounded-xl text-[10px] font-bold text-slate-300 bg-white/5"><X size={13} /> Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="h-10 px-3 flex items-center gap-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest text-white disabled:opacity-50" style={{ background: `rgba(${tema.accent}, 1)` }}>
                {salvando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar
              </button>
            </div>
          )}
        </div>

        {/* Relacionamento, indicadores, funil comercial e histórico (Fase 07 — tela 360º) */}
        {relacionamento360 && (
          <Relacionamento360Section
            parceiroId={parceiro.id}
            estagioDesenvolvimento={relacionamento360.estagioDesenvolvimento}
            potencialRecorrenciaInicial={relacionamento360.potencialRecorrencia}
            responsavelNome={relacionamento360.responsavelNome}
            segmento={relacionamento360.segmento}
            origem={relacionamento360.origem}
            indicadores={relacionamento360.indicadores}
            historico={relacionamento360.historico}
            indicacoesFunil={relacionamento360.indicacoesFunil}
            podeEditar={permissao.podeEditar}
            accent={tema.accent}
            cardCls={cardCls}
          />
        )}

        {/* Indicações */}
        {parceiro.indicacoes.length > 0 && (
          <div className={cardCls}>
            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#a5b4fc" }}>
              <Sparkles size={11} /> Empresas indicadas ({parceiro.indicacoes.length})
            </p>
            <div className="space-y-2">
              {parceiro.indicacoes.map(ind => {
                const aberto = empresaAberta === ind.id;
                const c = ind.cliente;
                const formatarDoc = (d: string) => d.replace(/\D/g, "").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
                const dtContratacao = fmtDataBR(c.dataContratacao);
                return (
                  <div key={ind.id} className="rounded-xl overflow-hidden" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <button onClick={() => toggleEmpresa(ind.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <Building2 size={14} className="text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-bold text-slate-200 truncate">{c.razaoSocial}</p>
                          <p className="text-[10px] text-slate-500 truncate"><span className="font-mono">{formatarDoc(c.cnpj)}</span>{c.nomeFantasia ? ` · ${c.nomeFantasia}` : ""}</p>
                          {dtContratacao && (
                            <p className="text-[10px] mt-0.5 font-bold flex items-center gap-1" style={{ color: "#34d399" }}>
                              <Calendar size={9} /> Contratado em {dtContratacao}
                            </p>
                          )}
                        </div>
                        <ChevronDown size={15} className={`shrink-0 text-slate-500 transition-transform ${aberto ? "rotate-180" : ""}`} />
                      </button>

                      {/* Comprovante de comissão — Admin/podeEditar */}
                      {(permissao.isAdmin || permissao.podeEditar) && (
                        <button
                          onClick={() => setComprovanteInd(ind)}
                          title={ind.comprovanteUrl ? "Comprovante enviado — clique para substituir" : "Enviar comprovante de comissão"}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shrink-0 transition-colors ${
                            ind.comprovanteUrl
                              ? "text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                              : "text-slate-400 bg-white/5 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {ind.comprovanteUrl ? <FileCheck2 size={12} /> : <Receipt size={12} />}
                          <span className="hidden sm:inline">{ind.comprovanteUrl ? "Enviado" : "Comprovante"}</span>
                        </button>
                      )}

                      {permissao.isAdmin && (
                        <button onClick={() => desvincular(ind.id)} title="Desvincular (Admin)" className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 shrink-0">
                          <Unlink size={13} />
                        </button>
                      )}
                    </div>

                    {/* Dados já salvos no CS&NPS (sem nova consulta à API) */}
                    {aberto && (
                      <div className="px-3 pb-3 pt-2 border-t grid grid-cols-2 gap-x-4 gap-y-2.5" style={{ borderColor: "rgba(99,102,241,0.15)" }}>
                        {[
                          ["CNPJ", formatarDoc(c.cnpj), true],
                          ["Razão Social", c.razaoSocial, false],
                          ["Nome Fantasia", c.nomeFantasia || "—", false],
                          ["Data de Constituição", fmtDataBR(c.dataConstituicao) || "—", false],
                          ["Data Contratação", dtContratacao || "—", false],
                          ["UF", c.uf || "—", false],
                          ["Regime Tributário", c.regimeTributario || "—", false],
                          ["Status (CS&NPS)", c.status || "—", false],
                          ["Serviço Contratado", c.servico || "—", false],
                          ["Valor do Contrato", c.valorContrato != null ? fmtBRL(c.valorContrato) : "—", false],
                        ].map(([rotulo, valor, mono], i) => (
                          <div key={i}>
                            <p className="text-[8.5px] text-slate-600 uppercase tracking-widest font-bold">{rotulo as string}</p>
                            <p className={`text-[12px] font-bold text-slate-200 ${mono ? "font-mono" : ""}`}>{valor as string}</p>
                          </div>
                        ))}

                        {/* Comissão que o parceiro recebe por essa indicação — usa o nível que ele tinha
                            NO MOMENTO desta contratação (não o nível atual), em destaque com tooltip */}
                        {c.valorContrato !== null && c.receitaLiquida !== null && c.comissaoValor !== null && c.comissaoPercentual !== null && (
                          <div className="col-span-2">
                            <ComissaoParceiroDetalhe
                              valorContrato={c.valorContrato}
                              receitaLiquida={c.receitaLiquida}
                              comissaoValor={c.comissaoValor}
                              servico={c.servico}
                              comissaoPercentual={c.comissaoPercentual}
                              accent={tema.accent}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dados cadastrais */}
        <div className={cardCls}>
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Dados cadastrais</p>
          {!editando ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <p className={`${labelCls} flex items-center gap-1`}>{parceiro.tipo === "PJ" ? <Building2 size={9} /> : <User size={9} />} {parceiro.tipo === "PJ" ? "Razão Social" : "Nome"}</p>
                <p className="font-black text-white">{parceiro.nome}</p>
              </div>
              <div>
                <p className={`${labelCls} flex items-center gap-1`}>{parceiro.tipo === "PJ" ? <Building2 size={9} /> : <User size={9} />} Tipo</p>
                <p className="font-black text-white">{parceiro.tipo === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}</p>
              </div>
              <div>
                <p className={`${labelCls} flex items-center gap-1`}><ShieldCheck size={9} /> Documento</p>
                <p className="font-mono font-bold text-white">{fmtDoc(parceiro.documento)}</p>
              </div>
              {parceiro.tipo === "PF" && parceiro.dataNascimento && (
                <div>
                  <p className={`${labelCls} flex items-center gap-1`}><Calendar size={9} /> Nascimento</p>
                  <p className="font-bold text-white">{fmtDataBR(parceiro.dataNascimento)}</p>
                </div>
              )}
              <div className="col-span-2">
                <p className={`${labelCls} flex items-center gap-1`}><Mail size={9} /> E-mail</p>
                <p className="font-bold text-white">{parceiro.email}</p>
              </div>
              {parceiro.telefone2 && (
                <div>
                  <p className={`${labelCls} flex items-center gap-1`}><Phone size={9} /> Whatsapp</p>
                  <p className="font-bold text-white">{parceiro.telefone2}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div><p className={labelCls}>{parceiro.tipo === "PJ" ? "Razão Social" : "Nome"}</p><input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} /></div>
              {parceiro.tipo === "PJ" && <div><p className={labelCls}>Nome Fantasia</p><input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} className={inputCls} /></div>}
              {parceiro.tipo === "PF" && <div><p className={labelCls}>Data de Nascimento</p><input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={inputCls} /></div>}
              <div><p className={labelCls}>E-mail</p><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                 <div><p className={labelCls}>Whatsapp</p><input value={telefone2} onChange={e => setTelefone2(e.target.value)} placeholder="(00) 00000-0000" className={inputCls} /></div>
              </div>
              <div>
                <p className={labelCls}>Tipo de Parceiro</p>
                <select value={tipoParceiro} onChange={e => setTipoParceiro(e.target.value as typeof tipoParceiro)} className={inputCls}>
                  <option value="PADRAO">Padrão</option>
                  <option value="SEM_COMISSAO">Sem Comissão</option>
                  <option value="ESPECIAL">Especial</option>
                </select>
              </div>
              {tipoParceiro === "ESPECIAL" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className={labelCls}>Comissão fixa (%)</p>
                    <select value={comissaoFixaOpcao} onChange={e => setComissaoFixaOpcao(e.target.value)} className={inputCls}>
                      {["5", "10", "15", "20", "25", "30", "outro"].map(v => (
                        <option key={v} value={v}>{v === "outro" ? "Outro valor" : `${v}%`}</option>
                      ))}
                    </select>
                  </div>
                  {comissaoFixaOpcao === "outro" && (
                    <div>
                      <p className={labelCls}>Valor (%)</p>
                      <input type="number" min={0} max={100} step="0.5" value={comissaoFixaOutro} onChange={e => setComissaoFixaOutro(e.target.value)} placeholder="Ex: 12.5" className={inputCls} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sobre — texto livre herdado do pré-cadastro ("fale mais sobre você/sua empresa") */}
        {(editando || parceiro.sobre) && (
          <div className={cardCls}>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5"><MessageSquareText size={10} /> Sobre</p>
            {!editando ? (
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{parceiro.sobre}</p>
            ) : (
              <textarea
                value={sobre}
                onChange={e => setSobre(e.target.value)}
                rows={4}
                placeholder="Fale mais sobre o parceiro/sua empresa..."
                className={`${inputCls} h-auto py-2.5 resize-none`}
              />
            )}
          </div>
        )}

        {/* Dados Bancários — Pix + banco/agência/conta (complementares) */}
        <div className={cardCls}>
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5"><CreditCard size={10} /> Dados Bancários</p>
          {!editando ? (
            (parceiro.chavePix || parceiro.nomeBanco || parceiro.agencia || parceiro.conta) ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {parceiro.nomeBanco && (
                  <div className="col-span-2">
                    <p className={labelCls}>Banco</p>
                    <p className="font-bold text-white">{parceiro.nomeBanco}</p>
                  </div>
                )}
                {parceiro.agencia && (
                  <div>
                    <p className={labelCls}>Agência</p>
                    <p className="font-mono font-bold text-white">{parceiro.agencia}</p>
                  </div>
                )}
                {parceiro.conta && (
                  <div>
                    <p className={labelCls}>Conta</p>
                    <p className="font-mono font-bold text-white">{parceiro.conta}</p>
                  </div>
                )}
                {parceiro.chavePix && (
                  <div className="col-span-2">
                    <p className={`${labelCls} flex items-center gap-1`}>Chave Pix ({parceiro.tipoChavePix})</p>
                    <p className="font-mono font-bold text-white">{parceiro.chavePix}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
                      parceiro.pixConfirmado
                        ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
                        : "text-amber-400 border-amber-500/40 bg-amber-500/10"
                    }`}
                  >
                    {parceiro.pixConfirmado ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                    {parceiro.pixConfirmado ? "Dados bancários confirmados pelo parceiro" : "Aguardando confirmação do parceiro"}
                  </span>
                </div>
              </div>
            ) : <p className="text-xs text-slate-600">Sem dados bancários cadastrados.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><p className={labelCls}>Nome do Banco</p><input value={nomeBanco} onChange={e => setNomeBanco(e.target.value)} className={inputCls} /></div>
                <div><p className={labelCls}>Agência</p><input value={agencia} onChange={e => setAgencia(e.target.value)} className={inputCls} /></div>
              </div>
              <div><p className={labelCls}>Conta</p><input value={conta} onChange={e => setConta(e.target.value)} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className={labelCls}>Chave Pix</p><input value={chavePix} onChange={e => setChavePix(e.target.value)} className={inputCls} /></div>
                <div><p className={labelCls}>Tipo Pix</p>
                  <select value={tipoChavePix} onChange={e => setTipoChavePix(e.target.value)} className={inputCls}>
                    <option value="">—</option>{["cpf","cnpj","email","telefone","aleatoria"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Endereço */}
        <div className={cardCls}>
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5"><MapPin size={10} /> Endereço para brindes e presentes</p>
          {!editando ? (
            parceiro.endereco ? (
              <>
                <p className="text-sm text-white font-bold">{parceiro.endereco.logradouro}{parceiro.endereco.numero ? `, ${parceiro.endereco.numero}` : ""}{parceiro.endereco.complemento ? ` — ${parceiro.endereco.complemento}` : ""}</p>
                <p className="text-xs text-slate-400">{parceiro.endereco.bairro} · {parceiro.endereco.cidade}/{parceiro.endereco.uf} · CEP {parceiro.endereco.cep}</p>
              </>
            ) : <p className="text-xs text-slate-600">Sem endereço para brindes cadastrado.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><p className={labelCls}>CEP</p><input value={end.cep} onChange={e => setEnd({ ...end, cep: e.target.value })} className={inputCls} /></div>
                <div><p className={labelCls}>UF</p><input value={end.uf} maxLength={2} onChange={e => setEnd({ ...end, uf: e.target.value.toUpperCase() })} className={inputCls} /></div>
              </div>
              <div><p className={labelCls}>Logradouro</p><input value={end.logradouro} onChange={e => setEnd({ ...end, logradouro: e.target.value })} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className={labelCls}>Número</p><input value={end.numero ?? ""} onChange={e => setEnd({ ...end, numero: e.target.value })} className={inputCls} /></div>
                <div><p className={labelCls}>Complemento</p><input value={end.complemento ?? ""} onChange={e => setEnd({ ...end, complemento: e.target.value })} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className={labelCls}>Bairro</p><input value={end.bairro} onChange={e => setEnd({ ...end, bairro: e.target.value })} className={inputCls} /></div>
                <div><p className={labelCls}>Cidade</p><input value={end.cidade} onChange={e => setEnd({ ...end, cidade: e.target.value })} className={inputCls} /></div>
              </div>
            </div>
          )}
        </div>

        {/* Responsável (PJ) */}
        {parceiro.tipo === "PJ" && (
          <div className={cardCls}>
            <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">
              Representantes{(editando ? responsaveis.length : parceiro.representantes.length) > 1
                ? ` (${editando ? responsaveis.length : parceiro.representantes.length})`
                : ""}
            </p>
            {editando ? (
              <div className="space-y-3">
                {responsaveis.map((responsavel, i) => {
                  const aberto = responsavelAbertoIdx === i;
                  const nomeValido = responsavel.nome.trim().length >= 2;
                  const responsavelCompleto = nomeValido && responsavel.whatsapp.trim().length >= 8;

                  return (
                    <div
                      key={i}
                      className="rounded-2xl overflow-hidden"
                      style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}
                    >
                      <div className="flex items-center gap-2 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setResponsavelAbertoIdx(aberto ? -1 : i)}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                        >
                          <div className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${nomeValido ? "bg-emerald-500/15" : "bg-amber-500/10"}`}>
                            <User size={13} className={nomeValido ? "text-emerald-400" : "text-amber-400"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-bold text-slate-200 truncate">
                              {responsavel.nome || `Responsável ${i + 1}`}
                            </p>
                            {nomeValido && (
                              <p className="text-[10px] text-slate-500 truncate font-mono">
                                {[responsavel.cpf, responsavel.cargo, responsavel.whatsapp].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                          <ChevronDown size={15} className={`shrink-0 text-slate-500 transition-transform ${aberto ? "rotate-180" : ""}`} />
                        </button>
                        {responsaveis.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removerResponsavel(i)}
                            title="Remover responsável"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {aberto && (
                        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-amber-500/15">
                          <div>
                            <p className={labelCls}>Nome completo *</p>
                            <input value={responsavel.nome} onChange={e => atualizarResponsavel(i, "nome", e.target.value)} className={inputCls} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className={labelCls}>CPF</p>
                              <input value={responsavel.cpf} onChange={e => atualizarResponsavel(i, "cpf", formatarCpf(e.target.value))} placeholder="000.000.000-00" className={`${inputCls} font-mono`} />
                            </div>
                            <div>
                              <p className={labelCls}>Data de nascimento</p>
                              <input type="date" value={responsavel.dataNascimento} onChange={e => atualizarResponsavel(i, "dataNascimento", e.target.value)} className={inputCls} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className={labelCls}>Cargo / relação</p>
                              <input value={responsavel.cargo} onChange={e => atualizarResponsavel(i, "cargo", e.target.value)} placeholder="Sócio, Diretor..." className={inputCls} />
                            </div>
                            <div>
                              <p className={labelCls}>WhatsApp *</p>
                              <input value={responsavel.whatsapp} onChange={e => atualizarResponsavel(i, "whatsapp", e.target.value)} placeholder="(00) 00000-0000" className={inputCls} />
                            </div>
                          </div>
                          <div>
                            <p className={labelCls}>E-mail</p>
                            <input type="email" value={responsavel.email} onChange={e => atualizarResponsavel(i, "email", e.target.value)} className={inputCls} />
                          </div>
                          <button
                            type="button"
                            disabled={!responsavelCompleto}
                            onClick={() => setResponsavelAbertoIdx(-1)}
                            className="w-full h-10 rounded-xl border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-black uppercase text-[10px] tracking-widest disabled:opacity-30"
                          >
                            Concluir responsável
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={adicionarResponsavel}
                  className="w-full h-11 rounded-xl border border-dashed border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> Adicionar responsável
                </button>
                <p className="text-[9px] text-slate-600">Nome e WhatsApp são obrigatórios.</p>
              </div>
            ) : parceiro.representantes.length === 0 ? (
              <p className="text-xs text-slate-600">Sem responsável.</p>
            ) : (
              <div className="space-y-2.5">
                {parceiro.representantes.map((r, i) => (
                  <div key={i} className="rounded-xl p-3 grid grid-cols-2 gap-3 text-sm" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <div className="col-span-2"><p className={labelCls}>Nome</p><p className="font-black text-white">{r.nome}</p></div>
                    <div><p className={labelCls}>CPF</p><p className="font-mono font-bold text-slate-300">{r.documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</p></div>
                    <div>
                      <p className={labelCls}>Nascimento</p><p className="font-bold text-slate-300">{r.dataNascimento}</p>
                      <p className={labelCls}>E-mail</p><p className="font-bold text-slate-300">{r.email}</p>
                    </div>
                    {r.telefone && <div><p className={labelCls}>WhatsApp</p><p className="font-bold text-slate-300">{r.telefone}</p></div>}
                    {r.cargo && <div className="col-span-2"><p className={labelCls}>Cargo</p><p className="font-bold text-slate-300">{r.cargo}</p></div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Login */}
        <div className={cardCls}>
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Acesso ao Sistema de Parceiros</p>
          <p className="text-xs text-slate-400">Login: <span className="text-white font-mono font-bold">{parceiro.loginEmail}</span></p>
          <p className="text-[9px] text-slate-600 italic">Senha armazenada com hash — não recuperável.</p>
          <button
            type="button"
            onClick={verLogin}
            disabled={carregandoLogin}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:border-indigo-500/40 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {carregandoLogin ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} Ver login
          </button>
          <p className="text-[9px] text-slate-600 italic">Gera uma nova senha temporária e mostra a mensagem de acesso pronta pra copiar.</p>
          {permissao.isAdmin && <TrocarSenhaParceiro parceiroId={parceiro.id} />}
        </div>
      </div>

      {modalLogin && (
        <ModalCredenciais
          open
          onClose={() => setModalLogin(null)}
          loginEmail={modalLogin.loginEmail}
          senhaGerada={modalLogin.senhaGerada}
          nomeParceiro={modalLogin.nomeParceiro}
          template={template}
        />
      )}

      {comprovanteInd && (
        <ModalComprovante
          open
          onClose={() => setComprovanteInd(null)}
          indicacaoId={comprovanteInd.id}
          empresaNome={comprovanteInd.cliente.razaoSocial}
          comprovante={{
            url: comprovanteInd.comprovanteUrl,
            nome: comprovanteInd.comprovanteNome,
            enviadoEm: comprovanteInd.comprovanteEnviadoEm,
            enviadoPor: comprovanteInd.comprovanteEnviadoPor,
          }}
          onChange={() => router.refresh()}
        />
      )}
    </main>
  );
}

/** Comissão que o parceiro recebe por uma indicação — mesmo estilo/cálculo do portal do parceiro. */
function ComissaoParceiroDetalhe({
  valorContrato,
  receitaLiquida,
  comissaoValor,
  servico,
  comissaoPercentual,
  accent,
}: {
  valorContrato: number;
  receitaLiquida: number;
  comissaoValor: number;
  servico: string | null;
  comissaoPercentual: number;
  accent: string;
}) {
  const tributosDetalhe = ([
    { label: "IRPJ", pct: TRIBUTOS.irpj },
    { label: "Ad. de IRPJ", pct: TRIBUTOS.adicionalIrpj },
    { label: "CSLL", pct: TRIBUTOS.csll },
    { label: "PIS", pct: TRIBUTOS.pis },
    { label: "COFINS", pct: TRIBUTOS.cofins },
    { label: "ISS", pct: TRIBUTOS.iss },
  ] as const).map((t) => ({ ...t, valor: valorContrato * (t.pct / 100) }));
  const totalTributosPct = tributosDetalhe.reduce((s, t) => s + t.pct, 0);
  const totalTributosValor = tributosDetalhe.reduce((s, t) => s + t.valor, 0);

  return (
    <div className="relative group">
      <div
        className="flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-help"
        style={{ background: `rgba(${accent}, 0.12)`, border: `1.5px solid rgba(${accent}, 0.4)` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `rgba(${accent}, 0.18)`, color: `rgb(${accent})` }}>
            <TrendingUp size={17} />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: `rgb(${accent})` }}>
              Comissão do parceiro ({comissaoPercentual}%)
            </p>
            <p className="text-[11px] text-slate-500 font-medium">{servico}</p>
          </div>
        </div>
        <p className="text-xl font-black italic" style={{ color: `rgb(${accent})` }}>
          {fmtBRL(comissaoValor)}
        </p>
      </div>

      {/* Tooltip com o detalhamento fiscal completo */}
      <div className="absolute left-0 right-0 top-full mt-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none">
        <div
          className="rounded-2xl px-4 py-4 text-[11.5px] leading-relaxed shadow-2xl space-y-1"
          style={{ background: "#0a0a12", border: `1px solid rgba(${accent}, 0.35)`, color: "#e2e8f0" }}
        >
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Receita Bruta:</span>
            <span className="font-bold text-white">{fmtBRL(valorContrato)}</span>
          </div>

          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 pt-2">Tributos incidentes</p>
          {tributosDetalhe.map((t) => (
            <div key={t.label} className="flex justify-between gap-4 text-slate-400">
              <span>{t.label} ({t.pct.toFixed(2).replace(".", ",")}%):</span>
              <span className="font-mono">{fmtBRL(t.valor)}</span>
            </div>
          ))}

          <div className="flex justify-between gap-4 pt-1 border-t border-white/10 font-bold text-amber-400">
            <span>Total de tributos ({totalTributosPct.toFixed(2).replace(".", ",")}%):</span>
            <span>{fmtBRL(totalTributosValor)}</span>
          </div>

          <div className="flex justify-between gap-4 pt-2 border-t border-white/10 font-black text-white uppercase tracking-wide">
            <span>Receita Líquida:</span>
            <span>{fmtBRL(receitaLiquida)}</span>
          </div>

          <div className="flex justify-between gap-4 font-black uppercase tracking-wide" style={{ color: `rgb(${accent})` }}>
            <span>Comissão ({comissaoPercentual}%):</span>
            <span>{fmtBRL(comissaoValor)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
