"use client";

import { motion } from "framer-motion";
import { Globe, Users } from "lucide-react";
import AbaGestaoEquipe from "@/components/cadastro/AbaGestaoEquipe";

interface Props {
  currentUserRole?: string;
}

export default function GestaoColaboradoresClient({ currentUserRole = "RECURSOS HUMANOS" }: Props) {
  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col relative">

      {/* BG glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-teal-600/8 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-cyan-600/5 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />
      </div>

      {/* Header */}
      <nav className="relative z-10 w-full px-8 py-5 flex items-center justify-between border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-600/10 rounded-2xl border border-teal-500/20 shadow-lg">
            <Users className="text-teal-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic text-white">
              GESTÃO DE <span className="text-teal-400">COLABORADORES</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Globe size={10} className="text-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Network: Online</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 flex-1 p-6 lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <AbaGestaoEquipe currentUserRole={currentUserRole} />
        </motion.div>
      </div>
    </main>
  );
}
