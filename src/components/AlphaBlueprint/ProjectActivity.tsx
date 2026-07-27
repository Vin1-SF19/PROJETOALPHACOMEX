"use client";

import { useEffect, useState } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { ListarAtividadeBlueprint } from "@/actions/BlueprintProjects";

interface AtividadeItem {
  id: string;
  action: string;
  entityType: string;
  createdAt: string | Date;
  nomeUsuario: string;
}

const ACAO_LABEL: Record<string, string> = {
  CRIACAO: "criou",
  ATUALIZACAO: "atualizou",
  EXCLUSAO: "excluiu",
  MOVER_ETAPA: "moveu",
  ARQUIVAMENTO: "arquivou",
  RESTAURACAO: "restaurou",
  UPLOAD: "enviou arquivo em",
  RESPOSTA: "respondeu",
  RESOLUCAO: "resolveu",
  ADICAO_MEMBRO: "adicionou membro em",
  REMOCAO_MEMBRO: "removeu membro de",
};

const ENTIDADE_LABEL: Record<string, string> = {
  PROJETO: "projeto",
  DOCUMENTO: "documento",
  CANVAS: "canvas",
  ARQUIVO: "arquivo",
  REQUISITO: "requisito",
  PERGUNTA: "pergunta",
  COMENTARIO: "comentário",
  MEMBRO: "membro",
};

interface ProjectActivityProps {
  projectId: string;
}

export function ProjectActivity({ projectId }: ProjectActivityProps) {
  const [atividades, setAtividades] = useState<AtividadeItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const res = await ListarAtividadeBlueprint(projectId);
      if (res.success && res.data) setAtividades(res.data as unknown as AtividadeItem[]);
      setCarregando(false);
    }
    carregar();
  }, [projectId]);

  if (carregando) {
    return (
      <div className="max-w-2xl space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded-xl bg-white/[0.03] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <ActivityIcon size={15} />
        Histórico de atividade
      </h2>

      <div className="space-y-1">
        {atividades.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm py-2 border-b border-white/5">
            <span className="text-slate-300 font-medium">{a.nomeUsuario}</span>
            <span className="text-slate-500">{ACAO_LABEL[a.action] ?? a.action.toLowerCase()}</span>
            <span className="text-slate-400">{ENTIDADE_LABEL[a.entityType] ?? a.entityType.toLowerCase()}</span>
            <span className="ml-auto text-xs text-slate-600">{new Date(a.createdAt).toLocaleString("pt-BR")}</span>
          </div>
        ))}
        {atividades.length === 0 && <p className="text-sm text-slate-500 text-center py-6">Nenhuma atividade registrada</p>}
      </div>
    </div>
  );
}
