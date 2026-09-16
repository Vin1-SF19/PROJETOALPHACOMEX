"use client";
import { SequencesWorkspace } from "@/components/ChatBotAlpha/sequencias/SequencesWorkspace";
import { useChatbotStore } from "@/store/useChatbotStore";
export default function ChatbotSequencesPage() { const sequences = useChatbotStore((state) => state.snapshot.sequences); const templates = useChatbotStore((state) => state.snapshot.templates); const saveSequence = useChatbotStore((state) => state.saveSequence); const isBusy = useChatbotStore((state) => state.isBusy); return <SequencesWorkspace sequences={sequences} templates={templates} isBusy={isBusy} onSave={saveSequence} />; }
