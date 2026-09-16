import { AtSign, Facebook, Globe2, Instagram, Mail, MessageCircle, Send, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatbotChannel } from "@/types/chatbot";

const config: Record<ChatbotChannel, { label: string; icon: typeof MessageCircle; className: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, className: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
  instagram: { label: "Instagram", icon: Instagram, className: "text-pink-300 bg-pink-500/10 border-pink-500/20" },
  messenger: { label: "Messenger", icon: Facebook, className: "text-blue-300 bg-blue-500/10 border-blue-500/20" },
  telegram: { label: "Telegram", icon: Send, className: "text-sky-300 bg-sky-500/10 border-sky-500/20" },
  email: { label: "E-mail", icon: Mail, className: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
  webchat: { label: "Webchat", icon: Globe2, className: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20" },
  api: { label: "API", icon: AtSign, className: "text-violet-300 bg-violet-500/10 border-violet-500/20" },
  tiktok: { label: "TikTok", icon: Smartphone, className: "text-slate-200 bg-slate-500/10 border-slate-500/20" },
  zalo: { label: "Zalo", icon: MessageCircle, className: "text-indigo-300 bg-indigo-500/10 border-indigo-500/20" },
};

interface ChannelBadgeProps { channel: ChatbotChannel; compact?: boolean }
export function ChannelBadge({ channel, compact = false }: ChannelBadgeProps) {
  const item = config[channel]; const Icon = item.icon;
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", item.className)} title={item.label} aria-label={`Canal ${item.label}`}><Icon className="size-3" aria-hidden="true" />{compact ? <span className="sr-only">{item.label}</span> : item.label}</span>;
}
