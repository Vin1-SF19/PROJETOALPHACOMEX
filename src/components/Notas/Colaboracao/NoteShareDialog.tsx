"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Settings, Shield, UserRound, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CompartilharNota, ListarPermissoesNota, RemoverAcessoNota } from "@/actions/NotasColaboracao";
import {
  CompartilharNotaComEquipe,
  ListarCompartilhamentosEquipeNota,
  ListarMinhasEquipesNota,
  RemoverCompartilhamentoEquipeNota,
} from "@/actions/NotasEquipes";
import { getSetoresParaSelect } from "@/actions/gestaoSetores";
import type { RolePermissaoNota } from "@/lib/validations/notas";
import { UserSearchSelect } from "./UserSearchSelect";
import { NoteTeamsManager } from "./NoteTeamsManager";

interface PermissaoListada {
  id: string;
  subjectType: string;
  subjectId: string;
  role: string;
  subjectDisplayName: string;
}

interface EquipeListada {
  id: string;
  name: string;
  members: unknown[];
  owner: { nome: string };
}

interface CompartilhamentoEquipe {
  id: string;
  teamId: string;
  teamName: string;
  ownerName: string;
  memberCount: number;
}

interface NoteShareDialogProps {
  noteId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PAPEIS: RolePermissaoNota[] = ["LEITOR", "COMENTARISTA", "EDITOR", "ADMIN"];

export function NoteShareDialog({ noteId, trigger, open, onOpenChange }: NoteShareDialogProps) {
  const [permissoes, setPermissoes] = useState<PermissaoListada[]>([]);
  const [sharesEquipe, setSharesEquipe] = useState<CompartilhamentoEquipe[]>([]);
  const [equipes, setEquipes] = useState<EquipeListada[]>([]);
  const [papelSelecionado, setPapelSelecionado] = useState<RolePermissaoNota>("LEITOR");
  const [setores, setSetores] = useState<string[]>([]);
  const [setorSelecionado, setSetorSelecionado] = useState("");
  const [equipeSelecionada, setEquipeSelecionada] = useState("");
  const [gerenciadorAberto, setGerenciadorAberto] = useState(false);

  const carregar = useCallback(async () => {
    const [resPermissoes, resShares, resEquipes] = await Promise.all([
      ListarPermissoesNota(noteId),
      ListarCompartilhamentosEquipeNota(noteId),
      ListarMinhasEquipesNota(),
    ]);
    if (resPermissoes.success) setPermissoes(resPermissoes.data);
    if (resShares.success) setSharesEquipe(resShares.data);
    if (resEquipes.success) {
      const lista = resEquipes.data as EquipeListada[];
      setEquipes(lista);
      setEquipeSelecionada((atual) => atual || lista[0]?.id || "");
    }
  }, [noteId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento assíncrono sincroniza o diálogo com o servidor
    void carregar();
  }, [carregar]);

  useEffect(() => {
    async function carregarSetores() {
      const lista = await getSetoresParaSelect();
      setSetores(lista);
      setSetorSelecionado((atual) => atual || lista[0] || "");
    }
    void carregarSetores();
  }, []);

  async function compartilharComUsuario(usuarioId: number) {
    const res = await CompartilharNota({ noteId, subjectType: "USUARIO", subjectId: String(usuarioId), role: papelSelecionado });
    if (!res.success) return toast.error(res.error ?? "Não foi possível compartilhar");
    toast.success("Nota compartilhada com o usuário");
    await carregar();
  }

  async function compartilharComSetor() {
    if (!setorSelecionado) return;
    const res = await CompartilharNota({ noteId, subjectType: "SETOR", subjectId: setorSelecionado, role: papelSelecionado });
    if (!res.success) return toast.error(res.error ?? "Não foi possível compartilhar");
    toast.success(`Nota compartilhada com o setor "${setorSelecionado}"`);
    await carregar();
  }

  async function compartilharComEquipe() {
    if (!equipeSelecionada) return;
    const res = await CompartilharNotaComEquipe({ noteId, teamId: equipeSelecionada });
    if (!res.success) return toast.error(res.error ?? "Não foi possível compartilhar");
    toast.success("Nota compartilhada com a equipe");
    await carregar();
  }

  async function removerPermissao(permissionId: string) {
    const res = await RemoverAcessoNota({ permissionId });
    if (!res.success) return toast.error(res.error ?? "Não foi possível remover o acesso");
    await carregar();
  }

  async function removerEquipe(shareId: string) {
    const res = await RemoverCompartilhamentoEquipeNota({ shareId });
    if (!res.success) return toast.error(res.error ?? "Não foi possível remover o acesso");
    await carregar();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#080e1b] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield size={18} className="text-cyan-300" /> Compartilhar nota</DialogTitle>
          </DialogHeader>

          <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Papel para usuário ou setor</label>
            <select
              value={papelSelecionado}
              onChange={(event) => setPapelSelecionado(event.target.value as RolePermissaoNota)}
              className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
            >
              {PAPEIS.map((papel) => <option key={papel}>{papel}</option>)}
            </select>
            <p className="mt-1.5 text-[11px] text-slate-600">Em equipes, cada membro usa a função configurada na própria equipe.</p>
          </div>

          <div className="space-y-3">
            <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300"><UserRound size={14} className="text-violet-300" /> Usuário</h3>
              <UserSearchSelect onSelecionar={(usuario) => void compartilharComUsuario(usuario.id)} />
            </section>

            <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300"><Building2 size={14} className="text-amber-300" /> Setor organizacional</h3>
              <div className="flex gap-2">
                <select
                  value={setorSelecionado}
                  onChange={(event) => setSetorSelecionado(event.target.value)}
                  disabled={setores.length === 0}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-sm text-slate-300 outline-none disabled:opacity-50"
                >
                  {setores.length === 0 && <option value="">Nenhum setor disponível</option>}
                  {setores.map((setor) => <option key={setor}>{setor}</option>)}
                </select>
                <button type="button" disabled={!setorSelecionado} onClick={() => void compartilharComSetor()} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40">Compartilhar</button>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.025] p-3">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="flex flex-1 items-center gap-2 text-xs font-bold text-slate-300"><Users size={14} className="text-cyan-300" /> Equipe de notas</h3>
                <button type="button" onClick={() => setGerenciadorAberto(true)} className="flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200"><Settings size={12} /> Gerenciar</button>
              </div>
              <div className="flex gap-2">
                <select
                  value={equipeSelecionada}
                  onChange={(event) => setEquipeSelecionada(event.target.value)}
                  disabled={equipes.length === 0}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-sm text-slate-300 outline-none disabled:opacity-50"
                >
                  {equipes.length === 0 && <option value="">Crie ou participe de uma equipe</option>}
                  {equipes.map((equipe) => <option key={equipe.id} value={equipe.id}>{equipe.name} · {equipe.members.length + 1} pessoas</option>)}
                </select>
                <button type="button" disabled={!equipeSelecionada} onClick={() => void compartilharComEquipe()} className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-40">Compartilhar</button>
              </div>
            </section>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Quem tem acesso</p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {permissoes.map((permissao) => (
                <div key={`permission-${permissao.id}`} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                  <span className="truncate">
                    {permissao.subjectType === "SETOR" ? `Setor: ${permissao.subjectDisplayName}` : permissao.subjectDisplayName} <span className="text-slate-600">· {permissao.role}</span>
                  </span>
                  <button type="button" aria-label="Remover acesso" onClick={() => void removerPermissao(permissao.id)} className="ml-2 text-slate-600 hover:text-rose-400"><X size={13} /></button>
                </div>
              ))}
              {sharesEquipe.map((share) => (
                <div key={`team-${share.id}`} className="flex items-center justify-between rounded-xl bg-cyan-400/[0.04] px-3 py-2 text-xs text-slate-300">
                  <span className="truncate">Equipe: {share.teamName} <span className="text-slate-600">· {share.memberCount} pessoas</span></span>
                  <button type="button" aria-label="Remover acesso da equipe" onClick={() => void removerEquipe(share.id)} className="ml-2 text-slate-600 hover:text-rose-400"><X size={13} /></button>
                </div>
              ))}
              {permissoes.length === 0 && sharesEquipe.length === 0 && <p className="py-3 text-center text-xs text-slate-600">Ninguém além de você tem acesso.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <NoteTeamsManager
        open={gerenciadorAberto}
        onOpenChange={(aberto) => {
          setGerenciadorAberto(aberto);
          if (!aberto) void carregar();
        }}
      />
    </>
  );
}
