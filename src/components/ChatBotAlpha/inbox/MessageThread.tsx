import { AlertCircle, Check, CheckCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contact, Conversation, Message } from "@/types/chatbot";
import { ChannelBadge } from "../shared/ChannelBadge";

interface MessageThreadProps { conversation: Conversation; contact: Contact; messages: Message[]; onBack: () => void; onShowContact: () => void }
const time = (value: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const conversationLabels = { open: "Em atendimento", pending: "Pendente", resolved: "Encerrada" } as const;
function DeliveryStatus({ message }: { message: Message }) {
  if (message.status === "failed") return <AlertCircle className="size-3 text-rose-200" aria-label="Falha no envio" />;
  if (message.status === "read") return <CheckCheck className="size-3 text-sky-200" aria-label="Lida" />;
  if (message.status === "delivered") return <CheckCheck className="size-3" aria-label="Entregue" />;
  return <Check className="size-3" aria-label="Enviada" />;
}
export function MessageThread({ conversation, contact, messages, onBack, onShowContact }: MessageThreadProps) {
  return <div className="flex min-h-0 flex-1 flex-col"><header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/5 px-3"><button type="button" onClick={onBack} className="grid size-10 place-items-center rounded-md text-slate-400 hover:bg-white/5 lg:hidden" aria-label="Voltar para conversas">←</button><span className="grid size-8 place-items-center rounded-full bg-slate-800 text-xs font-semibold">{contact.initials}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{contact.name}</p><div className="flex items-center gap-2"><ChannelBadge channel={conversation.channel} compact /><span className={cn("text-[10px]", conversation.status === "resolved" ? "text-slate-400" : conversation.status === "pending" ? "text-amber-300" : "text-emerald-400")}>● {conversationLabels[conversation.status]}</span></div></div><button type="button" onClick={onShowContact} className="ml-auto grid size-10 place-items-center rounded-md text-slate-400 hover:bg-white/5 xl:hidden" aria-label="Abrir informações do contato"><UserRound className="size-4" /></button><span className="hidden text-xs text-slate-500 xl:block">{conversation.assignee?.name ?? "Sem atendente"}</span></header>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-950/40 p-4" aria-live="polite">{messages.map((message) => <div key={message.id} className={cn("flex", message.direction === "outgoing" ? "justify-end" : "justify-start")}><div className={cn("max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm", message.direction === "outgoing" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-white/5 bg-slate-900 text-slate-200")}><p className="whitespace-pre-wrap leading-relaxed">{message.body}</p><span className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", message.direction === "outgoing" ? "text-indigo-100" : "text-slate-500")}><time>{time(message.createdAt)}</time>{message.direction === "outgoing" && <DeliveryStatus message={message} />}</span></div></div>)}</div>
  </div>;
}
