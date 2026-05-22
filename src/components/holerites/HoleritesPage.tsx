"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import MeusHoleritesView from "./MeusHoleritesView";
import GestaoHoleritesView from "./GestaoHoleritesView";
import { HoleriteAlertButtons } from "./HoleriteAlertButtons";

const ROLES_GESTAO = ["Admin", "FINANCEIRO", "CEO", "RECURSOS HUMANOS"];

type Tab = "gestao" | "meus";

export default function HoleritesPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("gestao");

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-500 text-xs font-black uppercase">
        Carregando...
      </div>
    );
  }

  const user = session?.user as
    | { id: string; role: string; nome?: string; imagemUrl?: string }
    | undefined;

  const role = user?.role ?? "";
  const isGestao = ROLES_GESTAO.includes(role);
  const userId = Number(user?.id ?? 0);

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 shrink-0">
          <Image src="/bank-check.png" alt="Holerites" width={28} height={28} />
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-teal-500">
            {isGestao ? "Gestão · RH / Financeiro" : "Meus Documentos"}
          </p>
          <h1 className="text-xl font-black text-white">Alpha Holerites</h1>
        </div>
      </motion.div>

      <HoleriteAlertButtons role={role} />

      {isGestao ? (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-white/5 pb-0">
            {(["gestao", "meus"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`h-9 px-5 rounded-t-xl text-[10px] font-black uppercase tracking-widest transition-all border-b-2
                  ${tab === t
                    ? "text-teal-300 border-teal-500 bg-teal-500/5"
                    : "text-slate-500 border-transparent hover:text-slate-300"}`}
              >
                {t === "gestao" ? "Gestão Geral" : "Meus Holerites"}
              </button>
            ))}
          </div>

          {tab === "gestao" ? (
            <GestaoHoleritesView />
          ) : (
            <MeusHoleritesView userId={userId} />
          )}
        </>
      ) : (
        <MeusHoleritesView userId={userId} />
      )}
    </div>
  );
}
