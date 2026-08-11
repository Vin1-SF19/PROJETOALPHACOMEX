"use client";

import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle2, AlertTriangle, XCircle, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { atualizarPreCadastro } from "@/actions/convites-parceiro";
import { avaliarPendencias, type PreCadastroParaChecklist, type RepresentanteExtra } from "@/lib/parceiros/pre-cadastro-checklist";

type PreCadastroCompleto = PreCadastroParaChecklist & {
  id: number;
  nomeCompleto: string;
  whatsapp: string | null;
  numero: string | null;
  complemento: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
};

const inputCls =
  "w-full h-10 px-3 rounded-xl text-[12.5px] text-white outline-none transition-all bg-black/40 border border-white/10 focus:border-blue-500/50 placeholder:text-slate-600";

function formatarCpf(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-bold text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function parseRepresentantesExtra(json: string | null): RepresentanteExtra[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as RepresentanteExtra[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ModalEditarPreCadastro({
  preCadastro,
  onClose,
  onSalvo,
}: {
  preCadastro: PreCadastroCompleto;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [nomeCompleto, setNomeCompleto] = useState(preCadastro.nomeCompleto);
  const [cpf, setCpf] = useState(preCadastro.cpf ?? "");
  const [dataNascimento, setDataNascimento] = useState(preCadastro.dataNascimento ?? "");
  const [whatsapp, setWhatsapp] = useState(preCadastro.whatsapp ?? "");
  const [cep, setCep] = useState(preCadastro.cep ?? "");
  const [logradouro, setLogradouro] = useState(preCadastro.logradouro ?? "");
  const [numero, setNumero] = useState(preCadastro.numero ?? "");
  const [complemento, setComplemento] = useState(preCadastro.complemento ?? "");
  const [bairro, setBairro] = useState(preCadastro.bairro ?? "");
  const [cidade, setCidade] = useState(preCadastro.cidade ?? "");
  const [uf, setUf] = useState(preCadastro.uf ?? "");
  const [razaoSocial, setRazaoSocial] = useState(preCadastro.razaoSocial ?? "");
  const [nomeFantasia, setNomeFantasia] = useState(preCadastro.nomeFantasia ?? "");
  const [cnpj, setCnpj] = useState(preCadastro.cnpj ?? "");
  const [souRepresentante, setSouRepresentante] = useState(preCadastro.souRepresentante);
  const [representantesExtra, setRepresentantesExtra] = useState<RepresentanteExtra[]>(
    parseRepresentantesExtra(preCadastro.representantesExtra),
  );
  const [salvando, setSalvando] = useState(false);

  const tipo: "PF" | "PJ" =
    preCadastro.tipoRecebimento === "PF" || preCadastro.tipoRecebimento === "PJ"
      ? preCadastro.tipoRecebimento
      : (cnpj.replace(/\D/g, "").length === 14 ? "PJ" : "PF");

  const estadoAtual: PreCadastroParaChecklist = {
    cpf, dataNascimento, cnpj, tipoRecebimento: preCadastro.tipoRecebimento, souRepresentante,
    representantesExtra: representantesExtra.length > 0 ? JSON.stringify(representantesExtra) : null,
    cep, logradouro, bairro, cidade, uf,
  };
  const pendencias = avaliarPendencias(estadoAtual);
  const bloqueado = pendencias.some((p) => p.bloqueiaAprovacao && !p.ok);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const addRepresentante = () =>
    setRepresentantesExtra((prev) => [...prev, { nome: "", cpf: "", dataNascimento: "", cargo: "" }]);
  const updateRepresentante = (i: number, campo: keyof RepresentanteExtra, valor: string) =>
    setRepresentantesExtra((prev) => prev.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)));
  const removeRepresentante = (i: number) =>
    setRepresentantesExtra((prev) => prev.filter((_, idx) => idx !== i));

  async function handleSalvar() {
    setSalvando(true);
    const res = await atualizarPreCadastro(preCadastro.id, {
      nomeCompleto,
      cpf: cpf || undefined,
      dataNascimento: dataNascimento || undefined,
      whatsapp: whatsapp || undefined,
      cep: cep || undefined,
      logradouro: logradouro || undefined,
      numero: numero || undefined,
      complemento: complemento || undefined,
      bairro: bairro || undefined,
      cidade: cidade || undefined,
      uf: uf || undefined,
      souRepresentante: tipo === "PJ" ? souRepresentante : undefined,
      representantesExtra: tipo === "PJ" && !souRepresentante ? representantesExtra : undefined,
      razaoSocial: razaoSocial || undefined,
      nomeFantasia: nomeFantasia || undefined,
      cnpj: cnpj || undefined,
    });
    setSalvando(false);
    if (res.success) {
      toast.success("Pré-cadastro atualizado");
      onSalvo();
    } else {
      toast.error(res.error ?? "Falha ao salvar");
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl overflow-hidden"
        style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-sm font-black text-white uppercase tracking-tight">Editar pré-cadastro</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Checklist visual — semáforo das pendências que bloqueiam aprovação */}
        <div className="px-6 pt-4 pb-1 space-y-1.5">
          {pendencias.map((p) => (
            <div
              key={p.chave}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold"
              style={{
                background: p.ok
                  ? "rgba(16,185,129,0.08)"
                  : p.bloqueiaAprovacao
                    ? "rgba(244,63,94,0.08)"
                    : "rgba(245,158,11,0.08)",
                color: p.ok ? "#6ee7b7" : p.bloqueiaAprovacao ? "#fda4af" : "#fcd34d",
              }}
            >
              {p.ok ? <CheckCircle2 size={14} className="shrink-0" /> : p.bloqueiaAprovacao ? <XCircle size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
              <span>{p.label}</span>
              {!p.ok && !p.bloqueiaAprovacao && <span className="text-[9px] text-slate-500 ml-auto">opcional</span>}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nome completo">
              <input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="WhatsApp">
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputCls} placeholder="(00) 00000-0000" />
            </Campo>
            <Campo label={tipo === "PJ" && souRepresentante ? "Seu CPF (representante)" : "CPF"}>
              <input value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} className={`${inputCls} font-mono`} placeholder="000.000.000-00" />
            </Campo>
            <Campo label={tipo === "PJ" && souRepresentante ? "Sua Data Nasc. (representante)" : "Data de Nascimento"}>
              <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className={inputCls} />
            </Campo>
          </div>

          {tipo === "PJ" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Razão Social">
                  <input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Nome Fantasia">
                  <input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} className={inputCls} />
                </Campo>
              </div>
              <Campo label="CNPJ">
                <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className={`${inputCls} font-mono`} />
              </Campo>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={souRepresentante}
                  onChange={(e) => setSouRepresentante(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-[11.5px] text-slate-300">O preenchedor acima é o representante da empresa</span>
              </label>

              {!souRepresentante && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Representante(s) da empresa</p>
                  {representantesExtra.map((r, i) => (
                    <div key={i} className="rounded-2xl p-3 space-y-2" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <div className="flex items-center gap-2">
                        <input value={r.nome} onChange={(e) => updateRepresentante(i, "nome", e.target.value)} placeholder="Nome completo" className={inputCls} />
                        <button onClick={() => removeRepresentante(i)} className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={r.cpf} onChange={(e) => updateRepresentante(i, "cpf", formatarCpf(e.target.value))} placeholder="CPF" className={`${inputCls} font-mono`} />
                        <input type="date" value={r.dataNascimento} onChange={(e) => updateRepresentante(i, "dataNascimento", e.target.value)} className={inputCls} />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addRepresentante}
                    className="w-full h-9 rounded-xl border border-dashed border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-black uppercase text-[10px] tracking-widest gap-2 flex items-center justify-center"
                  >
                    <Plus size={13} /> Adicionar representante
                  </button>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo label="CEP">
              <input value={cep} onChange={(e) => setCep(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="UF">
              <input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} maxLength={2} className={inputCls} />
            </Campo>
            <Campo label="Logradouro">
              <input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Número">
              <input value={numero} onChange={(e) => setNumero(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Complemento">
              <input value={complemento} onChange={(e) => setComplemento(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Bairro">
              <input value={bairro} onChange={(e) => setBairro(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Cidade">
              <input value={cidade} onChange={(e) => setCidade(e.target.value)} className={inputCls} />
            </Campo>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/5">
          <span className="text-[10.5px] text-slate-500">
            {bloqueado ? "Ainda há pendências que impedem a aprovação." : "Pronto para aprovar."}
          </span>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
