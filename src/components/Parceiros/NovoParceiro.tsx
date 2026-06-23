"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, User, Loader2, Search, MapPin, ArrowLeft,
  CheckCircle2, AlertCircle, Plus, X, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { criarParceiro } from "@/actions/parceiros";
import { getTema } from "@/lib/temas";
import ModalEndereco, { type EnderecoData } from "./ModalEndereco";
import ModalCredenciais from "./ModalCredenciais";

type OnboardingTemplate = { id: number; nome: string; mensagem: string };
type Credenciais = { loginEmail: string; senhaGerada: string; nomeParceiro: string };

const TIPO_PIX = ["cpf", "cnpj", "email", "telefone", "aleatoria"] as const;

function formatarDocumento(v: string, tipo: "PF" | "PJ"): string {
  const d = v.replace(/\D/g, "");
  if (tipo === "PJ") {
    return d.slice(0, 14)
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{2}\.\d{3})(\d)/, "$1.$2")
      .replace(/(\d{2}\.\d{3}\.\d{3})(\d)/, "$1/$2")
      .replace(/(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, "$1-$2");
  }
  return d.slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
}

export default function NovoParceiro({
  template,
  temaName = "blue",
}: {
  template?: OnboardingTemplate | null;
  temaName?: string;
}) {
  const router = useRouter();
  const tema = getTema(temaName);

  const [tipo, setTipo] = useState<"PF" | "PJ">("PJ");
  const [documento, setDocumento] = useState("");
  const [dataNascPF, setDataNascPF] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [consultaDone, setConsultaDone] = useState(false);
  const [consultaErro, setConsultaErro] = useState("");

  const [nome, setNome] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [telefone2, setTelefone2] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [tipoChavePix, setTipoChavePix] = useState("");
  const [comissao, setComissao] = useState("");
  const [dadosConsultaBrutos, setDadosConsultaBrutos] = useState("");

  // Responsáveis físicos (vários) — em "gaveta": só um aberto por vez
  type Resp = { nome: string; cpf: string; dataNascimento: string; cargo: string };
  const respVazio = (): Resp => ({ nome: "", cpf: "", dataNascimento: "", cargo: "" });
  const [responsaveis, setResponsaveis] = useState<Resp[]>([respVazio()]);
  const [respAbertoIdx, setRespAbertoIdx] = useState<number>(0); // qual está expandido

  const respCompleto = (r: Resp) => r.nome.trim() && r.cpf.replace(/\D/g, "").length === 11 && !!r.dataNascimento;
  const updateResp = (i: number, campo: keyof Resp, valor: string) =>
    setResponsaveis(prev => prev.map((r, idx) => idx === i ? { ...r, [campo]: valor } : r));
  const addResp = () => {
    setResponsaveis(prev => [...prev, respVazio()]);
    setRespAbertoIdx(responsaveis.length); // abre o novo
  };
  const removeResp = (i: number) => {
    setResponsaveis(prev => prev.filter((_, idx) => idx !== i));
    setRespAbertoIdx(-1);
  };

  const [endereco, setEndereco] = useState<EnderecoData | null>(null);
  const [modalEnderecoOpen, setModalEnderecoOpen] = useState(false);
  const [credenciais, setCredenciais] = useState<Credenciais | null>(null);
  const [modalCredOpen, setModalCredOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  function changeTipo(t: "PF" | "PJ") {
    setTipo(t);
    setDocumento("");
    setConsultaDone(false);
    setConsultaErro("");
  }

  function onChangeDoc(v: string) {
    setDocumento(formatarDocumento(v, tipo));
    setConsultaDone(false);
    setConsultaErro("");
  }

  // Busca por API (opcional) — pré-preenche os campos
  async function consultar() {
    const docLimpo = documento.replace(/\D/g, "");
    if (tipo === "PJ" && docLimpo.length !== 14) { toast.error("CNPJ inválido"); return; }
    if (tipo === "PF" && docLimpo.length !== 11) { toast.error("CPF inválido"); return; }
    if (tipo === "PF" && !dataNascPF) { toast.error("Data de nascimento obrigatória para buscar CPF"); return; }

    setConsultando(true);
    setConsultaErro("");
    try {
      if (tipo === "PJ") {
        const r = await fetch(`/api/ReceitaFederal?cnpj=${docLimpo}`);
        const d = await r.json();
        if (d.error || d.message) throw new Error(d.error || d.message);
        setNome(d.razaoSocial || "");
        setNomeFantasia(d.nomeFantasia || "");
        setEmail(d.email || "");
        if (d.telefone) setTelefone(d.telefone);
        setDadosConsultaBrutos(JSON.stringify(d));
      } else {
        const r = await fetch("/api/ConsultaCpf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: docLimpo, dataNascimento: dataNascPF }),
        });
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        setNome(d.nome || "");
        setDadosConsultaBrutos(JSON.stringify(d));
      }
      setConsultaDone(true);
      toast.success("Dados preenchidos pela consulta");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro na consulta";
      setConsultaErro(msg);
      toast.error(msg);
    } finally {
      setConsultando(false);
    }
  }

  async function handleSalvar() {
    const docLimpo = documento.replace(/\D/g, "");
    if (tipo === "PJ" && docLimpo.length !== 14) { toast.error("CNPJ inválido"); return; }
    if (tipo === "PF" && docLimpo.length !== 11) { toast.error("CPF inválido"); return; }
    if (!nome || !email) { toast.error("Nome e e-mail são obrigatórios"); return; }
    const respValidos = responsaveis.filter(respCompleto);
    if (tipo === "PJ" && respValidos.length === 0) {
      toast.error("Preencha ao menos um responsável físico (obrigatório para PJ)");
      return;
    }

    setSalvando(true);
    try {
      const result = await criarParceiro({
        tipo,
        documento: docLimpo,
        nome,
        nomeFantasia: nomeFantasia || undefined,
        email,
        telefone: telefone || undefined,
        telefone2: telefone2 || undefined,
        chavePix: chavePix || undefined,
        tipoChavePix: (tipoChavePix as "cpf" | "cnpj" | "email" | "telefone" | "aleatoria") || undefined,
        comissaoPercentual: comissao ? Number(comissao) : undefined,
        dadosConsulta: dadosConsultaBrutos || undefined,
        endereco: endereco ?? undefined,
        responsaveis: tipo === "PJ"
          ? respValidos.map(r => ({ nome: r.nome, cpf: r.cpf.replace(/\D/g, ""), dataNascimento: r.dataNascimento, cargo: r.cargo || undefined }))
          : undefined,
      });

      if (!result.success || !result.parceiro) {
        toast.error(result.error ?? "Erro ao cadastrar");
        return;
      }
      setCredenciais({ loginEmail: result.parceiro.loginEmail, senhaGerada: result.parceiro.senhaGerada, nomeParceiro: result.parceiro.nome });
      setModalCredOpen(true);
    } finally {
      setSalvando(false);
    }
  }

  function handleFecharCredenciais() {
    setModalCredOpen(false);
    router.push("/PainelAlpha/Parceiros");
  }

  const docLimpo = documento.replace(/\D/g, "");
  const podeConsultar = tipo === "PJ" ? docLimpo.length === 14 : (docLimpo.length === 11 && !!dataNascPF);
  const inputCls = "bg-black/40 border-white/10 rounded-2xl h-12 text-sm";
  const labelCls = "text-[10px] font-black uppercase text-slate-500 tracking-widest";

  return (
    <>
      <div className="min-h-screen bg-[#020617] text-slate-200 p-6 lg:p-10">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center gap-4">
            <Button type="button" variant="ghost" onClick={() => router.back()} className="text-slate-500 hover:text-white p-2"><ArrowLeft size={18} /></Button>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tight text-white">
                Novo <span style={{ color: `rgba(${tema.accent}, 1)` }}>Parceiro</span>
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Preencha manualmente ou use a 🔍 para buscar</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden">

            {/* Tipo + Documento (com lupa) */}
            <div className="p-8 border-b border-white/5">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">1. Tipo de parceiro</p>
              <div className="flex gap-3 mb-6">
                {(["PJ", "PF"] as const).map(t => (
                  <button key={t} type="button" onClick={() => changeTipo(t)}
                    className="flex-1 h-14 rounded-2xl border font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                    style={tipo === t ? { background: `rgba(${tema.accent}, 0.15)`, borderColor: `rgba(${tema.accent}, 0.5)`, color: `rgba(${tema.accent}, 1)` } : {}}>
                    {t === "PJ" ? <Building2 size={14} /> : <User size={14} />}
                    {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className={labelCls}>{tipo === "PJ" ? "CNPJ" : "CPF"} *</Label>
                  <div className="flex gap-2">
                    <Input value={documento} onChange={e => onChangeDoc(e.target.value)}
                      placeholder={tipo === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                      className={`${inputCls} font-mono flex-1`} />
                    <Button type="button" onClick={consultar} disabled={!podeConsultar || consultando}
                      title="Buscar dados por API (opcional)"
                      className="h-12 w-12 shrink-0 rounded-2xl disabled:opacity-40 text-white" style={{ background: `rgba(${tema.accent}, 0.9)` }}>
                      {consultando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    </Button>
                  </div>
                  <p className="text-[9px] text-slate-600">🔍 Opcional — se já tem os dados, preencha manual abaixo e economize a consulta.</p>
                </div>

                {tipo === "PF" && (
                  <div className="space-y-1">
                    <Label className={labelCls}>Data de Nascimento {tipo === "PF" ? "(p/ busca)" : ""}</Label>
                    <Input type="date" value={dataNascPF} onChange={e => setDataNascPF(e.target.value)} className={inputCls} />
                  </div>
                )}

                {consultaDone && <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold"><CheckCircle2 size={14} /> Consulta realizada</div>}
                {consultaErro && <div className="flex items-center gap-2 text-red-400 text-xs font-bold"><AlertCircle size={14} /> {consultaErro}</div>}
              </div>
            </div>

            {/* Dados (sempre visíveis) */}
            <div className="p-8 border-b border-white/5 space-y-4">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">2. Dados do parceiro</p>

              <div className="space-y-1">
                <Label className={labelCls}>{tipo === "PJ" ? "Razão Social" : "Nome"} *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} />
              </div>

              {tipo === "PJ" && (
                <div className="space-y-1">
                  <Label className={labelCls}>Nome Fantasia</Label>
                  <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} className={inputCls} />
                </div>
              )}

              <div className="space-y-1">
                <Label className={labelCls}>E-mail *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className={labelCls}>Telefone 1</Label>
                  <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className={inputCls} />
                </div>
                <div className="space-y-1">
                  <Label className={labelCls}>Telefone 2</Label>
                  <Input value={telefone2} onChange={e => setTelefone2(e.target.value)} placeholder="(00) 00000-0000" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className={labelCls}>Chave Pix</Label>
                  <Input value={chavePix} onChange={e => setChavePix(e.target.value)} placeholder="Chave pix" className={inputCls} />
                </div>
                <div className="space-y-1">
                  <Label className={labelCls}>Tipo Pix</Label>
                  <Select value={tipoChavePix} onValueChange={setTipoChavePix}>
                    <SelectTrigger className="bg-black/40 border-white/10 rounded-2xl h-12 text-xs font-black uppercase"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent className="bg-slate-950 border-white/10 text-white rounded-xl">
                      {TIPO_PIX.map(t => <SelectItem key={t} value={t} className="text-xs uppercase font-bold py-3">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Comissão (opcional) */}
              <div className="space-y-1">
                <Label className={labelCls}>Comissão (%) <span className="text-slate-600 normal-case">— opcional</span></Label>
                <Input type="number" min={0} max={100} step="0.5" value={comissao} onChange={e => setComissao(e.target.value)}
                  placeholder="Deixe vazio para usar a do nível" className={inputCls} />
              </div>

              {/* Endereço */}
              <Button type="button" variant="outline" onClick={() => setModalEnderecoOpen(true)}
                className={`w-full h-12 rounded-2xl border font-black uppercase text-xs tracking-widest gap-2 transition-all ${endereco ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-slate-400 hover:border-indigo-500/50"}`}>
                <MapPin size={13} />
                {endereco ? `${endereco.logradouro}, ${endereco.numero || "S/N"} — ${endereco.cidade}/${endereco.uf}` : "Endereço para brindes e presentes"}
                {!endereco && <Plus size={11} />}
              </Button>
            </div>

            {/* Responsáveis Físicos (PJ) — gaveta, vários */}
            {tipo === "PJ" && (
              <div className="p-8 border-b border-white/5 space-y-3">
                <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">
                  3. Responsáveis Físicos <span className="text-slate-600">(ao menos um para PJ)</span>
                </p>

                {responsaveis.map((r, i) => {
                  const aberto = respAbertoIdx === i;
                  const completo = respCompleto(r);
                  return (
                    <div key={i} className="rounded-2xl overflow-hidden" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      {/* Cabeçalho da gaveta */}
                      <div className="flex items-center gap-2 px-4 py-3">
                        <button type="button" onClick={() => setRespAbertoIdx(aberto ? -1 : i)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                          <div className="w-7 h-7 rounded-lg grid place-items-center shrink-0" style={{ background: completo ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.12)" }}>
                            <User size={13} className={completo ? "text-emerald-400" : "text-amber-400"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-bold text-slate-200 truncate">{r.nome || `Responsável ${i + 1}`}</p>
                            {completo && <p className="text-[10px] text-slate-500 truncate font-mono">{r.cpf}{r.cargo ? ` · ${r.cargo}` : ""}</p>}
                          </div>
                          <ChevronDown size={15} className={`shrink-0 text-slate-500 transition-transform ${aberto ? "rotate-180" : ""}`} />
                        </button>
                        {responsaveis.length > 1 && (
                          <button type="button" onClick={() => removeResp(i)} title="Remover" className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 shrink-0">
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Corpo da gaveta */}
                      {aberto && (
                        <div className="px-4 pb-4 pt-1 space-y-3 border-t" style={{ borderColor: "rgba(245,158,11,0.15)" }}>
                          <div className="space-y-1">
                            <Label className={labelCls}>Nome Completo *</Label>
                            <Input value={r.nome} onChange={e => updateResp(i, "nome", e.target.value)} className={inputCls} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className={labelCls}>CPF *</Label>
                              <Input value={r.cpf} onChange={e => updateResp(i, "cpf", formatarDocumento(e.target.value, "PF"))} placeholder="000.000.000-00" className={`${inputCls} font-mono`} />
                            </div>
                            <div className="space-y-1">
                              <Label className={labelCls}>Data Nasc. *</Label>
                              <Input type="date" value={r.dataNascimento} onChange={e => updateResp(i, "dataNascimento", e.target.value)} className={inputCls} />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className={labelCls}>Cargo / Relação</Label>
                            <Input value={r.cargo} onChange={e => updateResp(i, "cargo", e.target.value)} placeholder="Sócio, Diretor, Procurador..." className={inputCls} />
                          </div>
                          {/* Botão "salvar" abaixo: fecha a gaveta se estiver completo */}
                          <Button type="button" variant="outline" disabled={!completo}
                            onClick={() => setRespAbertoIdx(-1)}
                            className="w-full h-10 rounded-xl border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-black uppercase text-[11px] tracking-widest gap-2 disabled:opacity-30">
                            <CheckCircle2 size={14} /> Salvar responsável
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Botão + adicionar */}
                <Button type="button" variant="outline"
                  onClick={addResp}
                  className="w-full h-11 rounded-xl border-dashed border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-black uppercase text-[11px] tracking-widest gap-2">
                  <Plus size={14} /> Adicionar responsável
                </Button>
              </div>
            )}

            {/* Cancelar + Cadastrar */}
            <div className="p-8 flex gap-3">
              <Button type="button" variant="outline" onClick={() => router.back()}
                className="h-14 px-6 rounded-[1.5rem] border-white/10 text-slate-400 hover:text-white font-black uppercase tracking-widest text-sm gap-2">
                <X size={16} /> Cancelar
              </Button>
              <Button type="button" onClick={handleSalvar} disabled={salvando}
                className="flex-1 h-14 font-black uppercase tracking-widest text-sm rounded-[1.5rem] gap-2 disabled:opacity-40 text-white" style={{ background: `rgba(${tema.accent}, 1)` }}>
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {salvando ? "Cadastrando..." : "Cadastrar Parceiro"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ModalEndereco open={modalEnderecoOpen} onClose={() => setModalEnderecoOpen(false)} onSalvar={setEndereco} inicial={endereco ?? undefined} />

      {credenciais && (
        <ModalCredenciais open={modalCredOpen} onClose={handleFecharCredenciais}
          loginEmail={credenciais.loginEmail} senhaGerada={credenciais.senhaGerada} nomeParceiro={credenciais.nomeParceiro} template={template ?? null} />
      )}
    </>
  );
}
