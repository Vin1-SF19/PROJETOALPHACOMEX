"use client";
import { ContactsWorkspace } from "@/components/ChatBotAlpha/contatos/ContactsWorkspace";
import { useChatbotStore } from "@/store/useChatbotStore";
export default function ChatbotContactsPage() { const contacts = useChatbotStore((state) => state.snapshot.contacts); const updateContact = useChatbotStore((state) => state.updateContact); const isBusy = useChatbotStore((state) => state.isBusy); return <ContactsWorkspace contacts={contacts} isBusy={isBusy} onUpdate={updateContact} />; }
