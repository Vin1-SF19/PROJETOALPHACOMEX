"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePresetsAnimacao } from "../PresetsAnimacaoContext";
import { PRESETS_ANIMACAO_COMPLETOS, type AnimacaoPreset } from "@/lib/apresentacoes/animacao/presets-completos";
import { presetAnimacaoPersonalizadoSchema, type PresetAnimacaoPersonalizado } from "@/lib/apresentacoes/animacao/presets-personalizados";
import { listarAnimacoes } from "@/lib/apresentacoes/animacao/registry";
import "@/lib/apresentacoes/animacao";

interface RascunhoPreset {
  id: string | null;
  nome: string;
  descricao: string;
  animacoes: AnimacaoPreset[];
}

function rascunhoDoNativo(id: keyof typeof PRESETS_ANIMACAO_COMPLETOS = "minimalista"): RascunhoPreset {
  const preset = PRESETS_ANIMACAO_COMPLETOS[id];
  return { id: null, nome: `${preset.nome} personalizado`, descricao: preset.descricao, animacoes: preset.criar() };
}

function rascunhoDoPersonalizado(preset: PresetAnimacaoPersonalizado): RascunhoPreset {
  return { id: preset.id, nome: preset.nome, descricao: preset.descricao, animacoes: preset.animacoes.map((animacao) => ({ ...animacao })) };
}

export function PresetsAnimacaoPanel() {
  const { presetsPersonalizados, salvarPresetsPersonalizados } = usePresetsAnimacao();
  const [rascunho, setRascunho] = useState<RascunhoPreset>(() => rascunhoDoNativo());
  const [salvando, setSalvando] = useState(false);
  const [presetExcluir, setPresetExcluir] = useState<PresetAnimacaoPersonalizado | null>(null);
  const opcoesAnimacao = useMemo(() => listarAnimacoes().filter((item) => item.category !== "transition"), []);

  function trocarTipo(index: number, tipo: string) {
    const definicao = opcoesAnimacao.find((item) => item.id === tipo);
    if (!definicao || definicao.category === "transition") return;
    const category = definicao.category;
    const duration = definicao.defaultDuration;
    const easing = definicao.defaultEasing;
    setRascunho((atual) => ({
      ...atual,
      animacoes: atual.animacoes.map((animacao, itemIndex) => itemIndex === index ? {
        ...animacao,
        type: definicao.id,
        category,
        duration,
        easing,
      } : animacao),
    }));
  }

  function atualizarAnimacao(index: number, patch: Partial<AnimacaoPreset>) {
    setRascunho((atual) => ({
      ...atual,
      animacoes: atual.animacoes.map((animacao, itemIndex) => itemIndex === index ? { ...animacao, ...patch } : animacao),
    }));
  }

  function adicionarEtapa() {
    const definicao = opcoesAnimacao.find((item) => item.id === "fade-in") ?? opcoesAnimacao[0];
    if (!definicao || definicao.category === "transition") return;
    const category = definicao.category;
    const duration = definicao.defaultDuration;
    const easing = definicao.defaultEasing;
    setRascunho((atual) => ({
      ...atual,
      animacoes: [...atual.animacoes, {
        type: definicao.id,
        category,
        trigger: "after-previous",
        duration,
        delay: 0,
        order: atual.animacoes.length,
        easing,
      }],
    }));
  }

  async function salvar() {
    const candidato = presetAnimacaoPersonalizadoSchema.safeParse({
      id: rascunho.id ?? `custom-${crypto.randomUUID()}`,
      nome: rascunho.nome,
      descricao: rascunho.descricao,
      animacoes: rascunho.animacoes.map((animacao, index) => ({ ...animacao, order: index })),
      atualizadoEm: new Date().toISOString(),
    });
    if (!candidato.success) {
      toast.error(candidato.error.issues[0]?.message ?? "Revise os dados do preset.");
      return;
    }

    setSalvando(true);
    try {
      const existe = presetsPersonalizados.some((preset) => preset.id === candidato.data.id);
      const proximos = existe
        ? presetsPersonalizados.map((preset) => preset.id === candidato.data.id ? candidato.data : preset)
        : [...presetsPersonalizados, candidato.data];
      await salvarPresetsPersonalizados(proximos);
      setRascunho(rascunhoDoPersonalizado(candidato.data));
      toast.success(existe ? "Preset atualizado." : "Preset criado e adicionado aos seletores.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o preset.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!presetExcluir) return;
    setSalvando(true);
    try {
      await salvarPresetsPersonalizados(presetsPersonalizados.filter((preset) => preset.id !== presetExcluir.id));
      if (rascunho.id === presetExcluir.id) setRascunho(rascunhoDoNativo());
      toast.success("Preset personalizado excluído.");
      setPresetExcluir(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o preset.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-y-auto pr-1 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div><h3 className="text-sm font-semibold text-white">Meus presets</h3><p className="text-[11px] text-slate-500">Salvos nesta apresentação.</p></div>
          <button type="button" onClick={() => setRascunho(rascunhoDoNativo())} aria-label="Criar preset" className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-500"><Plus size={14} /></button>
        </div>
        <div className="space-y-2">
          {presetsPersonalizados.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">Nenhum preset personalizado.</p>}
          {presetsPersonalizados.map((preset) => (
            <div key={preset.id} className={`rounded-xl border p-2.5 ${rascunho.id === preset.id ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/10 bg-slate-950/50"}`}>
              <p className="truncate text-xs font-semibold text-white">{preset.nome}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{preset.animacoes.length} etapa(s)</p>
              <div className="mt-2 flex gap-1">
                <button type="button" onClick={() => setRascunho(rascunhoDoPersonalizado(preset))} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"><Pencil size={10} /> Modificar</button>
                <button type="button" onClick={() => setPresetExcluir(preset)} aria-label={`Excluir ${preset.nome}`} className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1"><label className="text-[10px] uppercase tracking-wider text-slate-500">Nome</label><input value={rascunho.nome} onChange={(event) => setRascunho((atual) => ({ ...atual, nome: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" /></div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Criar a partir de
            <select onChange={(event) => setRascunho(rascunhoDoNativo(event.target.value as keyof typeof PRESETS_ANIMACAO_COMPLETOS))} defaultValue="minimalista" className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs normal-case text-white">
              {Object.entries(PRESETS_ANIMACAO_COMPLETOS).map(([id, preset]) => <option key={id} value={id}>{preset.nome}</option>)}
            </select>
          </label>
        </div>
        <div><label className="text-[10px] uppercase tracking-wider text-slate-500">Descrição</label><textarea value={rascunho.descricao} onChange={(event) => setRascunho((atual) => ({ ...atual, descricao: event.target.value }))} rows={2} className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500" /></div>

        <div className="space-y-2">
          <div className="flex items-center justify-between"><h4 className="flex items-center gap-1.5 text-xs font-semibold text-white"><Wand2 size={13} className="text-indigo-400" /> Etapas da animação</h4><button type="button" disabled={rascunho.animacoes.length >= 16} onClick={adicionarEtapa} className="inline-flex items-center gap-1 text-[11px] text-indigo-300 disabled:opacity-40"><Plus size={11} /> Adicionar etapa</button></div>
          {rascunho.animacoes.map((animacao, index) => (
            <div key={`${animacao.type}-${index}`} className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-2.5 sm:grid-cols-[1fr_100px_100px_32px]">
              <select value={animacao.type} onChange={(event) => trocarTipo(index, event.target.value)} aria-label={`Animação da etapa ${index + 1}`} className="min-w-0 rounded-md border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white">
                {opcoesAnimacao.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.name}</option>)}
              </select>
              <label className="text-[9px] text-slate-500">Duração (s)<input type="number" min={0} step={0.1} value={animacao.duration} onChange={(event) => atualizarAnimacao(index, { duration: Math.max(0, Number(event.target.value)) })} className="mt-0.5 w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white" /></label>
              <label className="text-[9px] text-slate-500">Espera (s)<input type="number" min={0} step={0.1} value={animacao.delay} onChange={(event) => atualizarAnimacao(index, { delay: Math.max(0, Number(event.target.value)) })} className="mt-0.5 w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white" /></label>
              <button type="button" disabled={rascunho.animacoes.length === 1} onClick={() => setRascunho((atual) => ({ ...atual, animacoes: atual.animacoes.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Remover etapa ${index + 1}`} className="self-end rounded-md p-2 text-slate-500 hover:text-red-400 disabled:opacity-30"><X size={13} /></button>
            </div>
          ))}
        </div>

        <button type="button" disabled={salvando} onClick={() => void salvar()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {rascunho.id ? "Salvar alterações" : "Criar preset"}
        </button>
      </section>

      <AlertDialog open={presetExcluir !== null} onOpenChange={(open) => !open && setPresetExcluir(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir preset?</AlertDialogTitle><AlertDialogDescription>O preset sai dos seletores, mas animações já aplicadas nos slides continuam intactas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void excluir()} className="bg-red-600 hover:bg-red-500">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
