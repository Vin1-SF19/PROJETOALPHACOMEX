"use client";

import { useEffect, useState } from "react";
import { Plus, FileText, Pin, Star } from "lucide-react";
import { toast } from "sonner";
import { ListarNotasDoContexto, VincularContextoNota } from "@/actions/NotasContexto";
import { CriarNota } from "@/actions/Notas";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { AbrirAbaNota } from "@/actions/NotasWorkspace";

interface NotaDoContexto {
  id: string;
  title: string;
  visibility: string;
  isPinned: boolean;
  isFavorite: boolean;
  updatedAt: Date | string;
}

interface NotesContextPanelProps {
  moduleKey: string;
  entityType: string;
  entityId: string;
  displayName: string;
  internalPath: string;
}

export function NotesContextPanel({ moduleKey, entityType, entityId, displayName, internalPath }: NotesContextPanelProps) {
  const [notas, setNotas] = useState<NotaDoContexto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const abrirAba = useNotasWorkspace((state) => state.abrirAba);

  async function carregar() {
    setCarregando(true);
    const res = await ListarNotasDoContexto({ moduleKey, entityType, entityId });
    setCarregando(false);
    if (res.success) setNotas(res.data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, entityType, entityId]);

  async function abrirNota(noteId: string, title: string) {
    abrirAba(noteId, title);
    await AbrirAbaNota({ noteId });
  }

  async function criarNotaVinculada() {
    const resNota = await CriarNota({ title: "", contentJson: {}, plainText: "", visibility: "PRIVADA" });
    if (!resNota.success) {
      toast.error("Não foi possível criar a nota");
      return;
    }

    const resVinculo = await VincularContextoNota({
      noteId: resNota.data.id,
      moduleKey,
      entityType,
      entityId,
      displayName,
      internalPath,
    });
    if (!resVinculo.success) {
      toast.error(resVinculo.error ?? "Não foi possível vincular a nota");
      return;
    }

    await abrirNota(resNota.data.id, resNota.data.title);
    await carregar();
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-300">Notas relacionadas</p>
        <button
          type="button"
          onClick={() => void criarNotaVinculada()}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <Plus size={11} /> Nova nota vinculada
        </button>
      </div>

      {carregando && <p className="text-[11px] text-slate-600">Carregando...</p>}
      {!carregando && notas.length === 0 && <p className="text-[11px] text-slate-600">Nenhuma nota vinculada ainda.</p>}

      <div className="flex flex-col gap-1">
        {notas.map((nota) => (
          <button
            key={nota.id}
            type="button"
            onClick={() => void abrirNota(nota.id, nota.title)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5"
          >
            <FileText size={11} className="shrink-0 opacity-60" />
            {nota.isPinned && <Pin size={9} className="shrink-0 text-amber-400" />}
            {nota.isFavorite && <Star size={9} className="shrink-0 text-amber-400" />}
            <span className="truncate">{nota.title || "Sem título"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
