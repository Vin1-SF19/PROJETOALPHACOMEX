"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Settings2, ArrowRight, Pencil, ArrowUp, ArrowDown, ListChecks } from "lucide-react";
import type { TemaAlpha } from "@/lib/temas";
import {
  CriarPipelineBpm,
  AtualizarPipelineBpm,
  AtivarDesativarPipelineBpm,
  ReordenarPipelinesBpm,
} from "@/actions/bpm/Pipelines";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AcessosPipelineSection } from "./pipelines/[pipelineId]/AcessosPipelineSection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Pipeline = {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  setores: { setor: { id: number; nome: string } }[];
  _count: { cards: number; etapas: number };
};

interface Props {
  pipelines: Pipeline[];
  visual: TemaAlpha;
}

function mensagemErro(error: unknown, fallback: string): string {
  return typeof error === "string" ? error : fallback;
}

const inputCls = "bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

export default function AdminPipelinesListClient({ pipelines: pipelinesIniciais, visual }: Props) {
  const accent = visual.accent;
  const router = useRouter();
  const [pipelines, setPipelines] = useState(
    pipelinesIniciais.slice().sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)),
  );
  const [mostrarForm, setMostrarForm] = useState(false);
  const [aba, setAba] = useState("settings");
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<Pipeline | null>(null);
  const [editNome, setEditNome] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [fonte, setFonte] = useState(pipelinesIniciais);
  if (fonte !== pipelinesIniciais) {
    setFonte(pipelinesIniciais);
    setPipelines(pipelinesIniciais.slice().sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)));
  }

  async function handleCriar() {
    if (!nome.trim()) {
      toast.error("Informe o nome do funil");
      return;
    }
    setSalvando(true);
    const res = await CriarPipelineBpm({ nome: nome.trim() });
    setSalvando(false);
    if (res.success) {
      toast.success("Pipeline criado");
      setNome("");
      setMostrarForm(false);
      router.refresh();
    } else {
      toast.error(mensagemErro(res.error, "Erro ao criar pipeline"));
    }
  }

  function abrirEdicao(pipeline: Pipeline) {
    setEditando(pipeline);
    setEditNome(pipeline.nome);
  }

  async function salvarEdicao() {
    if (!editando) return;
    if (!editNome.trim()) {
      toast.error("Informe o nome do funil");
      return;
    }
    setSalvandoEdicao(true);
    const res = await AtualizarPipelineBpm({
      pipelineId: editando.id,
      nome: editNome.trim(),
    });
    setSalvandoEdicao(false);
    if (res.success) {
      toast.success("Pipeline atualizado");
      setEditando(null);
      router.refresh();
    } else {
      toast.error(mensagemErro(res.error, "Erro ao atualizar pipeline"));
    }
  }

  async function handleToggleAtivo(pipeline: Pipeline, ativo: boolean) {
    setPipelines((prev) => prev.map((p) => (p.id === pipeline.id ? { ...p, ativo } : p)));
    const res = await AtivarDesativarPipelineBpm({ pipelineId: pipeline.id, ativo });
    if (res.success) {
      toast.success(ativo ? "Pipeline ativado" : "Pipeline desativado");
      router.refresh();
    } else {
      setPipelines((prev) => prev.map((p) => (p.id === pipeline.id ? { ...p, ativo: !ativo } : p)));
      toast.error(mensagemErro(res.error, "Erro ao alterar status do pipeline"));
    }
  }

  async function handleMover(index: number, direcao: -1 | 1) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= pipelines.length) return;

    const reordenados = pipelines.slice();
    [reordenados[index], reordenados[novoIndex]] = [reordenados[novoIndex], reordenados[index]];
    const comOrdemAtualizada = reordenados.map((p, i) => ({ ...p, ordem: i }));
    setPipelines(comOrdemAtualizada);

    const res = await ReordenarPipelinesBpm({
      ordem: comOrdemAtualizada.map((p) => ({ pipelineId: p.id, ordem: p.ordem })),
    });
    if (!res.success) {
      toast.error(mensagemErro(res.error, "Erro ao reordenar pipelines"));
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white mb-1">Configurações</h1>
          <p className="text-sm text-slate-400">Gerencie os acessos e os funis do CRM.</p>
        </div>
        <button
          onClick={() => { setAba("pipelines"); setMostrarForm((prev) => !prev); }}
          className="crm-tema-fixo flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: `rgba(${accent},0.85)` }}
        >
          <Plus size={15} /> Novo Pipeline
        </button>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList aria-label="Configurações do CRM"><TabsTrigger value="settings">Configurações</TabsTrigger><TabsTrigger value="pipelines">Funis</TabsTrigger></TabsList>
        <TabsContent value="settings" className="mt-5">
          <AcessosPipelineSection pipelines={pipelines} onPublished={() => router.refresh()} />
        </TabsContent>
        <TabsContent value="pipelines" className="mt-5 space-y-5">
      <div className="max-w-sm">
        <Link
          href="/PainelAlpha/AlphaCRM/admin/regras"
          className="flex items-center gap-3 bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 hover:opacity-90"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `rgba(${accent},0.15)` }}
          >
            <ListChecks size={16} style={{ color: `rgb(${accent})` }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Regras</p>
            <p className="text-xs text-slate-500 truncate">Motor determinístico de regras do CRM</p>
          </div>
        </Link>
      </div>

      {mostrarForm && (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 space-y-3">
          <input
            className={`${inputCls} w-full`}
            aria-label="Nome do novo funil"
            placeholder="Nome do funil"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <p className="text-xs text-slate-400">O funil começa sem liberações. Configure os setores e usuários na aba Configurações.</p>
          <button
            onClick={handleCriar}
            disabled={salvando}
            className="crm-tema-fixo px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: `rgba(${accent},0.85)` }}
          >
            {salvando ? "Criando..." : "Criar pipeline"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {pipelines.map((pipeline, i) => (
          <div
            key={pipeline.id}
            className="flex items-center justify-between gap-3 bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3"
          >
            <Link
              href={`/PainelAlpha/AlphaCRM/admin/pipelines/${pipeline.id}`}
              className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `rgba(${accent},0.15)` }}
              >
                <Settings2 size={16} style={{ color: `rgb(${accent})` }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  {pipeline.nome}
                  {!pipeline.ativo && (
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                      Inativo
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {pipeline.setores.map((s) => s.setor.nome).join(", ") || "Sem setor vinculado"}
                  {" · "}
                  {pipeline._count.cards} card(s) no quadro · {pipeline._count.etapas} etapa(s)
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col">
                <button
                  onClick={() => void handleMover(i, -1)}
                  disabled={i === 0}
                  aria-label={`Mover ${pipeline.nome} para cima`}
                  className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={() => void handleMover(i, 1)}
                  disabled={i === pipelines.length - 1}
                  aria-label={`Mover ${pipeline.nome} para baixo`}
                  className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30"
                >
                  <ArrowDown size={13} />
                </button>
              </div>

              <button
                onClick={() => abrirEdicao(pipeline)}
                aria-label={`Editar pipeline ${pipeline.nome}`}
                title="Editar nome do funil"
                className="p-1.5 rounded text-slate-400 hover:text-white"
              >
                <Pencil size={14} />
              </button>

              {pipeline.ativo ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      aria-label={`Desativar pipeline ${pipeline.nome}`}
                      title="Desativar pipeline"
                      className="inline-flex"
                    >
                      <Switch checked size="sm" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desativar pipeline</AlertDialogTitle>
                      <AlertDialogDescription>
                        Desativar &quot;{pipeline.nome}&quot; oculta o pipeline da navegação padrão. Cards existentes não são
                        excluídos e o pipeline pode ser reativado a qualquer momento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void handleToggleAtivo(pipeline, false)}>
                        Desativar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <button
                  aria-label={`Ativar pipeline ${pipeline.nome}`}
                  title="Ativar pipeline"
                  className="inline-flex"
                  onClick={() => void handleToggleAtivo(pipeline, true)}
                >
                  <Switch checked={false} size="sm" />
                </button>
              )}

              <Link href={`/PainelAlpha/AlphaCRM/admin/pipelines/${pipeline.id}`}>
                <ArrowRight size={16} className="text-slate-600 shrink-0" />
              </Link>
            </div>
          </div>
        ))}
        {pipelines.length === 0 && <p className="text-sm text-slate-600">Nenhum pipeline configurado ainda.</p>}
      </div>

        </TabsContent>
      </Tabs>

      <Dialog open={editando !== null} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              className={`${inputCls} w-full`}
              aria-label="Nome do funil"
              placeholder="Nome do funil"
              value={editNome}
              onChange={(e) => setEditNome(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setEditando(null)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={() => void salvarEdicao()}
              disabled={salvandoEdicao}
              className="crm-tema-fixo px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: `rgba(${accent},0.85)` }}
            >
              {salvandoEdicao ? "Salvando..." : "Salvar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
