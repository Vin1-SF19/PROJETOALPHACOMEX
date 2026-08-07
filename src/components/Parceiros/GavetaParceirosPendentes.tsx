"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ChevronDown,
  Clock3,
  Handshake,
  Phone,
  UserPlus,
} from "lucide-react";
import type { ParceiroPendenteCadastro } from "@/lib/comercial/parceiro-nao-cadastrado";

interface GavetaParceirosPendentesProps {
  pendencias: ParceiroPendenteCadastro[];
  accent: string;
}

export function GavetaParceirosPendentes({ pendencias, accent }: GavetaParceirosPendentesProps) {
  const [isAberta, setIsAberta] = useState(false);
  const reduceMotion = useReducedMotion();
  const conteudoId = useId();
  const total = pendencias.length;

  if (total === 0) return null;

  return (
    <section
      data-guia-parceiros="pendentes-metas"
      aria-labelledby={`${conteudoId}-titulo`}
      className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-[0_16px_50px_rgba(2,6,23,0.28)] backdrop-blur-xl"
      style={{ boxShadow: `0 16px 50px rgba(2,6,23,0.28), 0 0 0 1px rgba(${accent},0.06)` }}
    >
      <button
        type="button"
        aria-expanded={isAberta}
        aria-controls={conteudoId}
        onClick={() => setIsAberta((valorAtual) => !valorAtual)}
        className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
        style={{ outlineColor: `rgba(${accent},0.8)` }}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
          style={{ background: `rgba(${accent},0.1)`, borderColor: `rgba(${accent},0.24)`, color: `rgba(${accent},1)` }}
        >
          <UserPlus size={16} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span id={`${conteudoId}-titulo`} className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-100">
              Parceiros aguardando cadastro
            </span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-amber-950">
              {total}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500">
            {isAberta
              ? "Lista aberta · clique para recolher"
              : `${total} ${total === 1 ? "pendência" : "pendências"} do Alpha Metas · clique para visualizar`}
          </span>
        </span>

        <span className="hidden text-[9px] font-black uppercase tracking-widest text-slate-500 sm:block">
          {isAberta ? "Recolher" : "Abrir gaveta"}
        </span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: isAberta ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 group-hover:text-slate-200"
        >
          <ChevronDown size={15} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isAberta && (
          <motion.div
            id={conteudoId}
            role="region"
            aria-label="Cadastros de parceiros pendentes"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-white/[0.08]"
          >
            <div className="border-b border-white/[0.06] bg-white/[0.025] px-4 py-2.5">
              <p className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                Finalize os dados para transformar cada pendência em um parceiro cadastrado.
              </p>
            </div>

            <div className="max-h-[460px] overflow-y-auto overscroll-contain p-3 [scrollbar-color:rgba(148,163,184,0.28)_transparent] [scrollbar-width:thin] sm:p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pendencias.map((pendencia) => (
                  <article
                    key={pendencia.contratoId}
                    className="flex flex-col gap-3 rounded-2xl border border-white/[0.09] bg-slate-900/65 p-4 transition-colors duration-150 hover:border-white/[0.16] hover:bg-slate-900/90"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-slate-400">
                        <UserPlus size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">{pendencia.nome}</p>
                        <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-amber-400">
                          Não cadastrado
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-slate-400">
                      {pendencia.empresa && (
                        <p className="flex items-center gap-2">
                          <Building2 size={12} className="shrink-0 text-slate-600" />
                          <span className="truncate">{pendencia.empresa}</span>
                        </p>
                      )}
                      {pendencia.telefone && (
                        <p className="flex items-center gap-2">
                          <Phone size={12} className="shrink-0 text-slate-600" />
                          <span>{pendencia.telefone}</span>
                        </p>
                      )}
                      <p className="flex items-center gap-2">
                        <Handshake size={12} className="shrink-0 text-slate-600" />
                        <span className="truncate">Indicou {pendencia.clienteNomeFantasia || pendencia.clienteRazaoSocial}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock3 size={12} className="shrink-0 text-slate-600" />
                        <span>Registrado em {new Date(pendencia.criadoEm).toLocaleDateString("pt-BR")}</span>
                      </p>
                    </div>

                    <Link
                      href={`/PainelAlpha/Parceiros/novo?origemContratoId=${encodeURIComponent(pendencia.contratoId)}`}
                      className="mt-auto flex h-10 items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-black transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98]"
                      style={{ background: `rgba(${accent},1)` }}
                    >
                      Finalizar cadastro <ArrowRight size={13} />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
