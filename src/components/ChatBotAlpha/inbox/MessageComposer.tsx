"use client";
import { useState } from "react";
import { Paperclip, Send, Smile } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { firstSchemaError, messageBodySchema } from "@/services/chatbot/schemas";

interface MessageComposerProps { isBusy: boolean; onSend: (body: string) => Promise<void> }
export function MessageComposer({ isBusy, onSend }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const parsed = messageBodySchema.safeParse(body); if (!parsed.success) { toast.error(firstSchemaError(parsed)); return; } const value = parsed.data; setBody(""); try { await onSend(value); toast.success("Mensagem adicionada à simulação."); } catch (error) { setBody(value); toast.error(error instanceof Error ? error.message : "Não foi possível adicionar a mensagem."); } };
  return <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-white/5 bg-slate-950 p-3"><Button type="button" variant="ghost" size="icon" className="size-11 text-slate-400 md:size-9" onClick={() => toast.info("Anexo apenas visual nesta fase.")} aria-label="Simular anexo"><Paperclip /></Button><Button type="button" variant="ghost" size="icon" className="size-11 text-slate-400 md:size-9" onClick={() => setBody((value) => `${value} 🙂`.slice(0, 8000))} aria-label="Adicionar emoji"><Smile /></Button><label htmlFor="chatbot-message" className="sr-only">Digite sua mensagem</label><textarea id="chatbot-message" value={body} maxLength={8000} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder="Digite sua mensagem…" className="min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500" /><Button type="submit" disabled={!body.trim() || isBusy} className="size-11 bg-indigo-600 px-0 hover:bg-indigo-500 md:size-9" aria-label="Enviar mensagem simulada"><Send /></Button></form>;
}
