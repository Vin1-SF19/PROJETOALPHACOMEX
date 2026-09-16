import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { GitBranch, Mail, MessageSquare, NotebookPen, Play, Split, Timer, Workflow, Zap } from "lucide-react";
import type { FlowNodeData, FlowNodeKind } from "@/types/chatbot";

const icons: Record<FlowNodeKind, typeof Play> = { startFlow: Play, sendMessage: MessageSquare, performAction: Zap, condition: GitBranch, sendMail: Mail, splitTraffic: Split, wait: Timer, followUp: Workflow, landingPage: Workflow, addNotes: NotebookPen };
export type CanvasFlowNode = Node<FlowNodeData, "chatbotNode">;

export function FlowNodeCard({ data, selected }: NodeProps<CanvasFlowNode>) {
  const Icon = icons[data.kind];
  return <div className={`w-52 rounded-xl border bg-slate-900 p-3 shadow-xl transition-shadow ${selected ? "border-indigo-400 shadow-indigo-500/20" : "border-white/10"}`}><Handle type="target" position={Position.Left} className="!size-2.5 !border-slate-700 !bg-indigo-400" /><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-indigo-500/10 text-indigo-300"><Icon className="size-3.5" /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-100">{data.label}</p><p className="text-[9px] uppercase tracking-wider text-slate-500">{data.kind}</p></div></div><p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-slate-400">{data.description}</p><Handle type="source" position={Position.Right} className="!size-2.5 !border-slate-700 !bg-indigo-400" /></div>;
}
