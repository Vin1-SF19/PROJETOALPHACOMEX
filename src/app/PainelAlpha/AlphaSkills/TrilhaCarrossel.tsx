"use client";

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Lock, Play, LayoutGrid } from 'lucide-react';

type ModuloTrilha = {
  id: string;
  nome: string;
  imagemUrl: string;
  descricao?: string | null;
  aprendizado?: string | null;
  bloqueado: boolean;
  requerModuloId?: string | null;
  percentualMinimo?: number;
  isLiberado: boolean;
  nomeAnterior?: string;
  nomeExibicao?: string;
  ordemNoCurso?: number;
  setor?: string;
};

export default function TrilhaCarrossel({ setor, onSelectModulo }: { setor: { nome: string; items: ModuloTrilha[] }; onSelectModulo: (modulo: ModuloTrilha) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.addEventListener('scroll', checkScroll);
      checkScroll();
    }
    return () => node?.removeEventListener('scroll', checkScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 10;
        scrollRef.current.scrollBy({
          left: isAtEnd ? -scrollWidth : 320,
          behavior: 'smooth'
        });
      }
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const scroll = (dir: 'l' | 'r') => {
    if (scrollRef.current) {
      const offset = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({ left: dir === 'l' ? -offset : offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group/trilha w-full overflow-visible">
      {/* Header Responsivo */}
      <div className="flex items-end justify-between mb-6 px-1">
        <div className="space-y-1">
          <span className="text-orange-500 font-black text-[10px] uppercase tracking-[0.3em] ml-1">Trilha Alpha</span>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter flex items-center gap-3 italic text-white">
            <span className="w-1.5 h-8 md:h-10 bg-orange-500 rounded-full" />
            {setor.nome}
          </h2>
        </div>

        {/* Controles (Escondidos em mobile) */}
        <div className="hidden md:flex gap-3">
          <button
            onClick={() => scroll('l')}
            disabled={!canScrollLeft}
            className={`p-3 rounded-2xl border transition-all ${canScrollLeft ? 'bg-white/5 border-white/10 hover:bg-orange-600 text-white' : 'opacity-20 text-slate-500 cursor-not-allowed'}`}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => scroll('r')}
            disabled={!canScrollRight}
            className={`p-3 rounded-2xl border transition-all ${canScrollRight ? 'bg-white/5 border-white/10 hover:bg-orange-600 text-white' : 'opacity-20 text-slate-500 cursor-not-allowed'}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Container do Carrossel com Fades de Continuidade */}
      <div className="relative">
        <div className={`absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#050505] to-transparent z-20 pointer-events-none transition-opacity duration-300 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#050505] to-transparent z-20 pointer-events-none transition-opacity duration-300 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />

        <div
          ref={scrollRef}
          className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth pb-8 px-1"
        >
          {setor.items.map((mod) => (
            <motion.div
              key={mod.id}
              whileHover={mod.isLiberado ? { y: -8 } : {}}
              whileTap={mod.isLiberado ? { scale: 0.98 } : {}}
              onClick={() => mod.isLiberado && onSelectModulo(mod)}
              className={`
                relative shrink-0 snap-start
                w-[280px] sm:w-[320px] md:w-[400px] lg:w-[440px] 
                transition-all duration-300
                ${mod.isLiberado ? 'cursor-pointer' : 'cursor-not-allowed'}
              `}
            >
              {!mod.isLiberado && (
                <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-[6px] rounded-[2.5rem] flex flex-col items-center justify-center border border-white/5 p-6 text-center">
                  <div className="bg-[#111] p-4 rounded-full border border-orange-500/20 mb-4 shadow-2xl">
                    <Lock size={24} className="text-orange-500" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Acesso Restrito</span>

                  {/* Aviso dinâmico */}
                  <p className="text-[8px] text-orange-500/80 uppercase mt-3 font-bold leading-relaxed max-w-[180px]">
                    Conclua o módulo <br />
                    <span className="text-white">&quot;{mod.nomeAnterior}&quot;</span> <br />
                    para liberar este conteúdo.
                  </p>
                </div>
              )}

              <div className={`
                relative w-full aspect-[16/10] rounded-[2.5rem] overflow-hidden border transition-all duration-500 shadow-2xl
                ${mod.isLiberado
                  ? 'border-white/5 bg-[#0F0F0F] group-hover/card:border-orange-500/40 shadow-orange-500/5'
                  : 'border-transparent grayscale'
                }
              `}>
                {mod.imagemUrl ? (
                  <img
                    src={mod.imagemUrl}
                    alt={mod.nome}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-orange-950/10">
                    <LayoutGrid className="text-orange-500/10" size={48} />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90 z-10" />

                <div className="absolute bottom-8 left-8 right-8 z-20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-8 h-[2px] bg-orange-500" />
                    <span className="text-[12px] font-black text-orange-500 uppercase tracking-[0.2em]">
                      Alpha Cursos
                    </span>
                  </div>

                  <h3 className={`text-lg md:text-2xl font-black uppercase tracking-tight transition-colors ${mod.isLiberado ? 'text-white' : 'text-white/20'}`}>
                    <div className="text-[16px] opacity-70 mb-1">
                      {mod.nomeExibicao}
                    </div>
                    <div className="line-clamp-2 leading-none">
                      {mod.nome}
                    </div>
                  </h3>
                </div>

                {mod.isLiberado && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-all z-30 bg-black/40 backdrop-blur-[2px]">
                    <div className="bg-orange-600 p-5 rounded-full shadow-2xl shadow-orange-600/40 transform translate-y-4 hover:translate-y-0 transition-all">
                      <Play fill="white" size={24} className="ml-1 text-white" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
