"use client";
import { IntegrationsWorkspace } from "@/components/ChatBotAlpha/integracoes/IntegrationsWorkspace";
import { useChatbotStore } from "@/store/useChatbotStore";
export default function ChatbotIntegrationsPage() { const integrations = useChatbotStore((state) => state.snapshot.integrations); const updateIntegration = useChatbotStore((state) => state.updateIntegration); const isBusy = useChatbotStore((state) => state.isBusy); return <IntegrationsWorkspace integrations={integrations} isBusy={isBusy} onUpdate={updateIntegration} />; }
