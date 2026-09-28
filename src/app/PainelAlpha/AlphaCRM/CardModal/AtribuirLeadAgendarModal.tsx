"use client";

import { useEffect, useState } from "react";
import { ListarUsuariosResponsavelBpm } from "@/actions/bpm/Cards";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Usuario = { id: number; nome: string };

export function AtribuirLeadAgendarModal({ pipelineId, currentUserId, open, onClose, onConfirmar }: {
  pipelineId: string;
  currentUserId: number | null;
  open: boolean;
  onClose: () => void;
  onConfirmar: (responsavelId: number) => Promise<{ success: boolean; error?: string }>;
}) {
  const [modo, setModo] = useState<"mim" | "outro">("mim");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [outroId, setOutroId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    void ListarUsuariosResponsavelBpm(pipelineId).then((resultado) => {
      if (ativo && resultado.success && resultado.data) setUsuarios(resultado.data);
    });
    return () => { ativo = false; };
  }, [open, pipelineId]);

  async function confirmar() {
    const responsavelId = modo === "mim" ? currentUserId : outroId;
    if (!responsavelId) {
      setErro("Selecione um usuário responsável.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await onConfirmar(responsavelId);
      if (!resultado.success) setErro(resultado.error ?? "Não foi possível mover o lead.");
    } catch {
      setErro("Não foi possível mover o lead. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return <Dialog open={open} onOpenChange={(aberto) => { if (!aberto && !salvando) onClose(); }}>
    <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Quem ficará responsável pelo lead?</DialogTitle>
        <DialogDescription className="text-slate-400">Escolha a atribuição antes de mover para Agendar Reunião.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {erro && <p role="alert" className="text-sm text-rose-300">{erro}</p>}
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-3 text-sm">
          <input type="radio" name="atribuicao-agendar" checked={modo === "mim"} onChange={() => setModo("mim")} disabled={!currentUserId || salvando} /> A mim
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-3 text-sm">
          <input type="radio" name="atribuicao-agendar" checked={modo === "outro"} onChange={() => setModo("outro")} disabled={salvando} /> A outro usuário
        </label>
        {modo === "outro" && <select aria-label="Outro usuário responsável" value={outroId ?? ""} onChange={(event) => setOutroId(event.target.value ? Number(event.target.value) : null)} disabled={salvando} className="min-h-11 w-full rounded-lg border border-white/15 bg-slate-900 px-3 text-sm">
          <option value="">Selecione um usuário...</option>
          {usuarios.filter((usuario) => usuario.id !== currentUserId).map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}
        </select>}
      </div>
      <DialogFooter>
        <button type="button" onClick={onClose} disabled={salvando} className="min-h-10 rounded-lg border border-white/15 px-4 text-sm">Cancelar</button>
        <button type="button" onClick={() => void confirmar()} disabled={salvando} className="min-h-10 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{salvando ? "Movendo..." : "Atribuir e mover"}</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
