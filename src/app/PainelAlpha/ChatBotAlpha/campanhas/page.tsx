"use client";
import { CampaignsWorkspace } from "@/components/ChatBotAlpha/campanhas/CampaignsWorkspace";
import { useChatbotStore } from "@/store/useChatbotStore";
export default function ChatbotCampaignsPage() { const campaigns = useChatbotStore((state) => state.snapshot.campaigns); const templates = useChatbotStore((state) => state.snapshot.templates); const saveCampaign = useChatbotStore((state) => state.saveCampaign); const isBusy = useChatbotStore((state) => state.isBusy); return <CampaignsWorkspace campaigns={campaigns} templates={templates} isBusy={isBusy} onSave={saveCampaign} />; }
