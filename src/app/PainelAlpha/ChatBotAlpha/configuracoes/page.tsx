"use client";
import { SettingsWorkspace } from "@/components/ChatBotAlpha/configuracoes/SettingsWorkspace";
import { useChatbotStore } from "@/store/useChatbotStore";
export default function ChatbotSettingsPage() { const settings = useChatbotStore((state) => state.snapshot.settings); const updateSettings = useChatbotStore((state) => state.updateSettings); const isBusy = useChatbotStore((state) => state.isBusy); return <SettingsWorkspace key={JSON.stringify(settings)} settings={settings} isBusy={isBusy} onUpdate={updateSettings} />; }
