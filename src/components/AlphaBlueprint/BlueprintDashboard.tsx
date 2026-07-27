"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Compass } from "lucide-react";
import { toast } from "sonner";
import { ListarProjetosBlueprint } from "@/actions/BlueprintProjects";
import { getTema } from "@/lib/temas";
import { BlueprintKanban } from "./BlueprintKanban";
import { BlueprintFilters } from "./BlueprintFilters";
import { BlueprintEmptyDashboard, BlueprintKanbanSkeleton } from "./BlueprintEmptyStates";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { BlueprintOnboarding } from "./BlueprintOnboarding";
import type { ProjetoBlueprintCard } from "./tipos";

const DEBOUNCE_MS = 400;

interface BlueprintDashboardProps {
  temaName?: string;
  onboardingVisto?: boolean;
  userId: number;
}

export function BlueprintDashboard({ temaName = "blue", onboardingVisto = false, userId }: BlueprintDashboardProps) {
  const router = useRouter();
  const tema = getTema(temaName);
  const accent = tema.accent;

  const [projetos, setProjetos] = useState<ProjetoBlueprintCard[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [mostrarOnboarding, setMostrarOnboarding] = useState(!onboardingVisto);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBusca(buscaInput), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [buscaInput]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await ListarProjetosBlueprint({ page: 1, pageSize: 100, busca: busca || undefined, priority: prioridade || undefined });
      if (res.success && Array.isArray(res.data)) {
        setProjetos(res.data as unknown as ProjetoBlueprintCard[]);
      } else {
        setProjetos([]);
        if (res.error) toast.error(typeof res.error === "string" ? res.error : "Erro ao buscar projetos");
      }
    } finally {
      setCarregando(false);
    }
  }, [busca, prioridade]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarDados();
  }, [carregarDados]);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[1600px] mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `rgba(${accent},0.12)` }}>
              <Compass size={20} style={{ color: `rgb(${accent})` }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Alpha Blueprint</h1>
              <p className="text-xs text-slate-500">Central de planejamento, especificação e acompanhamento de sistemas</p>
            </div>
          </div>

          <button
            data-onboarding="novo-sistema"
            onClick={() => setModalNovoAberto(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: `rgba(${accent},0.9)` }}
          >
            <Plus size={16} />
            Novo sistema
          </button>
        </div>

        <div data-onboarding="filtros">
          <BlueprintFilters busca={buscaInput} onBuscaChange={setBuscaInput} prioridade={prioridade} onPrioridadeChange={setPrioridade} />
        </div>

        {carregando ? (
          <BlueprintKanbanSkeleton />
        ) : projetos.length === 0 && !busca && !prioridade ? (
          <BlueprintEmptyDashboard accent={accent} onCriar={() => setModalNovoAberto(true)} />
        ) : (
          <div data-onboarding="kanban">
            <BlueprintKanban
              projetos={projetos}
              accent={accent}
              onAbrirProjeto={(id) => router.push(`/PainelAlpha/AlphaBlueprint/${id}`)}
              onMoverOtimista={(projectId, novoStatus) => {
                setProjetos((atuais) => atuais.map((p) => (p.id === projectId ? { ...p, status: novoStatus } : p)));
              }}
              onFalhaAoMover={carregarDados}
            />
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={modalNovoAberto}
        onOpenChange={setModalNovoAberto}
        requesterId={userId}
        accent={accent}
        onCriado={carregarDados}
      />

      {mostrarOnboarding && (
        <BlueprintOnboarding accent={accent} onFechar={() => setMostrarOnboarding(false)} />
      )}
    </div>
  );
}
