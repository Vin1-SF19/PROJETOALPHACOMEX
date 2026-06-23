"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, User, Mail, Phone, MapPin, CreditCard, ShieldCheck,
  Pencil, X, Loader2, Save, Sparkles, Unlink, ChevronDown, Receipt, FileCheck2, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { editarParceiro, desvincularIndicacao } from "@/actions/parceiros";
import { getTema } from "@/lib/temas";
import TrocarSenhaParceiro from "./TrocarSenhaParceiro";
import ModalComprovante from "./ModalComprovante";

type Endereco = { cep: string; logradouro: string; numero: string | null; complemento: string | null; bairro: string; cidade: string; uf: string };
type Responsavel = { nome: string; cpf: string; dataNascimento: string; cargo: string | null };
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
  };
};

export type DetalheParceiro = {
  id: number; tipo: string; documento: string; nome: string; nomeFantasia: string | null;
  email: string; telefone: string | null; telefone2: string | null;
  chavePix: string | null; tipoChavePix: string | null; nivel: string;
  comissaoPercentual: number | null; loginEmail: string;
  endereco: Endereco | null; responsaveis: Responsavel[]; indicacoes: Indicacao[];
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

export default function DetalheParceiroClient({
  parceiro, permissao, temaName = "blue",
}: {
  parceiro: DetalheParceiro;
  permissao: { isAdmin: boolean; podeEditar: boolean; podeExcluir: boolean };
  temaName?: string;
}) {
  const router = useRouter();
  const tema = getTema(temaName);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Empresa indicada — expande os dados já salvos no CS&NPS (sem gastar API)
  const [empresaAberta, setEmpresaAberta] = useState<number | null>(null);
  const toggleEmpresa = (indId: number) => setEmpresaAberta(prev => (prev === indId ? null : indId));

  // Comprovante de comissão por indicação
  const [comprovanteInd, setComprovanteInd] = useState<Indicacao | null>(null);

  // form
  const [nome, setNome] = useState(parceiro.nome);
  const [nomeFantasia, setNomeFantasia] = useState(parceiro.nomeFantasia ?? "");
  const [email, setEmail] = useState(parceiro.email);
  const [telefone, setTelefone] = useState(parceiro.telefone ?? "");
  const [telefone2, setTelefone2] = useState(parceiro.telefone2 ?? "");
  const [chavePix, setChavePix] = useState(parceiro.chavePix ?? "");
  const [tipoChavePix, setTipoChavePix] = useState(parceiro.tipoChavePix ?? "");
  const [comissao, setComissao] = useState(parceiro.comissaoPercentual != null ? String(parceiro.comissaoPercentual) : "");
  const [end, setEnd] = useState<Endereco>(parceiro.endereco ?? { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });

  function fmtDoc(doc: string): string {
    const d = doc.replace(/\D/g, "");
    if (parceiro.tipo === "PJ" && d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    if (parceiro.tipo === "PF" && d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return doc;
  }

  const comissaoEfetiva = parceiro.comissaoPercentual ?? COMISSAO_POR_NIVEL[parceiro.nivel] ?? 5;

  const salvar = async () => {
    if (!nome.trim() || !email.trim()) { toast.error("Nome e e-mail são obrigatórios"); return; }
    setSalvando(true);
    const res = await editarParceiro(parceiro.id, {
      nome, nomeFantasia: nomeFantasia || null, email,
      telefone: telefone || null, telefone2: telefone2 || null,
      chavePix: chavePix || null,
      tipoChavePix: (tipoChavePix as "cpf" | "cnpj" | "email" | "telefone" | "aleatoria") || null,
      comissaoPercentual: comissao ? Number(comissao) : null,
      endereco: end.cep && end.logradouro && end.bairro && end.cidade && end.uf
        ? { cep: end.cep, logradouro: end.logradouro, numero: end.numero || undefined, complemento: end.complemento || undefined, bairro: end.bairro, cidade: end.cidade, uf: end.uf }
        : undefined,
      // responsaveis não são editados aqui (preserva os do cadastro); omitir = manter
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
                {NIVEL_ICON[parceiro.nivel] ?? "★"} {parceiro.nivel} · {comissaoEfetiva}%
              </span>
            </div>
          </div>
          {/* Lápis — só quem pode editar */}
          {(permissao.podeEditar) && !editando && (
            <button onClick={() => setEditando(true)} title="Editar"
              className="h-10 px-3 flex items-center gap-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest text-white"
              style={{ background: `rgba(${tema.accent}, 0.85)` }}>
              <Pencil size={13} /> Editar
            </button>
          )}
          {editando && (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditando(false)} className="h-10 px-3 flex items-center gap-1.5 rounded-xl text-[10px] font-bold text-slate-300 bg-white/5"><X size={13} /> Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="h-10 px-3 flex items-center gap-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest text-white disabled:opacity-50" style={{ background: `rgba(${tema.accent}, 1)` }}>
                {salvando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar
              </button>
            </div>
          )}
        </div>

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
                          ["CNPJ", formatarDoc(c.cnpj), true, false],
                          ["Razão Social", c.razaoSocial, false, true],
                          ["Nome Fantasia", c.nomeFantasia || "—", false, false],
                          ["Data de Constituição", fmtDataBR(c.dataConstituicao) || "—", false, false],
                          ["Data Contratação", dtContratacao || "—", false, false],
                          ["UF", c.uf || "—", false, false],
                          ["Regime Tributário", c.regimeTributario || "—", false, false],
                          ["Status (CS&NPS)", c.status || "—", false, false],
                        ].map(([rotulo, valor, mono, full], i) => (
                          <div key={i} className={full ? "col-span-2" : ""}>
                            <p className="text-[8.5px] text-slate-600 uppercase tracking-widest font-bold">{rotulo as string}</p>
                            <p className={`text-[12px] font-bold text-slate-200 ${mono ? "font-mono" : ""}`}>{valor as string}</p>
                          </div>
                        ))}
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
              <div>
                <p className={`${labelCls} flex items-center gap-1`}>{parceiro.tipo === "PJ" ? <Building2 size={9} /> : <User size={9} />} Tipo</p>
                <p className="font-black text-white">{parceiro.tipo === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}</p>
              </div>
              <div>
                <p className={`${labelCls} flex items-center gap-1`}><ShieldCheck size={9} /> Documento</p>
                <p className="font-mono font-bold text-white">{fmtDoc(parceiro.documento)}</p>
              </div>
              <div className="col-span-2">
                <p className={`${labelCls} flex items-center gap-1`}><Mail size={9} /> E-mail</p>
                <p className="font-bold text-white">{parceiro.email}</p>
              </div>
              {parceiro.telefone && (
                <div>
                  <p className={`${labelCls} flex items-center gap-1`}><Phone size={9} /> Telefone 1</p>
                  <p className="font-bold text-white">{parceiro.telefone}</p>
                </div>
              )}
              {parceiro.telefone2 && (
                <div>
                  <p className={`${labelCls} flex items-center gap-1`}><Phone size={9} /> Telefone 2</p>
                  <p className="font-bold text-white">{parceiro.telefone2}</p>
                </div>
              )}
              {parceiro.chavePix && (
                <div className="col-span-2">
                  <p className={`${labelCls} flex items-center gap-1`}><CreditCard size={9} /> Chave Pix ({parceiro.tipoChavePix})</p>
                  <p className="font-mono font-bold text-white">{parceiro.chavePix}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div><p className={labelCls}>{parceiro.tipo === "PJ" ? "Razão Social" : "Nome"}</p><input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} /></div>
              {parceiro.tipo === "PJ" && <div><p className={labelCls}>Nome Fantasia</p><input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} className={inputCls} /></div>}
              <div><p className={labelCls}>E-mail</p><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className={labelCls}>Telefone 1</p><input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className={inputCls} /></div>
                <div><p className={labelCls}>Telefone 2</p><input value={telefone2} onChange={e => setTelefone2(e.target.value)} placeholder="(00) 00000-0000" className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className={labelCls}>Chave Pix</p><input value={chavePix} onChange={e => setChavePix(e.target.value)} className={inputCls} /></div>
                <div><p className={labelCls}>Tipo Pix</p>
                  <select value={tipoChavePix} onChange={e => setTipoChavePix(e.target.value)} className={inputCls}>
                    <option value="">—</option>{["cpf","cnpj","email","telefone","aleatoria"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div><p className={labelCls}>Comissão (%) — opcional</p><input type="number" min={0} max={100} step="0.5" value={comissao} onChange={e => setComissao(e.target.value)} placeholder={`Padrão do nível: ${COMISSAO_POR_NIVEL[parceiro.nivel] ?? 5}%`} className={inputCls} /></div>
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
              Responsáveis Físicos{parceiro.responsaveis.length > 1 ? ` (${parceiro.responsaveis.length})` : ""}
            </p>
            {parceiro.responsaveis.length === 0 ? (
              <p className="text-xs text-slate-600">Sem responsável.</p>
            ) : (
              <div className="space-y-2.5">
                {parceiro.responsaveis.map((r, i) => (
                  <div key={i} className="rounded-xl p-3 grid grid-cols-2 gap-3 text-sm" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <div className="col-span-2"><p className={labelCls}>Nome</p><p className="font-black text-white">{r.nome}</p></div>
                    <div><p className={labelCls}>CPF</p><p className="font-mono font-bold text-slate-300">{r.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</p></div>
                    <div><p className={labelCls}>Nascimento</p><p className="font-bold text-slate-300">{r.dataNascimento}</p></div>
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
          {permissao.isAdmin && <TrocarSenhaParceiro parceiroId={parceiro.id} />}
        </div>
      </div>

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
