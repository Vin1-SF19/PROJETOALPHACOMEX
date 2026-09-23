"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { X, Clock, Play, Lock, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

type VideoModulo = {
  id: string;
  titulo: string;
  url: string;
  thumbUrl?: string | null;
  modulo?: { id: string; nome: string }[];
  moduloId?: string;
};
type ModuloResumo = {
  id: string;
  nome: string;
  nomeExibicao?: string;
  setor?: string;
  descricao?: string | null;
  isLiberado: boolean;
  imagemUrl?: string | null;
};

export default function ModuloModal({ modulo, videos, onClose }: { modulo: ModuloResumo; videos: VideoModulo[]; onClose: () => void }) {
  const router = useRouter();

  const aulasDoModulo = videos.filter((v) =>
    v.modulo?.some((m) => String(m.id) === String(modulo.id)) || v.moduloId === modulo.id
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
      />

      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0, filter: "blur(20px)" }}
        transition={{ type: "spring", damping: 30, stiffness: 200 }}
        className="relative w-full max-w-6xl h-[92vh] md:h-auto max-h-[90vh] bg-[#0A0A0A] rounded-t-[3rem] md:rounded-[3.5rem] border-t md:border border-white/10 overflow-hidden shadow-2xl"
      >

        <div className="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden">

          <div className="w-full md:w-2/5 p-8 md:p-12 border-b md:border-b-0 md:border-r border-white/5 bg-gradient-to-b from-orange-600/10 via-transparent to-transparent flex flex-col">
            <button
              onClick={onClose}
              className="w-fit mb-12 p-4 bg-white/5 hover:bg-orange-600 rounded-2xl text-white transition-all duration-300"
            >
              <X size={20} />
            </button>

            <span className="px-3 py-1 bg-orange-600/10 border border-orange-500/20 rounded-lg text-orange-500 font-black uppercase tracking-[0.2em] text-[10px] w-fit mb-6">
              Setor {modulo.setor}
            </span>

            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6 leading-none italic">
              {modulo.nome}
            </h2>

            <p className="text-slate-400 text-sm md:text-lg leading-relaxed mb-10 font-medium">
              {modulo.descricao || "Explore este módulo para dominar novas habilidades e elevar seu nível técnico."}
            </p>

            <div className="mt-auto grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-3xl border border-white/5">
                <Clock size={18} className="text-orange-500" />
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Conteúdo</span>
                <span className="text-white font-bold text-sm italic">Cloud Alpha</span>
              </div>
              <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-3xl border border-white/5">
                <Play size={18} className="text-orange-500" />
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Aulas</span>
                <span className="text-white font-bold text-sm italic">{aulasDoModulo.length} Vídeos</span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 md:p-16 bg-[#020202] flex items-center justify-center relative overflow-hidden">
            <div className="absolute w-[600px] h-[600px] bg-orange-600/5 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
              whileHover={modulo.isLiberado ? { scale: 1.015, y: -4 } : {}}
              onClick={() => modulo.isLiberado && router.push(`/PainelAlpha/AlphaSkills/modulo/${modulo.id}`)}
              className={`relative w-full max-w-xl aspect-video rounded-3xl overflow-hidden transition-all duration-500 group ${modulo.isLiberado
                  ? 'bg-[#050505] border border-white/10 hover:border-orange-500/40 cursor-pointer shadow-2xl'
                  : 'bg-[#080808] border border-white/5 cursor-not-allowed opacity-80'
                }`}
            >
              <div className="absolute top-0 inset-x-0 h-10 flex items-center justify-between px-5 border-b border-white/5 bg-black/40 backdrop-blur-md z-30">
                <div className="flex gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${modulo.isLiberado ? 'bg-red-500/40' : 'bg-zinc-700'}`} />
                  <div className={`w-2.5 h-2.5 rounded-full ${modulo.isLiberado ? 'bg-yellow-500/40' : 'bg-zinc-700'}`} />
                  <div className={`w-2.5 h-2.5 rounded-full ${modulo.isLiberado ? 'bg-green-500/40' : 'bg-zinc-700'}`} />
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                    Alpha Cursos
                  </span>
                </div>
              </div>

              <div className="absolute inset-0 top-10 pointer-events-none z-0 flex items-center justify-center">
                <motion.img
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 0.05, scale: 1 }}
                  src="/FundoLogin.png"
                  className="w-[70%] object-contain filter grayscale brightness-200"
                  alt="Background"
                />
              </div>

              <div className="absolute inset-0 top-10 flex flex-col justify-between p-8 z-20">

                {/* Play/Lock Button */}
                <div className="flex-1 flex items-center justify-center">
                  {modulo.isLiberado ? (
                    <div className="relative">
                      <div className="absolute inset-0 bg-orange-600 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center shadow-2xl transition-all duration-500 group-hover:rotate-[135deg]">
                        <Play fill="white" size={22} className="ml-1 group-hover:-rotate-[135deg] transition-all" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center">
                      <Lock size={18} className="text-zinc-700" />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-[1px] bg-orange-500" />
                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-[0.2em]">
                      {modulo.nomeExibicao?.split(':')[0] || "Módulo"}
                    </p>
                  </div>

                  <h3 className={`text-3xl font-black uppercase tracking-tighter transition-colors ${modulo.isLiberado ? 'text-white' : 'text-zinc-700'
                    }`}>
                    {modulo.nome}
                  </h3>

                  {modulo.isLiberado && (
                    <div className="mt-4 flex items-center gap-2 text-orange-500 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all duration-500">
                      <span>Iniciar Treinamento</span>
                      <ChevronRight size={14} />
                    </div>
                  )}
                </div>
              </div>

              {modulo.isLiberado && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-tr from-orange-600/[0.03] via-transparent to-white/[0.02] pointer-events-none" />
              )}
            </motion.div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
