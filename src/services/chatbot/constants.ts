import type { FlowNodeKind } from "@/types/chatbot";

export const CHATBOT_FLOW_NODE_KINDS: readonly FlowNodeKind[] = [
  "sendMessage",
  "startFlow",
  "performAction",
  "condition",
  "sendMail",
  "splitTraffic",
  "wait",
  "followUp",
  "landingPage",
  "addNotes",
];
import type { ChatbotChannel } from "@/types/chatbot";

export const CHATBOT_CHANNELS: readonly ChatbotChannel[] = [
  "whatsapp", "instagram", "messenger", "telegram", "email", "webchat", "api", "tiktok", "zalo",
];
