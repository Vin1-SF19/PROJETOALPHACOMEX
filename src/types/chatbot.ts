export type ChatbotChannel = "whatsapp" | "messenger" | "instagram" | "tiktok" | "telegram" | "zalo" | "webchat" | "email" | "api";
export type EntityStatus = "active" | "inactive" | "draft" | "scheduled" | "completed" | "paused" | "error";
export type ConversationStatus = "open" | "pending" | "resolved";
export type MessageDirection = "incoming" | "outgoing";
export type MessageStatus = "received" | "sent" | "delivered" | "read" | "failed";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "required";
export type FlowNodeKind = "sendMessage" | "startFlow" | "performAction" | "condition" | "sendMail" | "splitTraffic" | "wait" | "followUp" | "landingPage" | "addNotes";

export interface Tag { id: string; name: string; color: string }
export interface Assignee { id: string; name: string; initials: string }
export interface Contact {
  id: string; name: string; initials: string; phone?: string; email?: string;
  channels: ChatbotChannel[]; tags: Tag[]; lastInteraction: string; status: "lead" | "customer" | "blocked";
  assignee?: Assignee; source: string; notes: string; history: ContactHistory[];
}
export interface ContactHistory { id: string; at: string; title: string; description: string }
export interface Conversation {
  id: string; contactId: string; channel: ChatbotChannel; status: ConversationStatus;
  lastMessage: string; updatedAt: string; unread: number; assignee?: Assignee; tags: Tag[];
}
export interface Message {
  id: string; conversationId: string; direction: MessageDirection; body: string;
  createdAt: string; status: MessageStatus; senderName: string;
}
export interface FlowNodeData extends Record<string, unknown> { label: string; kind: FlowNodeKind; description: string; config: Record<string, string> }
export interface FlowNode { id: string; type: FlowNodeKind; position: { x: number; y: number }; data: FlowNodeData }
export interface FlowEdge { id: string; source: string; target: string; label?: string }
export interface ChatbotFlow { id: string; name: string; description: string; status: EntityStatus; updatedAt: string; nodes: FlowNode[]; edges: FlowEdge[] }
export interface AiAgent {
  id: string; name: string; description: string; instructions: string; model: string; temperature: number;
  tools: string[]; behavior: string; flowIds: string[]; channels: ChatbotChannel[]; active: boolean;
}
export interface Campaign { id: string; name: string; audience: string; templateId: string; channel: ChatbotChannel; scheduledAt?: string; status: EntityStatus; sent: number; delivered: number }
export interface SequenceStep { id: string; order: number; delay: string; templateId: string; channel: ChatbotChannel }
export interface Sequence { id: string; name: string; description: string; status: EntityStatus; contacts: number; steps: SequenceStep[]; updatedAt: string }
export interface MessageTemplate { id: string; name: string; category: "marketing" | "utility" | "support"; channel: ChatbotChannel; content: string; status: EntityStatus; language: string; updatedAt: string }
export interface Integration { id: string; name: string; category: "channel" | "ai" | "marketing" | "automation" | "data"; description: string; status: IntegrationStatus }
export interface DashboardMetric { id: string; label: string; value: string; change: string; tone: "positive" | "neutral" | "warning" }
export interface VolumePoint { label: string; received: number; sent: number }
export interface DashboardData { metrics: DashboardMetric[]; volume: VolumePoint[]; channelVolume: Array<{ channel: ChatbotChannel; count: number }>; queue: Array<{ label: string; value: number }> }
export interface ChatbotSettings { availability: "online" | "away" | "offline"; desktopNotifications: boolean; sound: boolean; autoAssign: boolean; compactMode: boolean; queueLimit: number; defaultView: "all" | "mine" }
export interface PageRequest { page?: number; limit?: number; search?: string; status?: string; channel?: ChatbotChannel; sort?: "recent" | "oldest" | "name" }
export interface Paginated<T> { items: T[]; page: number; limit: number; total: number; pages: number }
export interface FlowValidation { valid: boolean; errors: Array<{ code: "missing-field" | "orphan-node" | "orphan-edge" | "missing-trigger"; nodeId?: string; message: string }> }
export interface ChatbotSnapshot { contacts: Contact[]; conversations: Conversation[]; messages: Message[]; flows: ChatbotFlow[]; agents: AiAgent[]; campaigns: Campaign[]; sequences: Sequence[]; templates: MessageTemplate[]; integrations: Integration[]; settings: ChatbotSettings; dashboard: DashboardData }
export type ChatbotRealtimeEvent =
  | { type: "conversation.created"; payload: Conversation }
  | { type: "conversation.updated"; payload: Partial<Conversation> & { id: string } }
  | { type: "message.created"; payload: Message }
  | { type: "message.updated"; payload: Partial<Message> & { id: string } }
  | { type: "message.delivered"; payload: { id: string; conversationId: string } }
  | { type: "message.read"; payload: { id: string; conversationId: string } }
  | { type: "contact.updated"; payload: Partial<Contact> & { id: string } };
