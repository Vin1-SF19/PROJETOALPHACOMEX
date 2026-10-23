"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { FilePlus2, Loader2, Plus } from "lucide-react";
import { publicarModeloChecklist, type listarModelosChecklist } from "@/actions/checklist-modelos";
import type { Dados } from "@/lib/checklist/client/types";
import { tiposChecklist } from "@/lib/checklist/schemas";
import { TIPO_LABELS, SECOES } from "@/lib/checklist/items";
import { SECOES_MODELO_LABELS } from "@/lib/checklist/modelos";
import { Acao, Falha, campoChecklist } from "./ChecklistUI";
import { useOptionalChecklistDrafts } from "./ChecklistDraftGuard";
import { useChecklistCommand } from "./useChecklistCommand";

export type Modelo = Dados<Awaited<ReturnType<typeof listarModelosChecklist>>>["items"][number];
interface ModelosDocumentoFormProps {
  modelo: Modelo | null;
  escopoInicial: string;
  disabled?: boolean;
  onCancel: () => void;
  onSaved: () => void;
}
const labelClass = "mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400";
const inputClass = campoChecklist + " border-white/10 bg-slate-950 text-xs focus:border-blue-400/50";
export function ModelosDocumentoForm({ modelo, escopoInicial, disabled = false, onCancel, onSaved }: ModelosDocumentoFormProps) {
  const [escopo, setEscopo] = useState<string>(modelo?.escopo ?? escopoInicial),
    [codigo, setCodigo] = useState(modelo?.codigo ?? ""),
    [nome, setNome] = useState(modelo?.modelo?.nome ?? ""),
    [descricao, setDescricao] = useState(modelo?.modelo?.descricao ?? ""),
    [secao, setSecao] = useState<string>(modelo?.modelo?.secao ?? SECOES.CONSTITUICAO),
    [obrigatorio, setObrigatorio] = useState(modelo?.modelo?.obrigatorio ?? true),
    [ordem, setOrdem] = useState(modelo?.modelo?.ordem ?? 0),
    [ativo, setAtivo] = useState(modelo?.modelo?.ativo ?? true),
    command = useChecklistCommand(),
    drafts = useOptionalChecklistDrafts(),
    id = useId();
  const input = { identidadeId: modelo?.id, expectedRevision: modelo?.revision ?? 0, escopo, codigo, nome, descricao: descricao || null, secao, obrigatorio, ordem, ativo };
  const serialized = JSON.stringify(input);
  const [initial] = useState(serialized);
  async function salvar() {
    const data = await command.run(serialized, (mutationId) => publicarModeloChecklist({ ...input, mutationId }));
    if (!data) return false;
    onSaved();
    return true;
  }
  const latest = useRef({ salvar, onCancel });
  useLayoutEffect(() => { latest.current = { salvar, onCancel }; });
  const dirty = initial !== serialized;
  useLayoutEffect(() => drafts?.register(`modelo-form:${id}`, {
    dirty,
    save: () => latest.current.salvar(),
    discard: () => latest.current.onCancel(),
  }), [drafts, id, dirty]);
  function cancelar() {
    if (drafts) drafts.request(onCancel);
    else onCancel();
  }
  return (
    <div className="rounded-[2rem] border border-blue-400/20 bg-blue-500/[0.04] p-5 md:p-7">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-2xl bg-blue-500/15 p-3 text-blue-200"><FilePlus2 size={21} /></span>
        <div>
          <h2 className="text-base font-black uppercase tracking-wide text-white">{modelo ? "Publicar nova revisão" : "Adicionar documento"}</h2>
          <p className="mt-1 text-xs text-slate-400">{modelo ? "A revisão altera somente novos checklists. Código e escopo são imutáveis." : "Configure o próximo card deste modelo."}</p>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
        <fieldset disabled={disabled || command.busy} aria-busy={command.busy} className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          <label htmlFor={`${id}-codigo`}>
            <span className={labelClass}>Código do documento</span>
            <input id={`${id}-codigo`} required maxLength={80} disabled={!!modelo} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: CAP_FIN_001" className={inputClass} />
          </label>
          <label htmlFor={`${id}-nome`}>
            <span className={labelClass}>Nome do documento</span>
            <input id={`${id}-nome`} required maxLength={180} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Balancete mensal" className={inputClass} />
          </label>
          <label htmlFor={`${id}-descricao`} className="md:col-span-2">
            <span className={labelClass}>Descrição complementar</span>
            <textarea id={`${id}-descricao`} maxLength={1000} rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Instruções ou observações para este documento" className={inputClass + " min-h-24"} />
          </label>
          <label htmlFor={`${id}-secao`}>
            <span className={labelClass}>Seção</span>
            <select id={`${id}-secao`} value={secao} onChange={(e) => setSecao(e.target.value)} className={inputClass}>
              {Object.entries(SECOES_MODELO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label htmlFor={`${id}-escopo`}>
            <span className={labelClass}>Escopo</span>
            <select id={`${id}-escopo`} value={escopo} disabled={!!modelo} onChange={(e) => setEscopo(e.target.value)} className={inputClass}>
              {tiposChecklist.map((t) => <option key={t} value={t}>{t === escopoInicial ? `Apenas este embasamento — ${TIPO_LABELS[t]}` : TIPO_LABELS[t]}</option>)}
              <option value="GLOBAL">Global para todos</option>
            </select>
          </label>
          <label htmlFor={`${id}-ordem`}>
            <span className={labelClass}>Ordem</span>
            <input id={`${id}-ordem`} type="number" min={0} max={100000} step={1} required value={ordem} onChange={(e) => setOrdem(Number(e.target.value))} className={inputClass} />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-300">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4 accent-blue-500" />
            Ativo para novos checklists
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-300 md:col-span-2">
            <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} className="size-4 accent-blue-500" />
            Documento obrigatório
          </label>
          {command.error && <div className="md:col-span-2"><Falha error={command.error} /></div>}
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <Acao type="submit" disabled={disabled || command.busy} className="border-blue-500/30 bg-blue-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500">
              {command.busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {command.busy ? "Salvando…" : modelo ? "Publicar revisão" : "Criar documento"}
            </Acao>
            {modelo && <Acao disabled={disabled || command.busy} onClick={cancelar}>Cancelar edição</Acao>}
          </div>
        </fieldset>
      </form>
    </div>
  );
}
