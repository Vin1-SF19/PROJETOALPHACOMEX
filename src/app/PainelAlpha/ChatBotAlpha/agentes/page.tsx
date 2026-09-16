"use client";
import { AgentsWorkspace } from "@/components/ChatBotAlpha/agentes/AgentsWorkspace";
import { useChatbotStore } from "@/store/useChatbotStore";
export default function ChatbotAgentsPage() { const agents = useChatbotStore((state) => state.snapshot.agents); const flows = useChatbotStore((state) => state.snapshot.flows); const saveAgent = useChatbotStore((state) => state.saveAgent); const isBusy = useChatbotStore((state) => state.isBusy); return <AgentsWorkspace agents={agents} flows={flows} isBusy={isBusy} onSave={saveAgent} />; }
