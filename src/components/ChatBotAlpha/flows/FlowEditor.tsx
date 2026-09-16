"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { addEdge, Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge } from "@xyflow/react";
import { AlertTriangle, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHATBOT_FLOW_NODE_KINDS } from "@/services/chatbot/constants";
import { validateChatbotFlow } from "@/services/chatbot";
import { chatbotFlowSchema, firstSchemaError } from "@/services/chatbot/schemas";
import type { ChatbotFlow, FlowEdge, FlowNode, FlowNodeData, FlowNodeKind } from "@/types/chatbot";
import { FlowNodeCard, type CanvasFlowNode } from "./FlowNodeCard";

const nodeTypes = { chatbotNode: FlowNodeCard };
const labels: Record<FlowNodeKind, string> = { sendMessage: "Enviar mensagem", startFlow: "Iniciar fluxo", performAction: "Executar ação", condition: "Condição", sendMail: "Enviar e-mail", splitTraffic: "Dividir tráfego", wait: "Aguardar", followUp: "Follow-up", landingPage: "Landing page", addNotes: "Adicionar nota" };

interface FlowEditorProps { flow: ChatbotFlow; isBusy: boolean; onSave: (flow: ChatbotFlow) => Promise<void> }
export function FlowEditor({ flow, isBusy, onSave }: FlowEditorProps) {
  const initialNodes: CanvasFlowNode[] = flow.nodes.map((node) => ({ id: node.id, type: "chatbotNode", position: node.position, data: node.data }));
  const initialEdges: Edge[] = flow.edges.map((edge) => ({ ...edge }));
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState(flow.name);
  const [flowDescription, setFlowDescription] = useState(flow.description);
  const nodeCounter = useRef(flow.nodes.length);
  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const currentFlow = useMemo<ChatbotFlow>(() => ({ ...flow, name: flowName, description: flowDescription, nodes: nodes.map<FlowNode>((node) => ({ id: node.id, type: node.data.kind, position: node.position, data: node.data })), edges: edges.map<FlowEdge>((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: typeof edge.label === "string" ? edge.label : undefined })) }), [edges, flow, flowDescription, flowName, nodes]);
  const validation = useMemo(() => validateChatbotFlow(currentFlow), [currentFlow]);
  const connect = useCallback((connection: Connection) => setEdges((current) => addEdge({ ...connection, animated: true }, current)), [setEdges]);
  const addNode = (kind: FlowNodeKind) => { nodeCounter.current += 1; const id = `${flow.id}-node-local-${nodeCounter.current}`; const data: FlowNodeData = { label: labels[kind], kind, description: "Configure as propriedades deste node.", config: {} }; setNodes((current) => [...current, { id, type: "chatbotNode", position: { x: 120 + current.length * 55, y: 90 + current.length * 40 }, data }]); setSelectedId(id); };
  const removeSelected = () => { if (!deleteId) return; setNodes((current) => current.filter((node) => node.id !== deleteId)); setEdges((current) => current.filter((edge) => edge.source !== deleteId && edge.target !== deleteId)); setSelectedId(null); setDeleteId(null); toast.success("Node removido da simulação."); };
  return <div className="flex h-full min-h-[680px] flex-col overflow-hidden rounded-xl border border-white/5 bg-slate-950 lg:flex-row">
    <div className="grid shrink-0 gap-2 border-b border-white/5 p-3 lg:hidden"><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nome do fluxo<Input value={flowName} onChange={(event) => setFlowName(event.target.value)} maxLength={120} aria-invalid={!flowName.trim()} className="mt-1 border-white/10 bg-white/[0.03] text-sm normal-case tracking-normal" /></label><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Descrição<textarea value={flowDescription} onChange={(event) => setFlowDescription(event.target.value)} maxLength={500} className="mt-1 min-h-16 w-full rounded-md border border-white/10 bg-white/[0.03] p-2 text-xs font-normal normal-case tracking-normal outline-none focus:ring-2 focus:ring-indigo-500" /></label></div>
    <aside className="w-full shrink-0 border-b border-white/5 p-3 lg:w-56 lg:border-b-0 lg:border-r" aria-label="Paleta de nodes"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Adicionar node</p><div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">{CHATBOT_FLOW_NODE_KINDS.map((kind) => <button key={kind} type="button" onClick={() => addNode(kind)} className="flex min-h-10 items-center gap-2 rounded-lg border border-white/5 bg-white/[0.025] px-2.5 text-left text-xs text-slate-300 hover:border-indigo-500/30 hover:bg-indigo-500/5 focus-visible:ring-2 focus-visible:ring-indigo-500"><Plus className="size-3.5 text-indigo-400" />{labels[kind]}</button>)}</div></aside>
    <div className="relative min-h-[460px] flex-1 bg-[#020617]" aria-label="Canvas do fluxo"><ReactFlow<CanvasFlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} onNodeClick={(_, node) => setSelectedId(node.id)} fitView colorMode="dark"><Background color="#1e293b" gap={20} size={1} /><Controls /><MiniMap pannable zoomable className="!bg-slate-900" /></ReactFlow></div>
    <aside className="w-full shrink-0 border-t border-white/5 p-4 lg:w-80 lg:border-l lg:border-t-0" aria-label="Propriedades do node">{selected ? <div className="space-y-4"><div><label htmlFor="flow-node-label" className="text-xs font-medium text-slate-300">Nome</label><Input id="flow-node-label" value={selected.data.label} maxLength={120} onChange={(event) => setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, data: { ...node.data, label: event.target.value } } : node))} className="mt-1 border-white/10 bg-white/[0.03]" /></div><div><label htmlFor="flow-node-description" className="text-xs font-medium text-slate-300">Descrição</label><textarea id="flow-node-description" value={selected.data.description} maxLength={500} onChange={(event) => setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, data: { ...node.data, description: event.target.value } } : node))} className="mt-1 min-h-24 w-full resize-none rounded-md border border-white/10 bg-white/[0.03] p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" /></div><Button variant="destructive" size="sm" onClick={() => setDeleteId(selected.id)}><Trash2 />Remover node</Button></div> : <p className="text-xs text-slate-500">Selecione um node para editar suas propriedades.</p>}
      <div className="mt-6 border-t border-white/5 pt-4" aria-live="polite"><div className={`flex items-center gap-2 text-xs ${validation.valid ? "text-emerald-400" : "text-amber-400"}`}>{validation.valid ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}{validation.valid ? "Estrutura válida" : `${validation.errors.length} ajuste(s) necessário(s)`}</div>{!validation.valid && <ul className="mt-2 space-y-1 text-[11px] text-slate-500">{validation.errors.slice(0, 3).map((error, index) => <li key={`${error.code}-${error.nodeId ?? index}`}>• {error.message}</li>)}</ul>}<Button className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500" disabled={!validation.valid || isBusy} onClick={async () => { const parsed = chatbotFlowSchema.safeParse(currentFlow); if (!parsed.success) { toast.error(firstSchemaError(parsed)); return; } try { await onSave(parsed.data); toast.success("Fluxo salvo somente na memória."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o fluxo."); } }}><Save />{isBusy ? "Salvando…" : "Salvar simulação"}</Button></div>
    </aside>
    <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => { if (!open) setDeleteId(null); }}><AlertDialogContent className="border-white/10 bg-slate-950 text-slate-100"><AlertDialogHeader><AlertDialogTitle>Remover node?</AlertDialogTitle><AlertDialogDescription>As conexões vinculadas também serão removidas apenas desta simulação.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={removeSelected}>Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
