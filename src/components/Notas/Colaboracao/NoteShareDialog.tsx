"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CompartilharNota, RemoverAcessoNota, ListarPermissoesNota } from "@/actions/NotasColaboracao";
import { getSetoresParaSelect } from "@/actions/gestaoSetores";
import type { RolePermissaoNota } from "@/lib/validations/notas";
import { UserSearchSelect } from "./UserSearchSelect";

interface PermissaoListada {
  id: string;
  subjectType: string;
  subjectId: string;
  role: string;
  subjectDisplayName: string;
}

interface NoteShareDialogProps {
  noteId: string;
  /** Omitir quando o diálogo for controlado externamente via `open`/`onOpenChange` (ex: acionado por um item de menu, que não pode ser filho direto de DialogTrigger). */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PAPEIS: RolePermissaoNota[] = ["LEITOR", "COMENTARISTA", "EDITOR", "ADMIN"];

export function NoteShareDialog({ noteId, trigger, open, onOpenChange }: NoteShareDialogProps) {
  const [permissoes, setPermissoes] = useState<PermissaoListada[]>([]);
  const [papelSelecionado, setPapelSelecionado] = useState<RolePermissaoNota>("LEITOR");
  const [setores, setSetores] = useState<string[]>([]);
  const [setorSelecionado, setSetorSelecionado] = useState("");

  async function carregar() {
    const res = await ListarPermissoesNota(noteId);
    if (res.success) setPermissoes(res.data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    async function carregarSetores() {
      const lista = await getSetoresParaSelect();
      setSetores(lista);
      if (lista.length > 0) setSetorSelecionado(lista[0]);
    }
    void carregarSetores();
  }, []);

  async function compartilharComUsuario(usuarioId: number) {
    const res = await CompartilharNota({ noteId, subjectType: "USUARIO", subjectId: String(usuarioId), role: papelSelecionado });
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível compartilhar");
      return;
    }
    toast.success("Nota compartilhada");
    await carregar();
  }

  async function compartilharComSetor() {
    if (!setorSelecionado) return;
    const res = await CompartilharNota({ noteId, subjectType: "SETOR", subjectId: setorSelecionado, role: papelSelecionado });
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível compartilhar");
      return;
    }
    toast.success(`Nota compartilhada com a equipe "${setorSelecionado}"`);
    await carregar();
  }

  async function remover(permissionId: string) {
    const res = await RemoverAcessoNota({ permissionId });
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível remover o acesso");
      return;
    }
    await carregar();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="border-white/10 bg-[#0b1120] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar nota</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Papel:</span>
            <select
              value={papelSelecionado}
              onChange={(event) => setPapelSelecionado(event.target.value as RolePermissaoNota)}
              className="rounded-md border border-white/10 bg-transparent px-2 py-1 text-xs text-slate-300 outline-none"
            >
              {PAPEIS.map((papel) => (
                <option key={papel} value={papel} className="bg-[#0b1120]">
                  {papel}
                </option>
              ))}
            </select>
          </div>

          <UserSearchSelect onSelecionar={(usuario) => void compartilharComUsuario(usuario.id)} />

          <div className="flex items-center gap-2">
            <select
              value={setorSelecionado}
              onChange={(event) => setSetorSelecionado(event.target.value)}
              disabled={setores.length === 0}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none disabled:opacity-50"
            >
              {setores.length === 0 && (
                <option value="" className="bg-[#0b1120]">
                  Nenhum setor disponível
                </option>
              )}
              {setores.map((setor) => (
                <option key={setor} value={setor} className="bg-[#0b1120]">
                  {setor}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!setorSelecionado}
              onClick={() => void compartilharComSetor()}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
            >
              Compartilhar com equipe
            </button>
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-600">Quem tem acesso</p>
            <div className="flex flex-col gap-1">
              {permissoes.map((permissao) => (
                <div key={permissao.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2 py-1.5 text-xs text-slate-300">
                  <span>
                    {permissao.subjectType === "SETOR" ? `Equipe: ${permissao.subjectDisplayName}` : permissao.subjectDisplayName} — {permissao.role}
                  </span>
                  <button type="button" onClick={() => void remover(permissao.id)} className="text-slate-600 hover:text-rose-400">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {permissoes.length === 0 && <p className="text-xs text-slate-600">Ninguém além de você tem acesso.</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
