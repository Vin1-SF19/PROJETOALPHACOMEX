"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListarRequisitosBlueprint, CriarRequisitoBlueprint, AtualizarRequisitoBlueprint } from "@/actions/BlueprintRequirements";
import { BLUEPRINT_REQUISITO_TIPO, BLUEPRINT_REQUISITO_STATUS } from "@/lib/validations/blueprint";

interface Requisito {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
}

interface RequirementsPanelProps {
  projectId: string;
  accent: string;
}

const STATUS_COR: Record<string, string> = {
  RASCUNHO: "148,163,184",
  PENDENTE: "251,191,36",
  EM_VALIDACAO: "96,165,250",
  APROVADO: "52,211,153",
  EM_DESENVOLVIMENTO: "168,85,247",
  CONCLUIDO: "34,197,94",
  DESCARTADO: "100,116,139",
};

export function RequirementsPanel({ projectId, accent }: RequirementsPanelProps) {
  const [requisitos, setRequisitos] = useState<Requisito[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoAberto, setNovoAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<string>("FUNCIONAL");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await ListarRequisitosBlueprint(projectId);
    if (res.success && res.data) setRequisitos(res.data as unknown as Requisito[]);
    setCarregando(false);
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function criar() {
    if (!titulo.trim()) return;
    const res = await CriarRequisitoBlueprint({ projectId, title: titulo.trim(), type: tipo });
    if (res.success) {
      setTitulo("");
      setNovoAberto(false);
      carregar();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao criar requisito");
    }
  }

  async function mudarStatus(requirementId: string, status: string) {
    const res = await AtualizarRequisitoBlueprint({ requirementId, status });
    if (res.success) carregar();
    else toast.error("Erro ao atualizar status");
  }

  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Requisitos</h2>
        <button
          onClick={() => setNovoAberto((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-lg"
          style={{ background: `rgba(${accent},0.9)` }}
        >
          <Plus size={13} />
          Novo requisito
        </button>
      </div>

      {novoAberto && (
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 space-y-2">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título do requisito"
            className="w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-48 bg-slate-950/60 border-white/10 text-white text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLUEPRINT_REQUISITO_TIPO.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={criar} className="text-xs font-medium text-white px-3 py-1.5 rounded-lg" style={{ background: `rgba(${accent},0.9)` }}>
              Adicionar
            </button>
          </div>
        </div>
      )}

      {carregando ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />)}
        </div>
      ) : requisitos.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">Nenhum requisito registrado ainda</p>
      ) : (
        <div className="space-y-2">
          {requisitos.map((req) => (
            <div key={req.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-3 flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-500 shrink-0">{req.code}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{req.title}</p>
                <p className="text-[10px] text-slate-500">{req.type.replace(/_/g, " ")}</p>
              </div>
              <Select value={req.status} onValueChange={(v) => mudarStatus(req.id, v)}>
                <SelectTrigger
                  className="w-40 text-xs rounded-lg border-0"
                  style={{ background: `rgba(${STATUS_COR[req.status] ?? "148,163,184"},0.15)`, color: `rgb(${STATUS_COR[req.status] ?? "148,163,184"})` }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLUEPRINT_REQUISITO_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
