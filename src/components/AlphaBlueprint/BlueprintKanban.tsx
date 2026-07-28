"use client";

import { useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { MoverProjetoBlueprint } from "@/actions/BlueprintProjects";
import { BlueprintColumn } from "./BlueprintColumn";
import { BlueprintProjectCard } from "./BlueprintProjectCard";
import { STATUS_ORDEM, type ProjetoBlueprintCard } from "./tipos";

interface BlueprintKanbanProps {
  projetos: ProjetoBlueprintCard[];
  accent: string;
  modoSelecao?: boolean;
  selecionados?: Set<string>;
  onToggleSelecionado?: (id: string) => void;
  onAbrirProjeto: (id: string) => void;
  onMoverOtimista: (projectId: string, novoStatus: string) => void;
  onFalhaAoMover: () => void;
}

export function BlueprintKanban({
  projetos, accent, modoSelecao = false, selecionados, onToggleSelecionado, onAbrirProjeto, onMoverOtimista, onFalhaAoMover,
}: BlueprintKanbanProps) {
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const projetoAtivo = projetos.find((p) => p.id === ativoId) ?? null;

  const colunas = STATUS_ORDEM.map((status) => ({
    status,
    projetos: projetos.filter((p) => p.status === status),
  }));

  function handleDragStart(event: DragStartEvent) {
    if (modoSelecao) return;
    setAtivoId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (modoSelecao) return;
    setAtivoId(null);
    const { active, over } = event;
    if (!over) return;

    const projetoId = String(active.id);
    const projetoAtual = projetos.find((p) => p.id === projetoId);
    if (!projetoAtual) return;

    // `over.id` pode ser o status da coluna (drop na área vazia) ou o id de outro card
    // (drop sobre um card já existente) — nos dois casos, o card do destino diz a coluna.
    const overId = String(over.id);
    const novoStatus = STATUS_ORDEM.includes(overId as (typeof STATUS_ORDEM)[number])
      ? overId
      : projetos.find((p) => p.id === overId)?.status;

    if (!novoStatus || novoStatus === projetoAtual.status) return;

    // Optimistic update: aplica a mudança visualmente de imediato para evitar o card
    // "saltando de volta" à coluna original enquanto aguarda o round-trip do servidor.
    onMoverOtimista(projetoId, novoStatus);

    const res = await MoverProjetoBlueprint({ projectId: projetoId, novoStatus });
    if (!res.success) {
      toast.error(typeof res.error === "string" ? res.error : "Não foi possível mover o projeto");
      onFalhaAoMover();
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
        {colunas.map(({ status, projetos: projetosColuna }) => (
          <BlueprintColumn
            key={status}
            status={status}
            projetos={projetosColuna}
            accent={accent}
            modoSelecao={modoSelecao}
            selecionados={selecionados}
            onToggleSelecionado={onToggleSelecionado}
            onAbrirProjeto={onAbrirProjeto}
          />
        ))}
      </div>

      <DragOverlay>
        {projetoAtivo && (
          <div style={{ transform: "rotate(-2deg)" }}>
            <BlueprintProjectCard projeto={projetoAtivo} accent={accent} onAbrir={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
