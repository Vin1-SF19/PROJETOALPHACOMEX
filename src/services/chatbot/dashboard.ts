import type { ChatbotChannel, ChatbotSnapshot, DashboardData } from "@/types/chatbot";
import { CHATBOT_CHANNELS } from "./constants";

export function deriveChatbotDashboard(snapshot: ChatbotSnapshot): DashboardData {
  const count = <T,>(items: T[], predicate: (item: T) => boolean) => items.filter(predicate).length;
  const activeAgents = count(snapshot.agents, (item) => item.active);
  const activeFlows = count(snapshot.flows, (item) => item.status === "active");
  const connectedChannels = count(snapshot.integrations, (item) => item.category === "channel" && item.status === "connected");
  const scheduledCampaigns = count(snapshot.campaigns, (item) => item.status === "scheduled");
  const channelVolume = CHATBOT_CHANNELS.map((channel) => ({ channel, count: count(snapshot.conversations, (item) => item.channel === channel) })).filter((item) => item.count > 0);
  const buckets = new Map<string, { label: string; received: number; sent: number }>();
  for (const message of snapshot.messages) {
    const hour = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit" }).format(new Date(message.createdAt));
    const bucket = buckets.get(hour) ?? { label: `${hour}h`, received: 0, sent: 0 };
    if (message.direction === "incoming") bucket.received += 1; else bucket.sent += 1;
    buckets.set(hour, bucket);
  }
  return {
    metrics: [
      { id: "open", label: "Conversas abertas", value: String(count(snapshot.conversations, (item) => item.status === "open")), change: `${snapshot.conversations.length} no total`, tone: "neutral" },
      { id: "resolved", label: "Conversas encerradas", value: String(count(snapshot.conversations, (item) => item.status === "resolved")), change: `${count(snapshot.conversations, (item) => item.status === "pending")} pendentes`, tone: "positive" },
      { id: "agents", label: "Agentes ativos", value: String(activeAgents), change: `${snapshot.agents.length - activeAgents} em pausa`, tone: "neutral" },
      { id: "flows", label: "Automações ativas", value: String(activeFlows), change: `${snapshot.flows.length - activeFlows} em rascunho/pausa`, tone: "warning" },
      { id: "channels", label: "Canais conectados", value: String(connectedChannels), change: `${channelVolume.length} com conversas`, tone: "neutral" },
      { id: "campaigns", label: "Campanhas", value: String(snapshot.campaigns.length), change: `${scheduledCampaigns} agendada(s)`, tone: "neutral" },
    ],
    volume: [...buckets.values()].sort((left, right) => left.label.localeCompare(right.label)),
    channelVolume: channelVolume as Array<{ channel: ChatbotChannel; count: number }>,
    queue: [
      { label: "Abertas", value: count(snapshot.conversations, (item) => item.status === "open") },
      { label: "Pendentes", value: count(snapshot.conversations, (item) => item.status === "pending") },
      { label: "Encerradas", value: count(snapshot.conversations, (item) => item.status === "resolved") },
    ],
  };
}

export function withDerivedDashboard(snapshot: ChatbotSnapshot): ChatbotSnapshot {
  return { ...snapshot, dashboard: deriveChatbotDashboard(snapshot) };
}
