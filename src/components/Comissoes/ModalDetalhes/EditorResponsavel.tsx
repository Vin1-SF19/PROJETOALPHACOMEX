"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AtualizarResponsaveisEvento } from "@/actions/CommissionEntries";
import { BuscarTodosUsuarios } from "@/actions/RecursosHumanos";

interface UsuarioOpcao {
  id: number;
  nome: string;
}

interface EditorResponsavelProps {
  label: string;
  eventId: string;
  nomeAtual: string | null;
  campo: "closer" | "analistaResponsavel";
  onAtualizado?: () => void;
}

/**
 * Exibe "Não Atribuído" quando não há closer/analista atribuído, com botão de edição
 * inline que permite selecionar um colaborador real (grava FK) ou digitar um nome manual
 * (quando o responsável não está cadastrado como usuário do sistema).
 */
export function EditorResponsavel({ label, eventId, nomeAtual, campo, onAtualizado }: EditorResponsavelProps) {
  const [editando, setEditando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [busca, setBusca] = useState("");
  const [nomeManual, setNomeManual] = useState("");

  useEffect(() => {
    if (!editando) return;

    let cancelado = false;
    void (async () => {
      setCarregandoUsuarios(true);
      const resultado = await BuscarTodosUsuarios();
      if (cancelado) return;

      if (resultado.success) {
        setUsuarios(
          resultado.data.filter((u) => u.status === "ATIVO").map((u) => ({ id: u.id, nome: u.nome })),
        );
      }
      setCarregandoUsuarios(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [editando]);

  function salvarComUsuario(usuarioId: number) {
    startTransition(async () => {
      const resultado = await AtualizarResponsaveisEvento(
        campo === "closer"
          ? { eventId, closerUsuarioId: usuarioId }
          : { eventId, analistaResponsavelUsuarioId: usuarioId },
      );

      if (!resultado.success) {
        toast.error(resultado.error ?? `Erro ao atualizar ${label.toLowerCase()}`);
        return;
      }

      toast.success(`${label} atualizado.`);
      setEditando(false);
      onAtualizado?.();
    });
  }

  function salvarComNomeManual() {
    if (!nomeManual.trim()) {
      toast.error("Informe um nome.");
      return;
    }

    startTransition(async () => {
      const resultado = await AtualizarResponsaveisEvento(
        campo === "closer"
          ? { eventId, closerNomeManual: nomeManual.trim() }
          : { eventId, analistaResponsavelNomeManual: nomeManual.trim() },
      );

      if (!resultado.success) {
        toast.error(resultado.error ?? `Erro ao atualizar ${label.toLowerCase()}`);
        return;
      }

      toast.success(`${label} atualizado.`);
      setEditando(false);
      setNomeManual("");
      onAtualizado?.();
    });
  }

  const usuariosFiltrados = usuarios.filter((u) => u.nome.toLowerCase().includes(busca.toLowerCase()));

  if (!editando) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-slate-500">{label}</span>
        <div className="flex items-center gap-2">
          <span className={nomeAtual ? "text-slate-300" : "italic text-slate-600"}>
            {nomeAtual ?? "Não Atribuído"}
          </span>
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label={`Editar ${label.toLowerCase()}`}
            className="text-slate-500 hover:text-slate-300"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/5 bg-slate-900/40 p-3">
      <p className="text-xs font-medium text-slate-300">Editar {label.toLowerCase()}</p>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar colaborador cadastrado..."
        className="border-white/10 bg-slate-950 text-sm"
      />

      {carregandoUsuarios ? (
        <div className="flex justify-center py-3">
          <Loader2 className="size-4 animate-spin text-slate-500" aria-hidden="true" />
        </div>
      ) : (
        <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-white/5 bg-slate-950/60 p-1">
          {usuariosFiltrados.length === 0 ? (
            <p className="p-2 text-xs text-slate-500">Nenhum colaborador encontrado.</p>
          ) : (
            usuariosFiltrados.map((u) => (
              <button
                key={u.id}
                type="button"
                disabled={isPending}
                onClick={() => salvarComUsuario(u.id)}
                className="w-full rounded px-2 py-1 text-left text-xs text-slate-300 hover:bg-white/5"
              >
                {u.nome}
              </button>
            ))
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={nomeManual}
          onChange={(e) => setNomeManual(e.target.value)}
          placeholder="Ou digite um nome (sem cadastro)"
          className="border-white/10 bg-slate-950 text-sm"
        />
        <Button size="sm" disabled={isPending} onClick={salvarComNomeManual}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Salvar"}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setEditando(false)}
        className="text-xs text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-400"
      >
        Cancelar
      </button>
    </div>
  );
}
