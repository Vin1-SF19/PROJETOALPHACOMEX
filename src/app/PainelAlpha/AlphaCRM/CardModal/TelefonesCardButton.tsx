"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Phone, PhoneCall, UserRound } from "lucide-react";

import { IniciarLigacaoTelefoneCardBpm, ListarTelefonesCardBpm } from "@/actions/bpm/Cards";
import { useServiceHub } from "../ServiceHubProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TelefoneCard = Awaited<ReturnType<typeof ListarTelefonesCardBpm>>["data"][number];

interface TelefonesCardButtonProps {
  cardId: string;
  empresaNome: string;
}

export function TelefonesCardButton({ cardId, empresaNome }: TelefonesCardButtonProps) {
  const reduzirMovimento = useReducedMotion();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [telefones, setTelefones] = useState<TelefoneCard[]>([]);
  const [telefonesEmLigacao, setTelefonesEmLigacao] = useState<Set<string>>(new Set());
  const [avisoLigacao, setAvisoLigacao] = useState<string | null>(null);
  const { abrirServiceHub } = useServiceHub();

  async function carregarTelefones() {
    setCarregando(true);
    setErro(null);

    const resultado = await ListarTelefonesCardBpm(cardId);
    if (resultado.success) {
      setTelefones(resultado.data);
    } else {
      setTelefones([]);
      setErro(resultado.error || "Erro ao buscar telefones");
    }

    setCarregando(false);
  }

  function abrirModal() {
    setAberto(true);
    void carregarTelefones();
  }

  async function iniciarLigacao(telefone: string) {
    if (telefonesEmLigacao.has(telefone)) return;
    abrirServiceHub();
    setTelefonesEmLigacao((atual) => new Set(atual).add(telefone));
    setAvisoLigacao(null);
    const resultado = await IniciarLigacaoTelefoneCardBpm(cardId, telefone);
    setTelefonesEmLigacao((atual) => {
      const proximo = new Set(atual);
      proximo.delete(telefone);
      return proximo;
    });
    setAvisoLigacao(resultado.success ? "Ligação enviada para a Callix." : resultado.error);
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={abrirModal}
        aria-label={`Ver telefones vinculados a ${empresaNome}`}
        title="Ver telefones vinculados"
        whileTap={reduzirMovimento ? undefined : { scale: 0.96 }}
        className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        style={{
          background: "linear-gradient(135deg, rgba(52,211,153,0.35), rgba(52,211,153,0.1))",
          boxShadow: "0 10px 28px -8px rgba(52,211,153,0.55)",
        }}
      >
        <motion.span
          aria-hidden="true"
          className="absolute inset-2 rounded-xl border border-emerald-300/40"
          animate={reduzirMovimento ? undefined : { opacity: [0.25, 0.8, 0.25], scale: [0.82, 1.08, 0.82] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          aria-hidden="true"
          className="relative flex items-center justify-center"
          animate={reduzirMovimento ? undefined : { scale: [1, 1.14, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <Phone size={28} className="text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
        </motion.span>
      </motion.button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="z-[60] max-h-[80vh] overflow-hidden border-white/10 bg-slate-950 p-0 text-slate-100 shadow-2xl sm:max-w-md">
          <DialogHeader className="border-b border-white/10 px-6 py-5 pr-12">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                <Phone size={18} aria-hidden="true" />
              </span>
              Telefones vinculados
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Pessoas associadas a {empresaNome}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-36 overflow-y-auto px-4 py-4">
            {avisoLigacao && (
              <p
                role="status"
                className="mb-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200"
              >
                {avisoLigacao}
              </p>
            )}
            {carregando ? (
              <div role="status" className="flex min-h-28 items-center justify-center gap-2 text-sm text-slate-400">
                <Loader2 size={18} className="animate-spin text-emerald-300" aria-hidden="true" />
                Buscando telefones...
              </div>
            ) : erro ? (
              <div role="alert" className="flex min-h-28 flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-rose-300">{erro}</p>
                <button
                  type="button"
                  onClick={() => void carregarTelefones()}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  Tentar novamente
                </button>
              </div>
            ) : telefones.length === 0 ? (
              <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center text-slate-500">
                <Phone size={24} aria-hidden="true" />
                <p className="text-sm">Nenhum telefone vinculado a este card.</p>
              </div>
            ) : (
              <ul className="space-y-2" aria-label="Telefones vinculados ao card">
                {telefones.map((contato) => (
                  <li
                    key={contato.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                      <UserRound size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">{contato.nome}</p>
                      <p className="mt-0.5 text-sm text-emerald-300">{contato.telefone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void iniciarLigacao(contato.telefone)}
                      disabled={telefonesEmLigacao.has(contato.telefone)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                    >
                      {telefonesEmLigacao.has(contato.telefone) ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <PhoneCall size={14} aria-hidden="true" />
                      )}
                      Ligar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
