"use client";
import { useState } from "react";
import { Plus, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlowEditor } from "./FlowEditor";
import { useChatbotStore } from "@/store/useChatbotStore";
import { cloneChatbotData } from "@/services/chatbot/clone";
import type { ChatbotFlow } from "@/types/chatbot";

function createLocalFlow(): ChatbotFlow {
  const id = `flow-local-${Date.now()}`;
  return { id, name: "Novo fluxo", description: "Descreva o objetivo desta automação.", status: "draft", updatedAt: new Date().toISOString(), nodes: [], edges: [] };
}
export function FlowsWorkspace() {
  const flows = useChatbotStore((state) => state.snapshot.flows);
  const selectFlow = useChatbotStore((state) => state.selectFlow);
  const saveFlow = useChatbotStore((state) => state.saveFlow);
  const isBusy = useChatbotStore((state) => state.isBusy);
  const [editorFlow, setEditorFlow] = useState<ChatbotFlow | null>(null);
  if (editorFlow) return <div className="space-y-3 p-3 sm:p-4"><div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={() => setEditorFlow(null)}>← Voltar</Button><div><h2 className="text-sm font-semibold">{editorFlow.name}</h2><p className="text-xs text-slate-500">Editor visual · execução desativada</p></div></div><FlowEditor key={editorFlow.id} flow={editorFlow} isBusy={isBusy} onSave={saveFlow} /></div>;
  return <div className="p-4 sm:p-6"><header className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Fluxos de automação</h2><p className="mt-1 text-sm text-slate-500">Modele a estrutura visual sem executar automações.</p></div><Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => setEditorFlow(createLocalFlow())}><Plus />Novo fluxo</Button></header><div className="mt-5 overflow-hidden rounded-xl border border-white/5"><div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-white/5 bg-white/[0.025] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>Fluxo</span><span>Status</span><span>Ações</span></div>{flows.map((flow) => <div key={flow.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-white/5 px-4 py-3 last:border-0"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-300"><Workflow className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-200">{flow.name}</p><p className="truncate text-xs text-slate-500">{flow.description}</p></div></div><span className="text-xs text-slate-400">{flow.status === "active" ? "● Ativo" : "○ Rascunho"}</span><Button variant="outline" size="sm" onClick={() => { selectFlow(flow.id); setEditorFlow(cloneChatbotData(flow)); }}>Editar</Button></div>)}</div></div>;
}
