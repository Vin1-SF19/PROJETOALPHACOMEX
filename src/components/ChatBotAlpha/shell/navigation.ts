import { Bot, ContactRound, GitBranch, LayoutDashboard, Megaphone, MessageSquare, Plug, Settings2, Sparkles, Workflow, type LucideIcon } from "lucide-react";

interface ChatbotNavigationGroup { group: string; items: Array<{ href: string; label: string; icon: LucideIcon }> }

export const CHATBOT_NAVIGATION: ChatbotNavigationGroup[] = [
  { group: "Operação", items: [
    { href: "/PainelAlpha/ChatBotAlpha/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/PainelAlpha/ChatBotAlpha/inbox", label: "Inbox", icon: MessageSquare },
    { href: "/PainelAlpha/ChatBotAlpha/contatos", label: "Contatos", icon: ContactRound },
  ] },
  { group: "Automação", items: [
    { href: "/PainelAlpha/ChatBotAlpha/fluxos", label: "Fluxos", icon: Workflow },
    { href: "/PainelAlpha/ChatBotAlpha/agentes", label: "Agentes IA", icon: Bot },
    { href: "/PainelAlpha/ChatBotAlpha/sequencias", label: "Sequências", icon: GitBranch },
  ] },
  { group: "Engajamento", items: [
    { href: "/PainelAlpha/ChatBotAlpha/campanhas", label: "Campanhas", icon: Megaphone },
    { href: "/PainelAlpha/ChatBotAlpha/templates", label: "Templates", icon: Sparkles },
  ] },
  { group: "Sistema", items: [
    { href: "/PainelAlpha/ChatBotAlpha/integracoes", label: "Integrações", icon: Plug },
    { href: "/PainelAlpha/ChatBotAlpha/configuracoes", label: "Configurações", icon: Settings2 },
  ] },
];

export const CHATBOT_ROUTE_COUNT = CHATBOT_NAVIGATION.reduce((total, group) => total + group.items.length, 0);
