import { createChatbotMockSnapshot } from "@/mocks/chatbot/data";
import { cloneChatbotData } from "./clone";
import { removeFlowNode, validateChatbotFlow } from "./flow-validation";
import { ChatbotServiceError, type ChatbotService } from "./service";
import {
  aiAgentSchema,
  campaignSchema,
  chatbotFlowSchema,
  chatbotIdSchema,
  chatbotSettingsSchema,
  contactPatchSchema,
  conversationUpdateSchema,
  integrationUpdateSchema,
  messageCreateSchema,
  messageTemplateSchema,
  pageRequestSchema,
  sequenceSchema,
} from "./schemas";
import { z } from "zod";
import type { ChatbotSnapshot, PageRequest, Paginated, Conversation, Contact, ChatbotFlow, AiAgent, Campaign, Sequence, MessageTemplate, Integration } from "@/types/chatbot";

type ListEntity = Conversation | Contact | ChatbotFlow | AiAgent | Campaign | Sequence | MessageTemplate | Integration;

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ChatbotServiceError("invalid", result.error.issues[0]?.message ?? "Dados inválidos.");
  }
  return result.data;
}

function paginate<T extends ListEntity>(items: T[], request: PageRequest = {}): Paginated<T> {
  const { page = 1, limit = 20, search = "", status, channel, sort = "recent" } = request;
  const needle = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = items.filter((item) => {
    const searchable = Object.values(item).filter((value) => typeof value === "string").join(" ").toLocaleLowerCase("pt-BR");
    const itemStatus = "status" in item ? item.status : undefined;
    const itemChannel = "channel" in item ? item.channel : undefined;
    return (!needle || searchable.includes(needle)) && (!status || itemStatus === status) && (!channel || itemChannel === channel);
  });
  const sorted = [...filtered].sort((left, right) => {
    if (sort === "name" && "name" in left && "name" in right) return left.name.localeCompare(right.name, "pt-BR");
    const leftDate = "updatedAt" in left ? left.updatedAt : "lastInteraction" in left ? left.lastInteraction : "";
    const rightDate = "updatedAt" in right ? right.updatedAt : "lastInteraction" in right ? right.lastInteraction : "";
    return sort === "oldest" ? leftDate.localeCompare(rightDate) : rightDate.localeCompare(leftDate);
  });
  const start = (page - 1) * limit;
  return { items: sorted.slice(start, start + limit), page, limit, total: sorted.length, pages: Math.max(1, Math.ceil(sorted.length / limit)) };
}

function upsert<T extends { id: string }>(items: T[], entity: T): T[] {
  const exists = items.some((item) => item.id === entity.id);
  return exists ? items.map((item) => item.id === entity.id ? entity : item) : [entity, ...items];
}

export class MockChatbotProvider implements ChatbotService {
  private state: ChatbotSnapshot = createChatbotMockSnapshot();
  private delayMs: number;
  private shouldFail: boolean;
  private messageSequence = 0;

  constructor(options: { delayMs?: number; fail?: boolean } = {}) { this.delayMs = options.delayMs ?? 0; this.shouldFail = options.fail ?? false; }
  setFailureMode(shouldFail: boolean): void { this.shouldFail = shouldFail; }
  private async wait(): Promise<void> { if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs)); if (this.shouldFail) throw new ChatbotServiceError("simulated", "Falha controlada do provider mock."); }
  private find<T extends { id: string }>(items: T[], id: string, label: string): T {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) throw new ChatbotServiceError("not-found", `${label} não encontrado.`);
    return item;
  }
  async loadSnapshot(): Promise<ChatbotSnapshot> {
    await this.wait();
    return cloneChatbotData(this.state);
  }
  async getDashboard() { await this.wait(); return cloneChatbotData(this.state.dashboard); }
  async listConversations(request?: PageRequest) { await this.wait(); return paginate(this.state.conversations, parseInput(pageRequestSchema, request ?? {})); }
  async getConversation(id: string) { await this.wait(); const parsedId = parseInput(chatbotIdSchema, id); return cloneChatbotData(this.find(this.state.conversations, parsedId, "Conversa")); }
  async listMessages(conversationId: string) { await this.wait(); const parsedId = parseInput(chatbotIdSchema, conversationId); return cloneChatbotData(this.state.messages.filter((message) => message.conversationId === parsedId)); }
  async sendMessage(conversationId: string, body: string) {
    await this.wait();
    const input = parseInput(messageCreateSchema, { conversationId, body });
    const conversation = this.find(this.state.conversations, input.conversationId, "Conversa");
    const message = { id: `message-local-${Date.now()}-${++this.messageSequence}`, conversationId: input.conversationId, direction: "outgoing" as const, body: input.body, createdAt: new Date().toISOString(), status: "sent" as const, senderName: "Você" };
    this.state.messages.push(message);
    this.state.conversations = this.state.conversations.map((item) => item.id === conversation.id ? { ...item, lastMessage: message.body, updatedAt: message.createdAt, unread: 0 } : item);
    return cloneChatbotData(message);
  }
  async updateConversation(id: string, patch: Partial<Pick<Conversation, "status" | "assignee" | "tags">>) {
    await this.wait(); const input = parseInput(conversationUpdateSchema, { id, patch }); const updated = { ...this.find(this.state.conversations, input.id, "Conversa"), ...input.patch };
    this.state.conversations = upsert(this.state.conversations, updated); return cloneChatbotData(updated);
  }
  async listContacts(request?: PageRequest) { await this.wait(); return paginate(this.state.contacts, parseInput(pageRequestSchema, request ?? {})); }
  async updateContact(id: string, patch: Partial<Pick<Contact, "name" | "phone" | "email" | "notes" | "status" | "assignee" | "tags">>) {
    await this.wait(); const parsedId = parseInput(chatbotIdSchema, id); const parsedPatch = parseInput(contactPatchSchema, patch); const updated = { ...this.find(this.state.contacts, parsedId, "Contato"), ...parsedPatch };
    this.state.contacts = upsert(this.state.contacts, updated); return cloneChatbotData(updated);
  }
  async listFlows(request?: PageRequest) { await this.wait(); return paginate(this.state.flows, parseInput(pageRequestSchema, request ?? {})); }
  async saveFlow(flow: ChatbotFlow) { await this.wait(); const parsed = parseInput(chatbotFlowSchema, flow); const saved = { ...parsed, updatedAt: new Date().toISOString() }; this.state.flows = upsert(this.state.flows, saved); return cloneChatbotData(saved); }
  validateFlow(flow: ChatbotFlow) { return validateChatbotFlow(parseInput(chatbotFlowSchema, flow)); }
  removeNode(flow: ChatbotFlow, nodeId: string) { return removeFlowNode(parseInput(chatbotFlowSchema, flow), parseInput(chatbotIdSchema, nodeId)); }
  async listAgents(request?: PageRequest) { await this.wait(); return paginate(this.state.agents, parseInput(pageRequestSchema, request ?? {})); }
  async saveAgent(agent: AiAgent) { await this.wait(); const parsed = parseInput(aiAgentSchema, agent); this.state.agents = upsert(this.state.agents, parsed); return cloneChatbotData(parsed); }
  async listCampaigns(request?: PageRequest) { await this.wait(); return paginate(this.state.campaigns, parseInput(pageRequestSchema, request ?? {})); }
  async saveCampaign(campaign: Campaign) { await this.wait(); const parsed = parseInput(campaignSchema, campaign); this.state.campaigns = upsert(this.state.campaigns, parsed); return cloneChatbotData(parsed); }
  async listSequences(request?: PageRequest) { await this.wait(); return paginate(this.state.sequences, parseInput(pageRequestSchema, request ?? {})); }
  async saveSequence(sequence: Sequence) { await this.wait(); const parsed = parseInput(sequenceSchema, sequence); this.state.sequences = upsert(this.state.sequences, parsed); return cloneChatbotData(parsed); }
  async listTemplates(request?: PageRequest) { await this.wait(); return paginate(this.state.templates, parseInput(pageRequestSchema, request ?? {})); }
  async saveTemplate(template: MessageTemplate) { await this.wait(); const parsed = parseInput(messageTemplateSchema, template); this.state.templates = upsert(this.state.templates, parsed); return cloneChatbotData(parsed); }
  async listIntegrations(request?: PageRequest) { await this.wait(); return paginate(this.state.integrations, parseInput(pageRequestSchema, request ?? {})); }
  async updateIntegration(id: string, status: Integration["status"]) { await this.wait(); const input = parseInput(integrationUpdateSchema, { id, status }); const updated = { ...this.find(this.state.integrations, input.id, "Integração"), status: input.status }; this.state.integrations = upsert(this.state.integrations, updated); return cloneChatbotData(updated); }
  async getSettings() { await this.wait(); return cloneChatbotData(this.state.settings); }
  async saveSettings(settings: ChatbotSnapshot["settings"]) { await this.wait(); const parsed = parseInput(chatbotSettingsSchema, settings); this.state.settings = cloneChatbotData(parsed); return cloneChatbotData(parsed); }
}

export const __testing = { paginate };
