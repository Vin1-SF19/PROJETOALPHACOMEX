"use client";
import { TemplatesWorkspace } from "@/components/ChatBotAlpha/templates/TemplatesWorkspace";
import { useChatbotStore } from "@/store/useChatbotStore";
export default function ChatbotTemplatesPage() { const templates = useChatbotStore((state) => state.snapshot.templates); const saveTemplate = useChatbotStore((state) => state.saveTemplate); const isBusy = useChatbotStore((state) => state.isBusy); return <TemplatesWorkspace templates={templates} isBusy={isBusy} onSave={saveTemplate} />; }
