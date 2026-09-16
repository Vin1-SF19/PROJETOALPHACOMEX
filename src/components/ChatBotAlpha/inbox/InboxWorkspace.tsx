"use client";

import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { ConversationList } from "./ConversationList";
import { ContactPanel } from "./ContactPanel";
import { MessageComposer } from "./MessageComposer";
import { MessageThread } from "./MessageThread";
import { OperationalState } from "../shared/OperationalState";
import { useChatbotStore } from "@/store/useChatbotStore";
import type { ConversationStatus } from "@/types/chatbot";
import type { ChatbotChannel, PageRequest } from "@/types/chatbot";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export type InboxDisplayState = "ready" | "loading" | "error" | "empty";
interface InboxWorkspaceProps { displayState?: InboxDisplayState }

export function InboxWorkspace({ displayState = "ready" }: InboxWorkspaceProps) {
  const snapshot = useChatbotStore((state) => state.snapshot);
  const selectedId = useChatbotStore((state) => state.selectedConversationId);
  const isBusy = useChatbotStore((state) => state.isBusy);
  const selectConversation = useChatbotStore((state) => state.selectConversation);
  const sendMessage = useChatbotStore((state) => state.sendMessage);
  const updateConversation = useChatbotStore((state) => state.updateConversation);
  const retry = useChatbotStore((state) => state.retry);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ConversationStatus | "all">("all");
  const [channel, setChannel] = useState<ChatbotChannel | "all">("all");
  const [sort, setSort] = useState<NonNullable<PageRequest["sort"]>>("recent");
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const conversations = useMemo(() => snapshot.conversations.filter((conversation) => {
    const contact = snapshot.contacts.find((item) => item.id === conversation.contactId);
    const haystack = `${contact?.name ?? ""} ${conversation.lastMessage}`.toLocaleLowerCase("pt-BR");
    return (status === "all" || conversation.status === status) && (channel === "all" || conversation.channel === channel) && haystack.includes(search.trim().toLocaleLowerCase("pt-BR"));
  }).sort((left, right) => sort === "name" ? (snapshot.contacts.find((item) => item.id === left.contactId)?.name ?? "").localeCompare(snapshot.contacts.find((item) => item.id === right.contactId)?.name ?? "", "pt-BR") : sort === "oldest" ? left.updatedAt.localeCompare(right.updatedAt) : right.updatedAt.localeCompare(left.updatedAt)), [channel, search, snapshot.contacts, snapshot.conversations, sort, status]);
  const selected = snapshot.conversations.find((item) => item.id === selectedId) ?? null;
  const contact = selected ? snapshot.contacts.find((item) => item.id === selected.contactId) ?? null : null;
  const messages = selected ? snapshot.messages.filter((message) => message.conversationId === selected.id) : [];
  if (displayState === "loading") return <OperationalState state="loading" />;
  if (displayState === "error") return <OperationalState state="error" description="A simulação encontrou um erro controlado." onRetry={() => { void retry().catch(() => undefined); }} />;
  if (displayState === "empty" || snapshot.conversations.length === 0) return <OperationalState state="empty" title="Nenhuma conversa" description="Novas conversas aparecerão aqui quando o provider futuro estiver conectado." />;
  return <div className="h-full min-h-[calc(100vh-7rem)] p-2 sm:p-3"><div className="flex h-full min-h-[620px] overflow-hidden rounded-xl border border-white/5 bg-slate-950/50 shadow-2xl shadow-black/20">
    <div className={`${showChatOnMobile ? "hidden" : "flex"} min-h-0 w-full flex-col lg:flex lg:w-[340px]`}><ConversationList conversations={conversations} contacts={snapshot.contacts} selectedId={selectedId} search={search} status={status} channel={channel} sort={sort} onSearch={setSearch} onStatus={setStatus} onChannel={setChannel} onSort={setSort} onSelect={(id) => { selectConversation(id); setShowChatOnMobile(true); }} />{conversations.length === 0 && <OperationalState state="empty" title="Sem resultados" description="Ajuste a pesquisa ou os filtros." />}</div>
    <section className={`${showChatOnMobile ? "flex" : "hidden"} min-w-0 flex-1 flex-col lg:flex`} aria-label="Atendimento">{selected && contact ? <><MessageThread conversation={selected} contact={contact} messages={messages} onBack={() => setShowChatOnMobile(false)} onShowContact={() => setShowContact(true)} /><MessageComposer isBusy={isBusy} onSend={async (body) => { await sendMessage(selected.id, body); }} /></> : <div className="grid flex-1 place-items-center text-center"><div><MessageSquare className="mx-auto size-9 text-slate-700" /><p className="mt-3 text-sm text-slate-400">Selecione uma conversa</p><p className="mt-1 text-xs text-slate-600">O histórico e as ações aparecerão aqui.</p></div></div>}</section>
    {selected && contact && <><ContactPanel contact={contact} conversation={selected} isBusy={isBusy} onStatus={(nextStatus) => { void updateConversation(selected.id, { status: nextStatus }).catch(() => undefined); }} /><Sheet open={showContact} onOpenChange={setShowContact}><SheetContent side="right" className="overflow-y-auto p-0 xl:hidden"><SheetTitle className="sr-only">Informações do contato</SheetTitle><SheetDescription className="sr-only">Dados e ações da conversa selecionada</SheetDescription><ContactPanel embedded contact={contact} conversation={selected} isBusy={isBusy} onStatus={(nextStatus) => { void updateConversation(selected.id, { status: nextStatus }).catch(() => undefined); }} /></SheetContent></Sheet></>}
  </div></div>;
}
