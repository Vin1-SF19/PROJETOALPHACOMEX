"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, FolderGit2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  ArquivarRoadmapWorkspace,
  ListarRoadmapWorkspaces,
} from "@/actions/RoadmapWorkspaces";
import { Button } from "@/components/ui/button";
import { NovoProjetoExternoDialog } from "@/components/RoadmapAlpha/NovoProjetoExternoDialog";

interface WorkspaceView {
  id: string;
  moduleKey: string;
  label: string;
  rootPath: string | null;
  status: string;
  createdAt: string;
  createdBy: { id: number; nome: string };
}

interface SistemasExternosSectionProps {
  isAdmin: boolean;
  selectedModuleKey: string | null;
  onSelectModule: (moduleKey: string, label: string) => void;
}

export function SistemasExternosSection({
  isAdmin,
  selectedModuleKey,
  onSelectModule,
}: SistemasExternosSectionProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    const result = await ListarRoadmapWorkspaces();
    if (result.success) {
      setWorkspaces(result.data);
      setLoadError(null);
    } else {
      setWorkspaces([]);
      setLoadError(result.error);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-[11px] leading-5 text-slate-500">
          Projetos fora do PainelAlpha, cada um com sua própria fila de fases
          de produção acompanhada via chat.
        </p>
        {isAdmin && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          >
            <Plus size={16} /> Novo projeto
          </Button>
        )}
      </div>

      {workspaces === null && !loadError && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-8 text-xs text-slate-500">
          <Loader2 className="animate-spin" size={14} /> Carregando…
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-dashed border-amber-400/20 bg-amber-400/[.04] px-3 py-4 text-center text-xs text-amber-300/80">
          {loadError}
        </div>
      )}

      {workspaces !== null && !loadError && workspaces.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-slate-500">
          Nenhum projeto externo registrado ainda.
        </div>
      )}

      {workspaces !== null && workspaces.length > 0 && (
        <div className="space-y-2">
          {workspaces.map((workspace) => (
            <article
              key={workspace.id}
              onClick={() => onSelectModule(workspace.moduleKey, workspace.label)}
              className={`group cursor-pointer rounded-xl border p-3 transition ${selectedModuleKey === workspace.moduleKey ? "border-cyan-400/30 bg-cyan-400/[.07]" : "border-white/10 bg-white/[.025] hover:border-white/20"}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                  <FolderGit2 size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xs font-medium text-slate-100">
                    {workspace.label}
                  </h3>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {workspace.rootPath ?? "Caminho visível apenas para Admin"}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      title="Arquivar projeto"
                      onClick={async (event) => {
                        event.stopPropagation();
                        if (
                          !window.confirm(
                            `Arquivar "${workspace.label}"? O registro fica preservado, mas ele sai da lista ativa.`,
                          )
                        )
                          return;
                        const result = await ArquivarRoadmapWorkspace(
                          workspace.id,
                        );
                        if (!result.success) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Projeto arquivado");
                        await refresh();
                      }}
                      className="rounded-md p-1 text-slate-600 hover:bg-rose-400/10 hover:text-rose-300"
                    >
                      <Archive size={13} />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <NovoProjetoExternoDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          void refresh();
        }}
      />
    </div>
  );
}
