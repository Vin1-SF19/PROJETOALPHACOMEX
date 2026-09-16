"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bot, Pencil, Plus, Power } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { AiAgent, ChatbotFlow } from "@/types/chatbot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { agentFormSchema } from "@/services/chatbot/schemas";
import { CHATBOT_CHANNELS } from "@/services/chatbot/constants";

type AgentForm = z.infer<typeof agentFormSchema>;
interface Props { agents: AiAgent[]; flows: ChatbotFlow[]; isBusy: boolean; onSave: (agent: AiAgent) => Promise<void> }

export function AgentsWorkspace({ agents, flows, isBusy, onSave }: Props) {
  const [editing, setEditing] = useState<AiAgent | null>(null);
  const [creating, setCreating] = useState(false);
  const selected = editing ?? (creating ? emptyAgent(agents.length + 1) : null);
  const close = () => { if (!isBusy) { setEditing(null); setCreating(false); } };
  return <div className="space-y-4 p-4 md:p-5" data-testid="chatbot-agents">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Agentes IA</h2><p className="text-sm text-slate-400">Configure comportamento e vínculos sem executar inferência.</p></div><Button disabled={isBusy} onClick={() => setCreating(true)}><Plus className="mr-2 size-4" />Novo agente</Button></div>
    <div className="grid gap-3 lg:grid-cols-2">{agents.map((agent) => <article key={agent.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4 transition-colors hover:border-indigo-400/30"><header className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-lg bg-indigo-400/10 text-indigo-300"><Bot className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-semibold text-white">{agent.name}</h3><Badge className={agent.active ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-700 text-slate-300"}>{agent.active ? "Ativo" : "Pausado"}</Badge></div><p className="mt-1 text-sm text-slate-400">{agent.description}</p></div></header><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><Info label="Modelo" value={agent.model} /><Info label="Canais" value={agent.channels.join(", ") || "Nenhum"} /><Info label="Fluxos" value={agent.flowIds.map((id) => flows.find((flow) => flow.id === id)?.name ?? id).join(", ") || "Nenhum"} /><Info label="Ferramentas" value={agent.tools.join(", ") || "Nenhuma"} /></div><footer className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" disabled={isBusy} onClick={async () => { try { await onSave({ ...agent, active: !agent.active }); toast.success(agent.active ? "Agente pausado" : "Agente ativado"); } catch (error) { toast.error(messageOf(error)); } }}><Power className="mr-2 size-3.5" />{agent.active ? "Pausar" : "Ativar"}</Button><Button size="sm" disabled={isBusy} onClick={() => setEditing(agent)}><Pencil className="mr-2 size-3.5" />Editar</Button></footer></article>)}</div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 text-white sm:max-w-2xl"><DialogHeader><DialogTitle>{creating ? "Novo agente" : "Editar agente"}</DialogTitle><DialogDescription className="text-slate-400">Configuração visual; nenhum provedor de IA será acionado.</DialogDescription></DialogHeader>{selected && <AgentFormPanel key={selected.id} selected={selected} flows={flows} isBusy={isBusy} onCancel={close} onSave={async (agent) => { await onSave(agent); toast.success("Agente salvo no ambiente mock"); close(); }} />}</DialogContent></Dialog>
  </div>;
}

function AgentFormPanel({ selected, flows, isBusy, onCancel, onSave }: { selected: AiAgent; flows: ChatbotFlow[]; isBusy: boolean; onCancel: () => void; onSave: (agent: AiAgent) => Promise<void> }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AgentForm>({ resolver: zodResolver(agentFormSchema), defaultValues: { name: selected.name, description: selected.description, instructions: selected.instructions, model: selected.model, temperature: selected.temperature, tools: selected.tools.join(", "), behavior: selected.behavior, channels: selected.channels, flowIds: selected.flowIds } });
  const submit = handleSubmit(async (values) => { try { await onSave({ ...selected, ...values, tools: values.tools.split(",").map((item) => item.trim()).filter(Boolean) }); } catch (error) { toast.error(messageOf(error)); } });
  return <form onSubmit={submit} aria-busy={isBusy} className="space-y-3">
    <Field label="Nome" error={errors.name?.message}><Input {...register("name")} disabled={isBusy} aria-invalid={Boolean(errors.name)} maxLength={120} className="mt-1 border-white/10 bg-slate-900 text-white" /></Field>
    <Field label="Descrição" error={errors.description?.message}><Input {...register("description")} disabled={isBusy} aria-invalid={Boolean(errors.description)} maxLength={500} className="mt-1 border-white/10 bg-slate-900 text-white" /></Field>
    <Field label="Instruções" error={errors.instructions?.message}><textarea {...register("instructions")} disabled={isBusy} aria-invalid={Boolean(errors.instructions)} className="mt-1 min-h-28 w-full rounded-md border border-white/10 bg-slate-900 p-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400" /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Modelo/configuração" error={errors.model?.message}><Input {...register("model")} disabled={isBusy} aria-invalid={Boolean(errors.model)} className="mt-1 border-white/10 bg-slate-900 text-white" /></Field><Field label="Temperatura" error={errors.temperature?.message}><Input {...register("temperature", { valueAsNumber: true })} disabled={isBusy} aria-invalid={Boolean(errors.temperature)} type="number" step="0.1" min={0} max={1} className="mt-1 border-white/10 bg-slate-900 text-white" /></Field></div>
    <Field label="Ferramentas (separadas por vírgula)" error={errors.tools?.message}><Input {...register("tools")} disabled={isBusy} aria-invalid={Boolean(errors.tools)} className="mt-1 border-white/10 bg-slate-900 text-white" /></Field>
    <Field label="Comportamento" error={errors.behavior?.message}><Input {...register("behavior")} disabled={isBusy} aria-invalid={Boolean(errors.behavior)} className="mt-1 border-white/10 bg-slate-900 text-white" /></Field>
    <fieldset disabled={isBusy}><legend className="mb-2 text-xs text-slate-400">Canais vinculados</legend><div className="flex flex-wrap gap-2">{CHATBOT_CHANNELS.map((channel) => <label key={channel} className="flex items-center gap-2 rounded-md border border-white/10 px-2 py-1.5 text-xs capitalize text-slate-300"><input type="checkbox" value={channel} {...register("channels")} />{channel}</label>)}</div></fieldset>
    <fieldset disabled={isBusy}><legend className="mb-2 text-xs text-slate-400">Fluxos vinculados</legend><div className="flex flex-wrap gap-2">{flows.map((flow) => <label key={flow.id} className="flex items-center gap-2 rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-300"><input type="checkbox" value={flow.id} {...register("flowIds")} />{flow.name}</label>)}</div></fieldset>
    <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" disabled={isBusy} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={isBusy}>{isBusy ? "Salvando…" : "Salvar agente"}</Button></div>
  </form>;
}

function emptyAgent(number: number): AiAgent { return { id: `agent-new-${number}`, name: "", description: "", instructions: "", model: "OpenAI-compatible", temperature: 0.3, tools: [], behavior: "", flowIds: [], channels: [], active: false }; }
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block text-xs text-slate-400">{label}{children}{error && <span role="alert" className="mt-1 block text-rose-300">{error}</span>}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-slate-500">{label}</p><p className="mt-1 truncate capitalize text-slate-300" title={value}>{value}</p></div>; }
function messageOf(error: unknown) { return error instanceof Error ? error.message : "Não foi possível concluir a operação."; }
