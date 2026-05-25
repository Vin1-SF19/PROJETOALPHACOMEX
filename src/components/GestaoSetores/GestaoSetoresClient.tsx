"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Briefcase, Plus, Trash2, ShieldAlert, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  criarSetor,
  excluirSetor,
  criarCargo,
  excluirCargo,
} from "@/actions/gestaoSetores";

type Setor = {
  id: number;
  nome: string;
  isBase: boolean;
  protegido: boolean;
  totalUsuarios: number;
};

type Cargo = {
  id: number;
  nome: string;
  totalUsuarios: number;
};

type Aba = "setores" | "cargos";

export default function GestaoSetoresClient({
  setoresIniciais,
  cargosIniciais,
}: {
  setoresIniciais: Setor[];
  cargosIniciais: Cargo[];
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("setores");
  const [novoSetor, setNovoSetor] = useState("");
  const [novoCargo, setNovoCargo] = useState("");
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCriarSetor() {
    if (!novoSetor.trim()) return;
    startTransition(async () => {
      const res = await criarSetor(novoSetor);
      if (res.success) {
        toast.success(res.message);
        setNovoSetor("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleExcluirSetor(id: number) {
    startTransition(async () => {
      const res = await excluirSetor(id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
      setConfirmandoId(null);
    });
  }

  function handleCriarCargo() {
    if (!novoCargo.trim()) return;
    startTransition(async () => {
      const res = await criarCargo(novoCargo);
      if (res.success) {
        toast.success(res.message);
        setNovoCargo("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleExcluirCargo(id: number) {
    startTransition(async () => {
      const res = await excluirCargo(id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
      setConfirmandoId(null);
    });
  }

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-600/8 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-blue-600/5 blur-[100px] rounded-full" />
      </div>

      <nav className="relative z-10 w-full px-8 py-5 flex items-center gap-4 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
        <div className="p-2.5 bg-indigo-600/10 rounded-xl border border-indigo-500/20">
          <Building2 size={18} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tighter uppercase italic text-white">
            Gestão de <span className="text-indigo-400">Setores</span>
          </h1>
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
            Setores e Cargos Dinâmicos
          </p>
        </div>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto p-6 lg:p-10 space-y-6">

        {/* Toggle abas */}
        <div className="flex gap-2 p-1 bg-slate-900/60 border border-white/5 rounded-2xl w-fit">
          {(["setores", "cargos"] as Aba[]).map(a => (
            <button
              key={a}
              onClick={() => { setAba(a); setConfirmandoId(null); }}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                aba === a
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {a === "setores" ? (
                <span className="flex items-center gap-1.5"><Building2 size={12} />Setores</span>
              ) : (
                <span className="flex items-center gap-1.5"><Briefcase size={12} />Cargos</span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {aba === "setores" && (
            <motion.div
              key="setores"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {/* Adicionar setor */}
              <div className="flex gap-3">
                <Input
                  value={novoSetor}
                  onChange={e => setNovoSetor(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCriarSetor()}
                  placeholder="NOVO SETOR..."
                  className="h-12 bg-black/40 border-white/5 rounded-xl text-xs font-bold uppercase tracking-widest focus:border-indigo-500/50"
                />
                <Button
                  onClick={handleCriarSetor}
                  disabled={isPending || !novoSetor.trim()}
                  className="h-12 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase"
                >
                  <Plus size={16} />
                </Button>
              </div>

              {/* Lista de setores */}
              <div className="space-y-2">
                {setoresIniciais.map(setor => (
                  <div
                    key={setor.id}
                    className="flex items-center justify-between px-5 py-4 bg-slate-900/40 border border-white/5 rounded-2xl"
                  >
                    <div className="flex items-center gap-3">
                      {setor.protegido && (
                        <ShieldAlert size={14} className="text-amber-500 shrink-0" />
                      )}
                      {setor.isBase && (
                        <span className="text-[8px] font-black px-2 py-0.5 bg-slate-700/60 text-slate-400 rounded-full uppercase tracking-widest">BASE</span>
                      )}
                      <span className="text-xs font-black uppercase tracking-widest text-white">
                        {setor.nome}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                        <Users size={10} />
                        {setor.totalUsuarios}
                      </span>
                    </div>

                    {!setor.protegido && (
                      <div className="flex items-center gap-2">
                        {confirmandoId === setor.id ? (
                          <>
                            {setor.totalUsuarios > 0 && (
                              <span className="flex items-center gap-1 text-[9px] text-amber-400 font-bold">
                                <AlertTriangle size={10} />
                                {setor.totalUsuarios} usuário(s) → DESVINCULADO
                              </span>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleExcluirSetor(setor.id)}
                              disabled={isPending}
                              className="h-7 px-3 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase rounded-lg"
                            >
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmandoId(null)}
                              className="h-7 px-3 text-slate-400 text-[9px] font-black uppercase rounded-lg"
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmandoId(setor.id)}
                            className="p-2 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {aba === "cargos" && (
            <motion.div
              key="cargos"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {/* Adicionar cargo */}
              <div className="flex gap-3">
                <Input
                  value={novoCargo}
                  onChange={e => setNovoCargo(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCriarCargo()}
                  placeholder="NOVO CARGO..."
                  className="h-12 bg-black/40 border-white/5 rounded-xl text-xs font-bold uppercase tracking-widest focus:border-indigo-500/50"
                />
                <Button
                  onClick={handleCriarCargo}
                  disabled={isPending || !novoCargo.trim()}
                  className="h-12 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase"
                >
                  <Plus size={16} />
                </Button>
              </div>

              {/* Lista de cargos */}
              <div className="space-y-2">
                {cargosIniciais.map(cargo => (
                  <div
                    key={cargo.id}
                    className="flex items-center justify-between px-5 py-4 bg-slate-900/40 border border-white/5 rounded-2xl"
                  >
                    <div className="flex items-center gap-3">
                      {cargo.nome === "DESVINCULADO" && (
                        <ShieldAlert size={14} className="text-amber-500 shrink-0" />
                      )}
                      <span className="text-xs font-black uppercase tracking-widest text-white">
                        {cargo.nome}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                        <Users size={10} />
                        {cargo.totalUsuarios}
                      </span>
                    </div>

                    {cargo.nome !== "DESVINCULADO" && (
                      <div className="flex items-center gap-2">
                        {confirmandoId === cargo.id ? (
                          <>
                            {cargo.totalUsuarios > 0 && (
                              <span className="flex items-center gap-1 text-[9px] text-amber-400 font-bold">
                                <AlertTriangle size={10} />
                                {cargo.totalUsuarios} usuário(s) → DESVINCULADO
                              </span>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleExcluirCargo(cargo.id)}
                              disabled={isPending}
                              className="h-7 px-3 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase rounded-lg"
                            >
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmandoId(null)}
                              className="h-7 px-3 text-slate-400 text-[9px] font-black uppercase rounded-lg"
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmandoId(cargo.id)}
                            className="p-2 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
