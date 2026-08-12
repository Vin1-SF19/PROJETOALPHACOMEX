"use client";

import { motion } from "framer-motion";
import { Crown, FileText, FolderOpen, Settings, Users } from "lucide-react";

export interface EquipePastaNota {
  id: string;
  name: string;
  isOwner: boolean;
  owner: { id: number; nome: string };
  members: { userId: number; user: { nome: string } }[];
  _count: { shares: number };
}

interface Props {
  equipes: EquipePastaNota[];
  carregando: boolean;
  accent: string;
  onAbrirEquipe: (teamId: string) => void;
  onConfigurarEquipe: (teamId: string) => void;
}

function Iniciais({ nome }: { nome: string }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-950 bg-slate-800 text-[8px] font-black text-slate-300">
      {nome.slice(0, 2).toUpperCase()}
    </span>
  );
}

function PastaSkeleton() {
  return (
    <div className="h-44 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4">
      <div className="mt-7 h-3 w-2/3 rounded bg-white/5" />
      <div className="mt-3 h-2 w-1/2 rounded bg-white/[0.035]" />
      <div className="mt-14 h-2 w-full rounded bg-white/[0.035]" />
    </div>
  );
}

export function NoteTeamFolderGrid({ equipes, carregando, accent, onAbrirEquipe, onConfigurarEquipe }: Props) {
  if (carregando) {
    return (
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando equipes">
        {Array.from({ length: 3 }).map((_, index) => <PastaSkeleton key={index} />)}
      </div>
    );
  }

  if (equipes.length === 0) {
    return (
      <div className="mb-5 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/15 bg-cyan-400/[0.025] px-4 text-center">
        <FolderOpen size={27} className="mb-2 text-cyan-300/60" />
        <p className="text-xs font-semibold text-slate-400">Nenhuma equipe criada ainda</p>
        <p className="mt-1 text-[11px] text-slate-600">Use “Gerenciar equipes” para criar sua primeira pasta.</p>
      </div>
    );
  }

  return (
    <section className="mb-5" aria-labelledby="pastas-equipes-titulo">
      <div className="mb-2.5 flex items-center gap-2 px-0.5">
        <FolderOpen size={13} className="text-cyan-300" aria-hidden="true" />
        <h2 id="pastas-equipes-titulo" className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          Pastas das equipes
        </h2>
        <span className="text-[10px] text-slate-700">{equipes.length}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {equipes.map((equipe, index) => {
          const pessoas = [equipe.owner.nome, ...equipe.members.map((membro) => membro.user.nome)];
          return (
            <motion.article
              key={equipe.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.25) }}
              whileHover={{ y: -6, scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="group relative h-44 overflow-hidden rounded-2xl text-left shadow-[0_15px_30px_-18px_rgba(0,0,0,0.9)]"
            >
              {/* Aba e fundo da pasta: versão Alpha do componente anexado. */}
              <span
                className="absolute left-0 top-2 h-9 w-[42%] rounded-t-xl border border-b-0"
                style={{
                  background: `linear-gradient(135deg, rgba(${accent},0.28), rgba(15,23,42,0.98))`,
                  borderColor: `rgba(${accent},0.22)`,
                }}
                aria-hidden="true"
              />
              <span
                className="absolute inset-x-0 bottom-0 top-8 rounded-2xl border bg-slate-950"
                style={{ borderColor: `rgba(${accent},0.18)` }}
                aria-hidden="true"
              />

              {/* Folhas/notas empilhadas dentro da pasta. */}
              {[0, 1, 2].map((folha) => (
                <span
                  key={folha}
                  className="absolute left-4 right-4 top-[42px] h-20 rounded-xl border border-white/10 bg-slate-800/90 shadow-xl transition-transform duration-300 group-hover:-translate-y-2"
                  style={{
                    transform: `translateY(${folha * 6}px) rotate(${(folha - 1) * 1.3}deg)`,
                    opacity: 0.72 + folha * 0.1,
                  }}
                  aria-hidden="true"
                >
                  <span className="absolute left-3 top-3 h-1.5 w-2/3 rounded-full bg-white/10" />
                  <span className="absolute left-3 top-7 h-1 w-1/2 rounded-full bg-white/[0.06]" />
                </span>
              ))}

              {/* Frente da pasta. */}
              <span
                className="absolute inset-x-0 bottom-0 top-[76px] rounded-2xl border px-4 pb-3 pt-5 backdrop-blur-xl transition-colors duration-300"
                style={{
                  background: `linear-gradient(145deg, rgba(${accent},0.2), rgba(8,14,27,0.98) 55%)`,
                  borderColor: `rgba(${accent},0.24)`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 -10px 30px rgba(0,0,0,0.3)`,
                }}
              >
                <span className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-100">{equipe.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">Criada por {equipe.owner.nome}</span>
                  </span>
                  {equipe.isOwner && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300/15 bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-200">
                      <Crown size={8} /> Sua
                    </span>
                  )}
                </span>

                <span className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-2">
                  <span className="flex -space-x-1.5">
                    {pessoas.slice(0, 3).map((nome, pessoaIndex) => <Iniciais key={`${nome}-${pessoaIndex}`} nome={nome} />)}
                    {pessoas.length > 3 && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-950 bg-cyan-950 text-[8px] font-black text-cyan-300">+{pessoas.length - 3}</span>
                    )}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-[9px] text-slate-500"><Users size={10} /> {pessoas.length}</span>
                  <span className="flex items-center gap-1 text-[9px] text-slate-500"><FileText size={10} /> {equipe._count.shares}</span>
                </span>
              </span>

              <button
                type="button"
                onClick={() => onAbrirEquipe(equipe.id)}
                aria-label={`Abrir notas da equipe ${equipe.name}, ${pessoas.length} membros e ${equipe._count.shares} notas`}
                className="absolute inset-0 z-30 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400/60"
              />
              <button
                type="button"
                onClick={() => onConfigurarEquipe(equipe.id)}
                aria-label={`Configurar equipe ${equipe.name}`}
                title="Configurar equipe"
                className="absolute right-2.5 top-10 z-40 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-slate-950/85 text-slate-500 opacity-80 shadow-lg backdrop-blur-md transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
              >
                <Settings size={14} aria-hidden="true" />
              </button>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
