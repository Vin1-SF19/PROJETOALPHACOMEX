"use client";

import { useState } from "react";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  AdicionarMembrosEquipeNota,
  AlterarPapelMembroEquipeNota,
  RemoverMembroEquipeNota,
} from "@/actions/NotasEquipes";
import type { RolePermissaoNota } from "@/lib/validations/notas";
import { NoteTeamUserMultiSelect, type UsuarioEquipeSelecionado } from "./NoteTeamUserMultiSelect";

export interface MembroEquipeNotaUI {
  id: string;
  userId: number;
  role: string;
  user: { id: number; nome: string; imagemUrl: string | null };
}

interface Props {
  teamId: string;
  owner: { id: number; nome: string };
  members: MembroEquipeNotaUI[];
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}

const PAPEIS: RolePermissaoNota[] = ["LEITOR", "COMENTARISTA", "EDITOR", "ADMIN"];

export function NoteTeamMembersEditor({ teamId, owner, members, canManage, onChanged }: Props) {
  const [selecionados, setSelecionados] = useState<UsuarioEquipeSelecionado[]>([]);
  const [adicionando, setAdicionando] = useState(false);

  async function adicionar() {
    if (selecionados.length === 0) return;
    setAdicionando(true);
    const res = await AdicionarMembrosEquipeNota({
      teamId,
      members: selecionados.map(({ userId, role }) => ({ userId, role })),
    });
    setAdicionando(false);
    if (!res.success) return toast.error(res.error);
    setSelecionados([]);
    toast.success("Membros adicionados");
    await onChanged();
  }

  async function alterarPapel(userId: number, role: RolePermissaoNota) {
    const res = await AlterarPapelMembroEquipeNota({ teamId, userId, role });
    if (!res.success) return toast.error(res.error);
    toast.success("Função atualizada");
    await onChanged();
  }

  async function remover(userId: number, nome: string) {
    if (!window.confirm(`Remover ${nome} desta equipe?`)) return;
    const res = await RemoverMembroEquipeNota({ teamId, userId });
    if (!res.success) return toast.error(res.error);
    toast.success("Membro removido");
    await onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-cyan-300" />
          <span className="text-sm font-medium text-slate-200">{owner.nome}</span>
          <span className="ml-auto rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">CRIADOR · ADMIN</span>
        </div>
      </div>

      {members.map((membro) => (
        <div key={membro.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.025] p-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-slate-400">
            {membro.user.nome.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{membro.user.nome}</span>
          {canManage ? (
            <>
              <select
                value={membro.role}
                aria-label={`Função de ${membro.user.nome}`}
                onChange={(event) => void alterarPapel(membro.userId, event.target.value as RolePermissaoNota)}
                className="rounded-lg border border-white/10 bg-[#111827] px-2 py-1.5 text-[11px] text-slate-300 outline-none"
              >
                {PAPEIS.map((papel) => <option key={papel}>{papel}</option>)}
              </select>
              <button
                type="button"
                aria-label={`Remover ${membro.user.nome}`}
                onClick={() => void remover(membro.userId, membro.user.nome)}
                className="rounded-lg p-2 text-slate-600 transition hover:bg-rose-400/10 hover:text-rose-400"
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : (
            <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-400">{membro.role}</span>
          )}
        </div>
      ))}

      {members.length === 0 && <p className="py-3 text-center text-xs text-slate-500">Ainda não há outros membros.</p>}

      {canManage && (
        <div className="rounded-2xl border border-dashed border-white/10 p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-400"><UserPlus size={14} /> Adicionar colaboradores</p>
          <NoteTeamUserMultiSelect
            value={selecionados}
            onChange={setSelecionados}
            excludeIds={[owner.id, ...members.map((membro) => membro.userId)]}
          />
          {selecionados.length > 0 && (
            <button
              type="button"
              disabled={adicionando}
              onClick={() => void adicionar()}
              className="mt-3 w-full rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {adicionando ? "Adicionando..." : `Adicionar ${selecionados.length} membro${selecionados.length > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
