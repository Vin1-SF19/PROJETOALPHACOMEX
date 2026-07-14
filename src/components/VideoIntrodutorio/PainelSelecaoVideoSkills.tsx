"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Search, Loader2, Film, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { buscarVideosAlphaSkills } from "@/actions/video-introdutorio";

type VideoResultado = Awaited<ReturnType<typeof buscarVideosAlphaSkills>>["data"][number];

interface PainelSelecaoVideoSkillsProps {
  videoSelecionadoId: string | null;
  onSelecionar: (video: { id: string; titulo: string; url: string; thumbUrl: string | null }) => void;
}

const PAGE_SIZE = 12;
const DEBOUNCE_MS = 400;

/**
 * Painel de busca/seleção de vídeos do Alpha Skills. Busca combinada por
 * módulo/curso/nome do vídeo, com debounce, paginação server-side (via
 * buscarVideosAlphaSkills — só Admin/CEO) e seleção visual.
 */
export function PainelSelecaoVideoSkills({ videoSelecionadoId, onSelecionar }: PainelSelecaoVideoSkillsProps) {
  const [moduloNome, setModuloNome] = useState("");
  const [cursoNome, setCursoNome] = useState("");
  const [videoNome, setVideoNome] = useState("");
  const [page, setPage] = useState(1);

  const [resultados, setResultados] = useState<VideoResultado[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const timer = setTimeout(async () => {
      setCarregando(true);
      setErro(null);
      const res = await buscarVideosAlphaSkills({
        moduloNome: moduloNome.trim() || undefined,
        cursoNome: cursoNome.trim() || undefined,
        videoNome: videoNome.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (cancelado) return;
      if (res.success) {
        setResultados(res.data);
        setTotalPages(res.pagination?.totalPages ?? 1);
      } else {
        setErro(res.error ?? "Erro ao buscar vídeos");
        setResultados([]);
      }
      setCarregando(false);
    }, DEBOUNCE_MS);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [moduloNome, cursoNome, videoNome, page]);

  const podeVoltar = page > 1;
  const podeAvancar = page < totalPages;

  // Cada onChange já reseta a página para 1 no próprio evento que altera o
  // filtro — evita o antipadrão de "efeito observando estado só para
  // resetar outro estado" (React 19 bloqueia setState síncrono em useEffect).
  const campos = useMemo(
    () => [
      { label: "Módulo", valor: moduloNome, onChange: (v: string) => { setModuloNome(v); setPage(1); }, placeholder: "Nome do módulo..." },
      { label: "Curso", valor: cursoNome, onChange: (v: string) => { setCursoNome(v); setPage(1); }, placeholder: "Nome do curso..." },
      { label: "Vídeo", valor: videoNome, onChange: (v: string) => { setVideoNome(v); setPage(1); }, placeholder: "Nome do vídeo..." },
    ],
    [moduloNome, cursoNome, videoNome],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
        {campos.map((campo) => (
          <div key={campo.label} className="relative">
            <label className="sr-only">{campo.label}</label>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              type="text"
              value={campo.valor}
              onChange={(e) => campo.onChange(e.target.value)}
              placeholder={campo.placeholder}
              className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto mt-3 -mx-1 px-1">
        {carregando ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-600">
            <Loader2 size={22} className="animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest">Buscando vídeos...</p>
          </div>
        ) : erro ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-rose-400">
            <p className="text-[11px] font-bold">{erro}</p>
          </div>
        ) : resultados.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-600">
            <Film size={28} strokeWidth={1.2} />
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum vídeo encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {resultados.map((video) => {
              const selecionado = video.id === videoSelecionadoId;
              return (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => onSelecionar({ id: video.id, titulo: video.titulo, url: video.url, thumbUrl: video.thumbUrl })}
                  className={`relative flex flex-col gap-2 rounded-xl p-2.5 text-left transition-all border ${
                    selecionado ? "bg-indigo-500/15 border-indigo-500/50" : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10"
                  }`}
                >
                  {selecionado && (
                    <span className="absolute top-1.5 right-1.5 z-10 text-indigo-400">
                      <CheckCircle2 size={16} aria-hidden="true" />
                    </span>
                  )}
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-900 border border-white/5">
                    {video.thumbUrl ? (
                      <Image src={video.thumbUrl} alt={video.titulo} fill sizes="200px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-slate-700">
                        <Film size={22} strokeWidth={1.2} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-white truncate">{video.titulo}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {video.modulos.slice(0, 2).map((nome) => (
                        <span key={nome} className="text-[8.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {nome}
                        </span>
                      ))}
                      {video.cursos.slice(0, 1).map((nome) => (
                        <span key={nome} className="text-[8.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                          {nome}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!carregando && resultados.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-3 mt-1 border-t border-white/5 shrink-0">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!podeVoltar}
            className="h-8 px-3 flex items-center gap-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={13} /> Anterior
          </button>
          <span className="text-[10px] font-bold text-slate-500">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!podeAvancar}
            className="h-8 px-3 flex items-center gap-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Próxima <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
