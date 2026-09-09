"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlternarTemplateChecklistBpm, CriarTemplateChecklistBpm, ListarWorkspaceChecklistsBpm,
  SalvarTemplateChecklistBpm,
} from "@/actions/bpm/Checklists";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EtapasMultiSelect, type EscopoEtapaChecklist } from "@/components/bpm/checklists/EtapasMultiSelect";
import {
  encontrarEtapasIncompativeis,
  etapaIdsParaPayload,
  resolverSelecaoEtapasTemplate,
  resumoEtapasTemplate,
  trocarPipelineChecklist,
} from "@/components/bpm/checklists/checklist-editor-state";

type Workspace = Awaited<ReturnType<typeof ListarWorkspaceChecklistsBpm>>["data"];
type Template = Workspace["templates"][number];
type DraftItem = { id?: string; nome: string; descricao: string; obrigatorio: boolean };
type Draft = {
  nome: string; descricao: string; ativo: boolean; pipelineId: string;
  escopoEtapa: EscopoEtapaChecklist; etapaIds: string[]; cardId: string; itens: DraftItem[];
};
const VAZIO: Draft = { nome: "", descricao: "", ativo: true, pipelineId: "", escopoEtapa: "TODAS", etapaIds: [], cardId: "", itens: [] };

function draftTemplate(template?: Template): Draft {
  if (!template) return { ...VAZIO, itens: [] };
  const selecaoEtapas = resolverSelecaoEtapasTemplate(template);
  return {
    nome: template.nome, descricao: template.descricao ?? "", ativo: template.ativo,
    pipelineId: template.pipelineId ?? "",
    ...selecaoEtapas,
    cardId: template.cardId ?? "",
    itens: template.itens.map((item) => ({ id: item.id, nome: item.nome, descricao: item.descricao ?? "", obrigatorio: item.obrigatorio })),
  };
}

function nomeCard(card: { id: string; empresa: { razaoSocial: string; nomeFantasia: string | null } }) {
  return card.empresa.nomeFantasia || card.empresa.razaoSocial || card.id;
}

export function ChecklistsWorkspace({ workspace, erro, accent }: { workspace: Workspace; erro: string | null; accent: string }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"TODOS" | "ATIVOS" | "INATIVOS">("TODOS");
  const [editor, setEditor] = useState<Template | "NOVO" | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftTemplate());
  const [sujo, setSujo] = useState(false);
  const [erroSalvamento, setErroSalvamento] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const [recarregando, startReloadTransition] = useTransition();
  const templates = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return workspace.templates.filter((template) => {
      if (filtro === "ATIVOS" && !template.ativo) return false;
      if (filtro === "INATIVOS" && template.ativo) return false;
      const texto = [template.nome, template.pipeline?.nome, template.etapa?.nome, template.card ? nomeCard(template.card) : null].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      return !termo || texto.includes(termo);
    });
  }, [busca, filtro, workspace.templates]);
  const etapas = useMemo(() => workspace.pipelines.find((item) => item.id === draft.pipelineId)?.etapas ?? [], [draft.pipelineId, workspace.pipelines]);
  const etapasIncompativeis = useMemo(() => encontrarEtapasIncompativeis(draft.etapaIds, etapas), [draft.etapaIds, etapas]);
  const cards = useMemo(() => workspace.cards.filter((card) => (!draft.pipelineId || card.pipelineId === draft.pipelineId) && (draft.escopoEtapa === "TODAS" || draft.etapaIds.includes(card.etapaId))), [draft.escopoEtapa, draft.etapaIds, draft.pipelineId, workspace.cards]);

  function abrir(template?: Template) { setEditor(template ?? "NOVO"); setDraft(draftTemplate(template)); setErroSalvamento(null); setSujo(false); }
  function fechar(forcar = false) { if (!forcar && sujo && !window.confirm("Descartar as alterações não salvas?")) return; setEditor(null); setErroSalvamento(null); setSujo(false); }
  function alterar<K extends keyof Draft>(campo: K, valor: Draft[K]) { setDraft((atual) => ({ ...atual, [campo]: valor })); setErroSalvamento(null); setSujo(true); }
  function moverItem(indice: number, direcao: -1 | 1) { const destino = indice + direcao; if (destino < 0 || destino >= draft.itens.length) return; const itens = [...draft.itens]; [itens[indice], itens[destino]] = [itens[destino], itens[indice]]; alterar("itens", itens); }

  function trocarPipeline(pipelineId: string) {
    setDraft((atual) => trocarPipelineChecklist(atual, pipelineId));
    setErroSalvamento(null);
    setSujo(true);
    if (draft.escopoEtapa === "SELECIONADAS" || draft.cardId || draft.etapaIds.length > 0) toast.message("As etapas e o card foram limpos porque o pipeline mudou.");
  }

  function recarregarWorkspace() {
    startReloadTransition(() => router.refresh());
  }

  function salvar() {
    if (!draft.nome.trim()) { toast.error("Informe o nome do template"); return; }
    if (draft.itens.some((item) => !item.nome.trim())) { toast.error("Informe o nome de todos os itens"); return; }
    if (draft.escopoEtapa === "SELECIONADAS" && !draft.pipelineId) { toast.error("Selecione um pipeline antes de escolher etapas."); return; }
    if (draft.escopoEtapa === "SELECIONADAS" && draft.etapaIds.length === 0) { toast.error("Selecione ao menos uma etapa."); return; }
    if (draft.escopoEtapa === "SELECIONADAS" && etapasIncompativeis.length > 0) { toast.error("Uma ou mais etapas não pertencem ao pipeline selecionado. Revise a seleção."); return; }
    setErroSalvamento(null);
    startTransition(async () => {
      try {
        const etapaIds = etapaIdsParaPayload(draft);
        const escopo = { nome: draft.nome.trim(), descricao: draft.descricao.trim() || null, ativo: draft.ativo, pipelineId: draft.pipelineId || null, etapaIds, cardId: draft.cardId || null };
        if (editor === "NOVO") {
          const resposta = await CriarTemplateChecklistBpm({ ...escopo, itens: draft.itens.map((item, ordem) => ({ nome: item.nome.trim(), descricao: item.descricao.trim() || null, obrigatorio: item.obrigatorio, ordem })) });
          if (!resposta.success) { setErroSalvamento(resposta.error); toast.error(resposta.error); return; }
        } else if (editor) {
          const resposta = await SalvarTemplateChecklistBpm({
            id: editor.id,
            updatedAt: editor.updatedAt,
            ...escopo,
            itens: draft.itens.map((item, ordem) => ({
              ...(item.id ? { id: item.id } : {}),
              nome: item.nome.trim(),
              descricao: item.descricao.trim() || null,
              obrigatorio: item.obrigatorio,
              ordem,
            })),
          });
          if (!resposta.success) { setErroSalvamento(resposta.error); toast.error(resposta.error); return; }
        }
        toast.success(editor === "NOVO" ? "Template criado" : "Template atualizado"); fechar(true); router.refresh();
      } catch {
        const mensagem = "Não foi possível salvar o template. Tente novamente.";
        setErroSalvamento(mensagem);
        toast.error(mensagem);
      }
    });
  }

  function alternar(template: Template, ativo: boolean) { startTransition(async () => { const resposta = await AlternarTemplateChecklistBpm({ id: template.id, ativo }); if (!resposta.success) { toast.error(resposta.error); return; } toast.success(ativo ? "Template ativado" : "Template inativado"); router.refresh(); }); }

  return <main className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `rgba(${accent},0.15)` }}><ListChecks size={20} aria-hidden="true" style={{ color: `rgb(${accent})` }} /></div><div><h1 className="text-xl font-black text-white">Templates de checklist</h1><p className="mt-1 text-sm text-slate-400">Defina itens e os contextos em que cada checklist deve aparecer.</p></div></div><Button className="min-h-11" onClick={() => abrir()}><Plus size={16} className="mr-1.5" />Novo template</Button></header>
    {erro && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200 sm:flex-row sm:items-center sm:justify-between"><span>{erro}</span><Button type="button" variant="outline" size="sm" onClick={recarregarWorkspace} disabled={recarregando}>{recarregando ? "Carregando…" : "Tentar novamente"}</Button></div>}
    <div className="grid gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 sm:grid-cols-[1fr_180px]"><label className="relative"><span className="sr-only">Buscar templates</span><Search className="absolute left-3 top-3 text-slate-500" size={16} /><Input className="min-h-11 pl-9" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome ou vínculo…" /></label><select aria-label="Filtrar por estado" className="min-h-11 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white" value={filtro} onChange={(event) => setFiltro(event.target.value as typeof filtro)}><option value="TODOS">Todos</option><option value="ATIVOS">Ativos</option><option value="INATIVOS">Inativos</option></select></div>
    <div className="space-y-2">{templates.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">{workspace.templates.length === 0 ? "Nenhum template criado. Crie o primeiro template." : "Nenhum resultado para os filtros atuais."}</div>}{templates.map((template) => <article key={template.id} className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-100">{template.nome}</h2><Badge variant={template.ativo ? "default" : "secondary"}>{template.ativo ? "Ativo" : "Inativo"}</Badge><span className="text-xs text-slate-500">{template.itens.length} itens · {template._count.instancias} instâncias</span></div>{template.descricao && <p className="line-clamp-2 text-xs text-slate-400">{template.descricao}</p>}<div className="flex flex-wrap gap-1.5 text-[11px]">{[template.pipeline?.nome ?? "Qualquer pipeline", resumoEtapasTemplate(template), template.card ? nomeCard(template.card) : "Qualquer card"].map((valor, indice) => <Badge key={`${indice}-${valor}`} variant="outline">{valor}</Badge>)}</div></div><div className="flex min-h-11 items-center gap-2 sm:justify-end"><Switch aria-label={`${template.ativo ? "Inativar" : "Ativar"} ${template.nome}`} checked={template.ativo} onCheckedChange={(ativo) => alternar(template, ativo)} disabled={pendente} /><Button variant="ghost" className="min-h-11" onClick={() => abrir(template)}><Pencil size={15} className="mr-1.5" />Editar</Button></div></article>)}</div>
    <Dialog open={Boolean(editor)} onOpenChange={(aberto) => !aberto && fechar()}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" aria-busy={pendente}><DialogHeader><DialogTitle>{editor === "NOVO" ? "Novo template" : "Editar template"}</DialogTitle><DialogDescription>Alterações no template não modificam checklists já materializados.</DialogDescription></DialogHeader><div inert={pendente ? true : undefined}><Tabs defaultValue="dados"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="dados">Dados</TabsTrigger><TabsTrigger value="vinculos">Vínculos</TabsTrigger><TabsTrigger value="itens">Itens ({draft.itens.length})</TabsTrigger></TabsList>
      <TabsContent value="dados" className="space-y-4 pt-3"><div className="space-y-1.5"><Label htmlFor="checklist-nome">Nome *</Label><Input id="checklist-nome" autoFocus value={draft.nome} onChange={(event) => alterar("nome", event.target.value)} maxLength={160} /></div><div className="space-y-1.5"><Label htmlFor="checklist-descricao">Descrição</Label><textarea id="checklist-descricao" className="min-h-28 w-full rounded-lg border border-white/10 bg-slate-900 p-3 text-sm text-white outline-none focus:border-white/25" value={draft.descricao} onChange={(event) => alterar("descricao", event.target.value)} maxLength={4000} /></div><label className="flex min-h-11 items-center gap-3"><Switch checked={draft.ativo} onCheckedChange={(valor) => alterar("ativo", valor)} /><span className="text-sm text-slate-200">Ativo para novas materializações</span></label></TabsContent>
      <TabsContent value="vinculos" className="space-y-4 pt-3"><div className="space-y-1.5"><Label>Pipeline</Label><select className="min-h-11 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white" value={draft.pipelineId} onChange={(event) => trocarPipeline(event.target.value)}><option value="">Qualquer pipeline</option>{workspace.pipelines.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
        <EtapasMultiSelect
          accent={accent}
          pipelineSelecionado={Boolean(draft.pipelineId)}
          etapas={etapas}
          escopo={draft.escopoEtapa}
          selecionadas={draft.etapaIds}
          onEscopoChange={(escopo) => alterar("escopoEtapa", escopo)}
          onSelecionadasChange={(ids) => alterar("etapaIds", ids)}
          disabled={pendente}
          isLoading={recarregando}
          error={erro}
          onRetry={recarregarWorkspace}
        />
        <div className="space-y-1.5"><Label>Card específico</Label><select className="min-h-11 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white" value={draft.cardId} onChange={(event) => alterar("cardId", event.target.value)}><option value="">Qualquer card</option>{cards.map((card) => <option key={card.id} value={card.id}>{nomeCard(card)} · {card.id}</option>)}</select></div></TabsContent>
      <TabsContent value="itens" className="space-y-3 pt-3">{draft.itens.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">Adicione o primeiro item.</p>}{draft.itens.map((item, indice) => <div key={item.id ?? `novo-${indice}`} className="grid gap-2 rounded-xl border border-white/[0.07] p-3 sm:grid-cols-[1fr_auto]"><div className="space-y-2"><Input aria-label={`Nome do item ${indice + 1}`} value={item.nome} maxLength={200} placeholder="Nome do item" onChange={(event) => alterar("itens", draft.itens.map((atual, i) => i === indice ? { ...atual, nome: event.target.value } : atual))} /><Input aria-label={`Descrição do item ${indice + 1}`} value={item.descricao} maxLength={2000} placeholder="Descrição opcional" onChange={(event) => alterar("itens", draft.itens.map((atual, i) => i === indice ? { ...atual, descricao: event.target.value } : atual))} /><label className="flex min-h-11 items-center gap-2 text-xs text-slate-300"><Checkbox checked={item.obrigatorio} onCheckedChange={(valor) => alterar("itens", draft.itens.map((atual, i) => i === indice ? { ...atual, obrigatorio: valor === true } : atual))} />Obrigatório</label></div><div className="flex items-start gap-1"><Button type="button" variant="ghost" size="icon" className="size-11" disabled={indice === 0} aria-label="Mover item para cima" onClick={() => moverItem(indice, -1)}><ArrowUp size={15} /></Button><Button type="button" variant="ghost" size="icon" className="size-11" disabled={indice === draft.itens.length - 1} aria-label="Mover item para baixo" onClick={() => moverItem(indice, 1)}><ArrowDown size={15} /></Button><Button type="button" variant="ghost" size="icon" className="size-11 text-rose-400" aria-label="Remover item" onClick={() => alterar("itens", draft.itens.filter((_, i) => i !== indice))}><Trash2 size={15} /></Button></div></div>)}<Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => alterar("itens", [...draft.itens, { nome: "", descricao: "", obrigatorio: true }])}><Plus size={15} className="mr-1.5" />Adicionar item</Button></TabsContent>
    </Tabs></div>{erroSalvamento && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{erroSalvamento} A seleção atual foi preservada para você revisar e tentar novamente.</p>}<DialogFooter><Button variant="ghost" onClick={() => fechar()} disabled={pendente}>Cancelar</Button><Button onClick={salvar} disabled={pendente || recarregando || Boolean(erro) || (draft.escopoEtapa === "SELECIONADAS" && (draft.etapaIds.length === 0 || etapasIncompativeis.length > 0))}>{pendente ? "Salvando…" : "Salvar template"}</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}
