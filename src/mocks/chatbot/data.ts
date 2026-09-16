import type { ChatbotSnapshot, ChatbotChannel, Integration, FlowNode } from "@/types/chatbot";
import { deriveChatbotDashboard } from "@/services/chatbot/dashboard";
import { cloneChatbotData } from "@/services/chatbot/clone";

const now = new Date("2026-09-15T14:00:00.000Z");
const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
const channels: ChatbotChannel[] = ["whatsapp", "instagram", "messenger", "telegram", "email", "webchat", "api", "tiktok", "zalo"];
const tags = [
  { id: "tag-vip", name: "VIP", color: "amber" },
  { id: "tag-demo", name: "Demo", color: "indigo" },
  { id: "tag-fin", name: "Financeiro", color: "emerald" },
];
const assignees = [
  { id: "user-1", name: "Operadora Demo A", initials: "OA" },
  { id: "user-2", name: "Operador Demo B", initials: "OB" },
];
// Fixtures exclusivamente sintéticas: não representam pessoas reais e os telefones
// usam um marcador textual explicitamente não discável. `example.com` é domínio reservado.
const names = Array.from({ length: 12 }, (_, index) => `Contato Demo ${String(index + 1).padStart(2, "0")}`);

const contacts = names.map((name, index) => ({
  id: `contact-${index + 1}`, name, initials: name.split(" ").map((part) => part[0]).join(""),
  phone: `SYNTHETIC-NON-DIALABLE-${String(index + 1).padStart(3, "0")}`, email: `contato.demo.${String(index + 1).padStart(2, "0")}@example.com`,
  channels: [channels[index % channels.length]], tags: index % 3 === 0 ? [tags[index % tags.length]] : [],
  lastInteraction: iso(index * 29), status: index % 7 === 0 ? "lead" as const : "customer" as const,
  assignee: assignees[index % assignees.length], source: index % 2 ? "Campanha setembro" : "Atendimento orgânico",
  notes: "Contato acompanhado pelo time comercial. Preferência por comunicação objetiva.",
  history: [{ id: `history-${index}`, at: iso(index * 29 + 70), title: "Contato atualizado", description: "Dados revisados pela equipe." }],
}));
const conversations = contacts.slice(0, 9).map((contact, index) => ({
  id: `conversation-${index + 1}`, contactId: contact.id, channel: contact.channels[0],
  status: index % 4 === 0 ? "pending" as const : index % 5 === 0 ? "resolved" as const : "open" as const,
  lastMessage: ["Preciso de ajuda com meu pedido.", "Pode me enviar mais detalhes?", "Obrigado pelo atendimento!", "Gostaria de falar com o financeiro."][index % 4],
  updatedAt: iso(index * 11), unread: index % 4, assignee: assignees[index % assignees.length], tags: contact.tags,
}));
const messages = conversations.flatMap((conversation, index) => [
  { id: `message-${index}-1`, conversationId: conversation.id, direction: "incoming" as const, body: `Olá, sou ${contacts[index].name.split(" ")[0]}. ${conversation.lastMessage}`, createdAt: iso(index * 11 + 7), status: "received" as const, senderName: contacts[index].name },
  { id: `message-${index}-2`, conversationId: conversation.id, direction: "outgoing" as const, body: "Olá! Já estou verificando e retorno em instantes.", createdAt: iso(index * 11 + 4), status: "read" as const, senderName: assignees[index % 2].name },
]);
const flowNodes: FlowNode[] = [
  { id: "node-trigger", type: "startFlow" as const, position: { x: 30, y: 140 }, data: { label: "Nova conversa", kind: "startFlow" as const, description: "Inicia quando chega uma conversa", config: { event: "conversation.created" } } },
  { id: "node-message", type: "sendMessage" as const, position: { x: 310, y: 140 }, data: { label: "Boas-vindas", kind: "sendMessage" as const, description: "Envia a mensagem inicial", config: { message: "Olá! Como podemos ajudar?" } } },
  { id: "node-condition", type: "condition" as const, position: { x: 590, y: 140 }, data: { label: "Horário comercial", kind: "condition" as const, description: "Verifica disponibilidade", config: { rule: "business_hours" } } },
];
const integrationNames: Array<[string, Integration["category"]]> = [
  ...channels.map((channel) => [channel === "email" ? "SMTP / E-mail" : channel[0].toUpperCase() + channel.slice(1), "channel"] as [string, "channel"]),
  ["Workspace token", "data"], ["OpenAI", "ai"], ["Gemini", "ai"], ["Claude", "ai"], ["DeepSeek", "ai"], ["OpenRouter", "ai"], ["OpenAI-compatible", "ai"],
  ["Google Sheets", "data"], ["Facebook Ads", "marketing"], ["Make", "automation"], ["ActiveCampaign", "marketing"], ["GetResponse", "marketing"], ["Mailchimp", "marketing"], ["MailerLite", "marketing"], ["Moosend", "marketing"], ["Drip", "marketing"], ["SendGrid", "marketing"], ["Klaviyo", "marketing"],
];

export function createChatbotMockSnapshot(): ChatbotSnapshot {
  const snapshot: ChatbotSnapshot = {
    contacts, conversations, messages,
    flows: [{ id: "flow-1", name: "Qualificação inicial", description: "Recebe, identifica intenção e direciona o atendimento.", status: "active", updatedAt: iso(32), nodes: flowNodes, edges: [{ id: "edge-1", source: "node-trigger", target: "node-message" }, { id: "edge-2", source: "node-message", target: "node-condition" }] }, { id: "flow-2", name: "Fora do horário", description: "Resposta e follow-up fora do expediente.", status: "draft", updatedAt: iso(140), nodes: [], edges: [] }],
    agents: [{ id: "agent-1", name: "Alpha Concierge", description: "Triagem e atendimento inicial", instructions: "Seja objetivo, cordial e encaminhe casos sensíveis.", model: "OpenAI-compatible", temperature: 0.3, tools: ["Consultar contato", "Adicionar tag"], behavior: "Confirma antes de alterar dados", flowIds: ["flow-1"], channels: ["whatsapp", "webchat"], active: true }, { id: "agent-2", name: "Especialista Financeiro", description: "Organiza demandas financeiras", instructions: "Colete contexto e encaminhe ao responsável.", model: "Gemini", temperature: 0.2, tools: ["Adicionar nota"], behavior: "Nunca solicita credenciais", flowIds: [], channels: ["email"], active: false }],
    campaigns: [{ id: "campaign-1", name: "Relacionamento setembro", audience: "Clientes ativos · 842 contatos", templateId: "template-1", channel: "whatsapp", scheduledAt: iso(-1440), status: "scheduled", sent: 0, delivered: 0 }, { id: "campaign-2", name: "Pesquisa de satisfação", audience: "Atendidos nos últimos 30 dias", templateId: "template-2", channel: "email", status: "completed", sent: 428, delivered: 397 }],
    sequences: [{ id: "sequence-1", name: "Onboarding de clientes", description: "Cadência de boas-vindas em três passos.", status: "active", contacts: 124, updatedAt: iso(93), steps: [{ id: "step-1", order: 1, delay: "Imediato", templateId: "template-1", channel: "whatsapp" }, { id: "step-2", order: 2, delay: "2 dias", templateId: "template-2", channel: "email" }] }],
    templates: [{ id: "template-1", name: "Boas-vindas", category: "utility", channel: "whatsapp", content: "Olá, {{nome}}! Bem-vindo ao atendimento Alpha.", status: "active", language: "pt-BR", updatedAt: iso(42) }, { id: "template-2", name: "Satisfação pós-atendimento", category: "support", channel: "email", content: "Como foi sua experiência com nosso atendimento?", status: "active", language: "pt-BR", updatedAt: iso(170) }, { id: "template-3", name: "Oferta consultiva", category: "marketing", channel: "instagram", content: "Temos uma novidade para você.", status: "draft", language: "pt-BR", updatedAt: iso(300) }],
    integrations: integrationNames.map(([name, category], index) => ({ id: `integration-${index + 1}`, name, category, description: category === "channel" ? "Canal disponível para conexão futura." : "Conector identificado no ChatbotX de referência.", status: index === 0 ? "connected" : index % 9 === 0 ? "error" : index % 5 === 0 ? "required" : "disconnected" })),
    settings: { availability: "online", desktopNotifications: true, sound: false, autoAssign: true, compactMode: true, queueLimit: 25, defaultView: "all" },
    dashboard: { metrics: [], volume: [], channelVolume: [], queue: [] },
  };
  snapshot.dashboard = deriveChatbotDashboard(snapshot);
  return cloneChatbotData(snapshot);
}
