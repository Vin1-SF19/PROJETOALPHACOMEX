"use client";

import { useEffect, useRef, useState } from "react";
import { X, UserPlus, Loader2, Check, Ban, Mail, Phone, MapPin, Building2, RotateCcw, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { listarPreCadastros, aprovarPreCadastro, rejeitarPreCadastro } from "@/actions/convites-parceiro";

type StatusPreCadastro = "PENDENTE" | "APROVADO" | "REJEITADO";

type PreCadastro = {
  id: number;
  email: string;
  nomeCompleto: string;
  cpf: string | null;
  dataNascimento: string | null;
  uf: string;
  municipio: string | null;
  telefone: string;
  whatsapp: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  areasAtuacao: string | null;
  nomeEmpresa: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpj: string | null;
  sobre: string | null;
  termoVersao: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  status: StatusPreCadastro;
  parceiroId: number | null;
  aprovadoPorId: number | null;
  aprovadoPorNome: string | null;
};

const ABAS: { valor: StatusPreCadastro; label: string }[] = [
  { valor: "PENDENTE", label: "Pendentes" },
  { valor: "APROVADO", label: "Aprovados" },
  { valor: "REJEITADO", label: "Rejeitados" },
];

type ParceiroAprovado = { id: number; loginEmail: string; senhaGerada: string; nome: string };

export default function ModalPreCadastros({ open, onClose, isAdmin, onAprovado, preCadastroIdFoco }: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onAprovado?: (parceiro: ParceiroAprovado) => void;
  preCadastroIdFoco?: number;
}) {
  const [aba, setAba] = useState<StatusPreCadastro>("PENDENTE");
  const [lista, setLista] = useState<PreCadastro[]>([]);
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState<number | null>(null);
  const itemFocoRef = useRef<HTMLDivElement | null>(null);

  const recarregar = (status: StatusPreCadastro) => {
    setLoading(true);
    listarPreCadastros(status)
      .then(({ preCadastros }) => setLista(preCadastros as PreCadastro[]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) recarregar(aba);
  }, [open, aba]);

  useEffect(() => {
    if (open && preCadastroIdFoco && itemFocoRef.current) {
      itemFocoRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [open, preCadastroIdFoco, lista]);

  if (!open) return null;

  const handleAprovar = async (id: number) => {
    setProcessando(id);
    const res = await aprovarPreCadastro(id);
    setProcessando(null);
    if (res.success && res.parceiro) {
      toast.success(aba === "REJEITADO" ? "Pré-cadastro revertido e aprovado" : "Pré-cadastro aprovado");
      setLista((prev) => prev.filter((p) => p.id !== id));
      onAprovado?.(res.parceiro);
    } else {
      toast.error(res.error ?? "Falha ao aprovar");
    }
  };

  const handleRejeitar = async (id: number) => {
    setProcessando(id);
    const res = await rejeitarPreCadastro(id);
    setProcessando(null);
    if (res.success) {
      toast.success("Pré-cadastro rejeitado");
      setLista((prev) => prev.filter((p) => p.id !== id));
    } else toast.error("Falha ao rejeitar");
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden" style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20"><UserPlus size={16} className="text-amber-400" /></div>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">Pré-cadastros de Parceiros</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"><X size={16} /></button>
        </div>

        {/* Abas: Pendentes / Aprovados / Rejeitados */}
        <div className="flex items-center gap-1.5 px-6 py-3 border-b border-white/5">
          {ABAS.map((a) => (
            <button
              key={a.valor}
              onClick={() => setAba(a.valor)}
              className="px-3.5 h-8 rounded-lg text-[10.5px] font-black uppercase tracking-widest transition-all"
              style={
                aba === a.valor
                  ? { background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.4)" }
                  : { background: "transparent", color: "#64748b", border: "1px solid transparent" }
              }
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
          ) : lista.length === 0 ? (
            <p className="text-[13px] text-slate-600 py-10 text-center">
              {aba === "PENDENTE" && "Nenhum pré-cadastro pendente."}
              {aba === "APROVADO" && "Nenhum pré-cadastro aprovado ainda."}
              {aba === "REJEITADO" && "Nenhum pré-cadastro rejeitado."}
            </p>
          ) : (
            lista.map((p) => {
              const emFoco = preCadastroIdFoco === p.id;
              return (
                <div
                  key={p.id}
                  ref={emFoco ? itemFocoRef : undefined}
                  className="rounded-2xl p-4 transition-all"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: emFoco ? "1px solid rgba(245,158,11,0.6)" : "1px solid rgba(255,255,255,0.07)",
                    boxShadow: emFoco ? "0 0 0 3px rgba(245,158,11,0.15)" : undefined,
                  }}
                >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-[14px] font-black text-white">{p.nomeCompleto}</h3>
                    {(p.razaoSocial || p.nomeEmpresa) && (
                      <p className="text-[11px] text-slate-400">
                        {p.razaoSocial ?? p.nomeEmpresa}
                        {p.nomeFantasia && p.nomeFantasia !== (p.razaoSocial ?? p.nomeEmpresa) && ` (${p.nomeFantasia})`}
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-600 shrink-0">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-1.5 text-[11px] text-slate-400 mb-3">
                  <Info icon={<Mail size={11} />} v={p.email} />
                  <Info icon={<Phone size={11} />} v={p.whatsapp ? `${p.telefone} · WhatsApp ${p.whatsapp}` : p.telefone} />
                  <Info icon={<MapPin size={11} />} v={enderecoResumo(p)} />
                  <Info icon={<Building2 size={11} />} v={p.cnpj ? `CNPJ ${p.cnpj}` : p.cpf ? `CPF ${p.cpf}` : "sem documento"} />
                  {p.dataNascimento && <Info icon={<UserPlus size={11} />} v={`Nascimento: ${p.dataNascimento}`} />}
                </div>

                {p.areasAtuacao && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {p.areasAtuacao.split(",").map((a) => (
                      <span key={a} className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd" }}>{a}</span>
                    ))}
                  </div>
                )}

                {p.sobre && <p className="text-[11px] text-slate-500 italic mb-3 line-clamp-3">&ldquo;{p.sobre}&rdquo;</p>}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                  <span className="text-[9px] text-slate-600">
                    Termo {p.termoVersao}
                    {aba !== "PENDENTE" && ` · ${new Date(p.updatedAt).toLocaleDateString("pt-BR")}`}
                    {aba === "APROVADO" && p.aprovadoPorNome && ` · por ${p.aprovadoPorNome}`}
                  </span>
                  <div className="flex gap-2">
                    {aba === "PENDENTE" && (
                      <>
                        <button
                          onClick={() => handleRejeitar(p.id)}
                          disabled={processando === p.id}
                          className="flex items-center gap-1 px-3 h-8 rounded-lg border border-rose-500/30 text-rose-400 text-[10px] font-black uppercase hover:bg-rose-500/10 transition-all disabled:opacity-50"
                        >
                          <Ban size={12} /> Rejeitar
                        </button>
                        <button
                          onClick={() => handleAprovar(p.id)}
                          disabled={processando === p.id || !isAdmin}
                          title={!isAdmin ? "Apenas administradores aprovam" : undefined}
                          className="flex items-center gap-1 px-4 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {processando === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Aprovar
                        </button>
                      </>
                    )}
                    {aba === "REJEITADO" && (
                      <button
                        onClick={() => handleAprovar(p.id)}
                        disabled={processando === p.id || !isAdmin}
                        title={!isAdmin ? "Apenas administradores aprovam" : "Reverte a rejeição e aprova o pré-cadastro"}
                        className="flex items-center gap-1 px-4 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {processando === p.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Reverter p/ aprovado
                      </button>
                    )}
                    {aba === "APROVADO" && p.parceiroId && (
                      <Link
                        href={`/PainelAlpha/Parceiros/${p.parceiroId}`}
                        onClick={onClose}
                        className="flex items-center gap-1 px-3 h-8 rounded-lg border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase hover:bg-emerald-500/10 transition-all"
                      >
                        <ExternalLink size={12} /> Ver parceiro
                      </Link>
                    )}
                  </div>
                </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function enderecoResumo(p: PreCadastro): string {
  if (p.logradouro && p.cidade) {
    const numero = p.numero ? `, ${p.numero}` : "";
    const complemento = p.complemento ? ` - ${p.complemento}` : "";
    const bairro = p.bairro ? ` - ${p.bairro}` : "";
    return `${p.logradouro}${numero}${complemento}${bairro} - ${p.cidade}/${p.uf}`;
  }
  return `${p.municipio ?? "—"} / ${p.uf}`;
}

function Info({ icon, v }: { icon: React.ReactNode; v: string }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="text-slate-600 shrink-0">{icon}</span>
      <span className="truncate">{v}</span>
    </span>
  );
}
