"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ListarTimelineCardBpm } from "@/actions/bpm/Timeline";
import { Timeline } from "@/components/PerfilEmpresaGlobal/Timeline";
import type { TimelineEvent } from "@/lib/timeline/types";

interface Props {
  cardId: string;
}

/** Timeline unificada do card (RM-2026-D6D970): agrega histórico, interações, tarefas, checklists, automações e SLA já persistidos, sem duplicar dados. */
export default function PainelTimelineCard({ cardId }: Props) {
  const [eventos, setEventos] = useState<TimelineEvent[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    ListarTimelineCardBpm(cardId).then((res) => {
      if (!ativo) return;
      if (res.success) setEventos(res.data);
      else setErro(res.error);
    });
    return () => {
      ativo = false;
    };
  }, [cardId]);

  if (erro) return <p className="text-xs text-rose-400">{erro}</p>;

  if (eventos === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-slate-500" />
      </div>
    );
  }

  if (eventos.length === 0) {
    return <p className="text-xs text-slate-600">Nenhum evento registrado ainda.</p>;
  }

  return <Timeline events={eventos} />;
}
