"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getTema } from "@/lib/temas";
import type { ObterProjetoBlueprint } from "@/actions/BlueprintProjects";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectSidebar, type AbaProjeto } from "./ProjectSidebar";
import { ProjectOverview } from "./ProjectOverview";
import { SpecificationEditor } from "./SpecificationEditor";
import { BlueprintCanvas } from "./BlueprintCanvas";
import { ProjectFiles } from "./ProjectFiles";
import { RequirementsPanel } from "./RequirementsPanel";
import { QuestionsPanel } from "./QuestionsPanel";
import { CommentsPanel } from "./CommentsPanel";
import { ProjectActivity } from "./ProjectActivity";
import { BlueprintAIPanel } from "./BlueprintAIPanel";

type ProjetoDetalhado = NonNullable<Awaited<ReturnType<typeof ObterProjetoBlueprint>>["data"]>;

interface ProjectWorkspaceProps {
  projeto: ProjetoDetalhado;
  temaName: string;
  userId: number;
}

export function ProjectWorkspace({ projeto, temaName, userId }: ProjectWorkspaceProps) {
  const router = useRouter();
  const tema = getTema(temaName);
  const accent = tema.accent;
  const [aba, setAba] = useState<AbaProjeto>("visao-geral");

  return (
    <div className="min-h-screen flex flex-col">
      <ProjectHeader projeto={projeto} onVoltar={() => router.push("/PainelAlpha/AlphaBlueprint")} />

      <div className="flex flex-1 min-h-0">
        <ProjectSidebar abaAtiva={aba} onMudarAba={setAba} accent={accent} />

        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          {aba === "visao-geral" && (
            <ProjectOverview projeto={projeto} accent={accent} userId={userId} onNavegar={setAba} />
          )}
          {aba === "especificacao" && <SpecificationEditor projectId={projeto.id} accent={accent} />}
          {aba === "canvas" && <BlueprintCanvas projectId={projeto.id} accent={accent} />}
          {aba === "arquivos" && <ProjectFiles projectId={projeto.id} accent={accent} />}
          {aba === "requisitos" && <RequirementsPanel projectId={projeto.id} accent={accent} />}
          {aba === "comentarios" && <CommentsPanel projectId={projeto.id} accent={accent} userId={userId} />}
          {aba === "ia" && <BlueprintAIPanel projectId={projeto.id} accent={accent} />}
          {aba === "atividade" && <ProjectActivity projectId={projeto.id} />}
        </div>
      </div>

      {/* Perguntas fica acessível a partir da Visão Geral via badge de pendências, mas também
          tem aba própria para consulta direta — reaproveitado via mesma estrutura de painel */}
      {aba === "perguntas" && (
        <div className="fixed inset-0 z-40 bg-[#020617] p-6 overflow-y-auto">
          <QuestionsPanel projectId={projeto.id} accent={accent} onFechar={() => setAba("visao-geral")} />
        </div>
      )}
    </div>
  );
}

export type { ProjetoDetalhado };
