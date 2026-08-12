"use client";

import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  CriarEquipeNota,
  ExcluirEquipeNota,
  ListarMinhasEquipesNota,
  RenomearEquipeNota,
  SairDaEquipeNota,
} from "@/actions/NotasEquipes";
import { NoteTeamMembersEditor, type MembroEquipeNotaUI } from "./NoteTeamMembersEditor";
import { NoteTeamUserMultiSelect, type UsuarioEquipeSelecionado } from "./NoteTeamUserMultiSelect";

interface EquipeNotaUI {
  id: string;
  name: string;
  ownerId: number;
  isOwner: boolean;
  owner: { id: number; nome: string };
  members: MembroEquipeNotaUI[];
  _count: { shares: number };
}

interface Props {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NoteTeamsManager({ trigger, open, onOpenChange }: Props) {
  const [equipes, setEquipes] = useState<EquipeNotaUI[]>([]);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novosMembros, setNovosMembros] = useState<UsuarioEquipeSelecionado[]>([]);
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeEditado, setNomeEditado] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await ListarMinhasEquipesNota();
    setCarregando(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const lista = res.data as EquipeNotaUI[];
    setEquipes(lista);
    setSelecionadaId((atual) => (atual && lista.some((equipe) => equipe.id === atual) ? atual : lista[0]?.id ?? null));
  }, []);

  useEffect(() => {
    if (open === false) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento assíncrono ao abrir o gerenciador
    void carregar();
  }, [open, carregar]);

  const selecionada = equipes.find((equipe) => equipe.id === selecionadaId) ?? null;

  async function criar() {
    if (!novoNome.trim()) return;
    setCriando(true);
    const res = await CriarEquipeNota({
      name: novoNome,
      members: novosMembros.map(({ userId, role }) => ({ userId, role })),
    });
    setCriando(false);
    if (!res.success) return toast.error(res.error);
    setNovoNome("");
    setNovosMembros([]);
    toast.success("Equipe criada");
    await carregar();
    setSelecionadaId(res.data.id);
  }

  async function salvarNome() {
    if (!selecionada) return;
    const res = await RenomearEquipeNota({ teamId: selecionada.id, name: nomeEditado });
    if (!res.success) return toast.error(res.error);
    setEditandoNome(false);
    toast.success("Nome atualizado");
    await carregar();
  }

  async function excluir() {
    if (!selecionada || !window.confirm(`Excluir a equipe "${selecionada.name}"? As notas serão preservadas.`)) return;
    const res = await ExcluirEquipeNota({ teamId: selecionada.id });
    if (!res.success) return toast.error(res.error);
    toast.success("Equipe excluída. Nenhuma nota foi apagada.");
    await carregar();
  }

  async function sair() {
    if (!selecionada || !window.confirm(`Sair da equipe "${selecionada.name}"?`)) return;
    const res = await SairDaEquipeNota({ teamId: selecionada.id });
    if (!res.success) return toast.error(res.error);
    toast.success("Você saiu da equipe");
    await carregar();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[92vh] overflow-hidden border-white/10 bg-[#070d19] p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-white/5 px-5 py-4">
          <DialogTitle className="flex items-center gap-2"><Users size={19} className="text-cyan-300" /> Equipes de notas</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 md:grid-cols-[280px_1fr]">
          <aside className="max-h-[76vh] overflow-y-auto border-b border-white/5 p-4 md:border-b-0 md:border-r">
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><Plus size={13} /> Nova equipe</p>
              <input
                value={novoNome}
                onChange={(event) => setNovoNome(event.target.value)}
                placeholder="Nome da equipe"
                maxLength={80}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400/40"
              />
              <div className="mt-2">
                <NoteTeamUserMultiSelect value={novosMembros} onChange={setNovosMembros} />
              </div>
              <button
                type="button"
                disabled={criando || novoNome.trim().length < 2}
                onClick={() => void criar()}
                className="mt-3 w-full rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
              >
                {criando ? "Criando..." : "Criar equipe"}
              </button>
            </div>

            <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Minhas equipes</p>
            {carregando && <p className="py-4 text-center text-xs text-slate-500">Carregando...</p>}
            {!carregando && equipes.length === 0 && <p className="py-4 text-center text-xs text-slate-500">Você ainda não participa de equipes.</p>}
            <div className="space-y-1.5">
              {equipes.map((equipe) => (
                <button
                  key={equipe.id}
                  type="button"
                  onClick={() => setSelecionadaId(equipe.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selecionadaId === equipe.id
                      ? "border-cyan-400/25 bg-cyan-400/[0.08]"
                      : "border-transparent bg-white/[0.025] hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold text-slate-200">{equipe.name}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    {equipe.members.length + 1} pessoas · {equipe._count.shares} notas
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="max-h-[76vh] min-h-[420px] overflow-y-auto p-4 sm:p-5">
            {!selecionada ? (
              <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
                <Users size={36} className="mb-3 text-slate-700" />
                <p className="text-sm text-slate-400">Crie ou selecione uma equipe.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start gap-3 border-b border-white/5 pb-4">
                  <div className="min-w-0 flex-1">
                    {editandoNome ? (
                      <div className="flex gap-2">
                        <input
                          value={nomeEditado}
                          onChange={(event) => setNomeEditado(event.target.value)}
                          className="min-w-0 flex-1 rounded-xl border border-cyan-400/30 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
                          autoFocus
                        />
                        <button type="button" onClick={() => void salvarNome()} className="rounded-xl bg-cyan-500 p-2 text-slate-950"><Save size={16} /></button>
                        <button type="button" onClick={() => setEditandoNome(false)} className="rounded-xl bg-white/5 p-2 text-slate-400"><X size={16} /></button>
                      </div>
                    ) : (
                      <>
                        <h3 className="truncate text-xl font-black text-white">{selecionada.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">Criada por {selecionada.owner.nome}</p>
                      </>
                    )}
                  </div>
                  {selecionada.isOwner ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Renomear equipe"
                        onClick={() => { setNomeEditado(selecionada.name); setEditandoNome(true); }}
                        className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-cyan-300"
                      ><Pencil size={15} /></button>
                      <button type="button" title="Excluir equipe" onClick={() => void excluir()} className="rounded-xl p-2 text-slate-500 hover:bg-rose-400/10 hover:text-rose-400"><Trash2 size={15} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => void sair()} className="flex items-center gap-2 rounded-xl border border-rose-400/15 px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10"><DoorOpen size={14} /> Sair</button>
                  )}
                </div>

                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Membros e funções</p>
                  <NoteTeamMembersEditor
                    teamId={selecionada.id}
                    owner={selecionada.owner}
                    members={selecionada.members}
                    canManage={selecionada.isOwner}
                    onChanged={carregar}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
