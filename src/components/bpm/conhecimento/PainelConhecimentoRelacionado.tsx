"use client";

import { useEffect, useState } from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import { ListarConhecimentoLinksBpm } from "@/actions/bpm/Conhecimento";

type Link = { id: string; titulo: string; url: string; descricao: string | null; ordem: number };

export function PainelConhecimentoRelacionado({ pipelineId, accent }: { pipelineId: string; accent: string }) {
  const [links, setLinks] = useState<Link[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    ListarConhecimentoLinksBpm(pipelineId).then((res) => {
      if (res.success) setLinks(res.data);
      setCarregado(true);
    });
  }, [pipelineId]);

  if (!carregado || links.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <BookOpen size={11} /> Documentos relacionados
      </div>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5"
        >
          <ExternalLink size={12} className="shrink-0" style={{ color: `rgb(${accent})` }} />
          <span className="min-w-0 flex-1 truncate">{link.titulo}</span>
        </a>
      ))}
    </div>
  );
}
