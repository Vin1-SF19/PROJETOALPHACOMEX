import type {
  AiAgent, Campaign, ChatbotFlow, ChatbotSettings, ChatbotSnapshot, Contact, Conversation,
  DashboardData, FlowValidation, Integration, Message, MessageTemplate, PageRequest, Paginated, Sequence,
} from "@/types/chatbot";

export interface ChatbotService {
  loadSnapshot(): Promise<ChatbotSnapshot>;
  getDashboard(): Promise<DashboardData>;
  listConversations(request?: PageRequest): Promise<Paginated<Conversation>>;
  getConversation(id: string): Promise<Conversation>;
  listMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, body: string): Promise<Message>;
  updateConversation(id: string, patch: Partial<Pick<Conversation, "status" | "assignee" | "tags">>): Promise<Conversation>;
  listContacts(request?: PageRequest): Promise<Paginated<Contact>>;
  updateContact(id: string, patch: Partial<Pick<Contact, "name" | "phone" | "email" | "notes" | "status" | "assignee" | "tags">>): Promise<Contact>;
  listFlows(request?: PageRequest): Promise<Paginated<ChatbotFlow>>;
  saveFlow(flow: ChatbotFlow): Promise<ChatbotFlow>;
  validateFlow(flow: ChatbotFlow): FlowValidation;
  listAgents(request?: PageRequest): Promise<Paginated<AiAgent>>;
  saveAgent(agent: AiAgent): Promise<AiAgent>;
  listCampaigns(request?: PageRequest): Promise<Paginated<Campaign>>;
  saveCampaign(campaign: Campaign): Promise<Campaign>;
  listSequences(request?: PageRequest): Promise<Paginated<Sequence>>;
  saveSequence(sequence: Sequence): Promise<Sequence>;
  listTemplates(request?: PageRequest): Promise<Paginated<MessageTemplate>>;
  saveTemplate(template: MessageTemplate): Promise<MessageTemplate>;
  listIntegrations(request?: PageRequest): Promise<Paginated<Integration>>;
  updateIntegration(id: string, status: Integration["status"]): Promise<Integration>;
  getSettings(): Promise<ChatbotSettings>;
  saveSettings(settings: ChatbotSettings): Promise<ChatbotSettings>;
}

export type ChatbotProviderName = "mock" | "api";

export class ChatbotServiceError extends Error {
  constructor(public readonly code: "not-found" | "invalid" | "simulated", message: string) {
    super(message);
    this.name = "ChatbotServiceError";
  }
}
