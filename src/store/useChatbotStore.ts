"use client";

import { create } from "zustand";
import { chatbotService, withDerivedDashboard } from "@/services/chatbot";
import type { ChatbotService } from "@/services/chatbot";
import { cloneChatbotData } from "@/services/chatbot/clone";
import type {
  AiAgent, Campaign, ChatbotFlow, ChatbotRealtimeEvent, ChatbotSnapshot, ChatbotSettings,
  Contact, Conversation, Integration, Message, MessageTemplate, Sequence,
} from "@/types/chatbot";

export type ChatbotLoadState = "idle" | "loading" | "success" | "error";

export function createEmptyChatbotSnapshot(): ChatbotSnapshot {
  return {
    contacts: [], conversations: [], messages: [], flows: [], agents: [], campaigns: [], sequences: [], templates: [], integrations: [],
    settings: { availability: "offline", desktopNotifications: false, sound: false, autoAssign: false, compactMode: true, queueLimit: 25, defaultView: "all" },
    dashboard: { metrics: [], volume: [], channelVolume: [], queue: [] },
  };
}

export function applyChatbotRealtimeEvent(snapshot: ChatbotSnapshot, event: ChatbotRealtimeEvent): ChatbotSnapshot {
  const next = cloneChatbotData(snapshot);
  switch (event.type) {
    case "conversation.created": if (!next.conversations.some((item) => item.id === event.payload.id)) next.conversations.unshift(event.payload); break;
    case "conversation.updated": next.conversations = next.conversations.map((item) => item.id === event.payload.id ? { ...item, ...event.payload } : item); break;
    case "message.created": if (!next.messages.some((item) => item.id === event.payload.id)) next.messages.push(event.payload); break;
    case "message.updated": next.messages = next.messages.map((item) => item.id === event.payload.id ? { ...item, ...event.payload } : item); break;
    case "message.delivered": next.messages = next.messages.map((item) => item.id === event.payload.id ? { ...item, status: "delivered" } : item); break;
    case "message.read": next.messages = next.messages.map((item) => item.id === event.payload.id ? { ...item, status: "read" } : item); break;
    case "contact.updated": next.contacts = next.contacts.map((item) => item.id === event.payload.id ? { ...item, ...event.payload } : item); break;
  }
  return next;
}

export interface ChatbotUiState {
  snapshot: ChatbotSnapshot;
  loadState: ChatbotLoadState;
  selectedConversationId: string | null;
  selectedFlowId: string | null;
  isBusy: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  retry: () => Promise<void>;
  selectConversation: (id: string | null) => void;
  selectFlow: (id: string | null) => void;
  sendMessage: (conversationId: string, body: string) => Promise<Message>;
  updateConversation: (id: string, patch: Partial<Pick<Conversation, "status" | "assignee" | "tags">>) => Promise<void>;
  updateContact: (id: string, patch: Partial<Pick<Contact, "name" | "phone" | "email" | "notes" | "status" | "assignee" | "tags">>) => Promise<void>;
  saveFlow: (flow: ChatbotFlow) => Promise<void>;
  saveAgent: (agent: AiAgent) => Promise<void>;
  saveCampaign: (campaign: Campaign) => Promise<void>;
  saveSequence: (sequence: Sequence) => Promise<void>;
  saveTemplate: (template: MessageTemplate) => Promise<void>;
  updateIntegration: (id: string, status: Integration["status"]) => Promise<void>;
  updateSettings: (settings: ChatbotSettings) => Promise<void>;
  applyEvent: (event: ChatbotRealtimeEvent) => void;
}

const replaceById = <T extends { id: string }>(items: T[], entity: T) => items.some((item) => item.id === entity.id)
  ? items.map((item) => item.id === entity.id ? entity : item) : [entity, ...items];
const messageOf = (error: unknown) => error instanceof Error ? error.message : "Falha na simulação.";

export function createChatbotStore(service: ChatbotService = chatbotService) {
  return create<ChatbotUiState>((set, get) => {
    async function mutate<T>(operation: () => Promise<T>, commit: (entity: T, state: ChatbotUiState) => Partial<ChatbotUiState>): Promise<T> {
      if (get().isBusy) throw new Error("Aguarde a operação em andamento.");
      set({ isBusy: true, error: null });
      try {
        const entity = await operation();
        set((state) => {
          const patch = commit(entity, state);
          return patch.snapshot ? { ...patch, snapshot: withDerivedDashboard(patch.snapshot) } : patch;
        });
        return entity;
      } catch (error) {
        set({ error: messageOf(error) });
        throw error;
      } finally {
        set({ isBusy: false });
      }
    }
    async function load(force = false): Promise<void> {
      if (!force && (get().loadState === "loading" || get().loadState === "success")) return;
      set({ loadState: "loading", error: null });
      try {
        const snapshot = await service.loadSnapshot();
        set({ snapshot, loadState: "success", selectedConversationId: snapshot.conversations[0]?.id ?? null, selectedFlowId: snapshot.flows[0]?.id ?? null });
      } catch (error) {
        set({ loadState: "error", error: messageOf(error) });
        throw error;
      }
    }
    return {
      snapshot: createEmptyChatbotSnapshot(), loadState: "idle", selectedConversationId: null, selectedFlowId: null, isBusy: false, error: null,
      initialize: () => load(false), retry: () => load(true),
      selectConversation: (selectedConversationId) => set({ selectedConversationId }), selectFlow: (selectedFlowId) => set({ selectedFlowId }),
      sendMessage: (conversationId, body) => mutate(() => service.sendMessage(conversationId, body), (message, state) => ({ snapshot: { ...state.snapshot, messages: replaceById(state.snapshot.messages, message), conversations: state.snapshot.conversations.map((item) => item.id === conversationId ? { ...item, lastMessage: message.body, updatedAt: message.createdAt, unread: 0 } : item) } })),
      updateConversation: async (id, patch) => { await mutate(() => service.updateConversation(id, patch), (entity, state) => ({ snapshot: { ...state.snapshot, conversations: replaceById(state.snapshot.conversations, entity) } })); },
      updateContact: async (id, patch) => { await mutate(() => service.updateContact(id, patch), (entity, state) => ({ snapshot: { ...state.snapshot, contacts: replaceById(state.snapshot.contacts, entity) } })); },
      saveFlow: async (flow) => { await mutate(() => service.saveFlow(flow), (entity, state) => ({ snapshot: { ...state.snapshot, flows: replaceById(state.snapshot.flows, entity) }, selectedFlowId: entity.id })); },
      saveAgent: async (agent) => { await mutate(() => service.saveAgent(agent), (entity, state) => ({ snapshot: { ...state.snapshot, agents: replaceById(state.snapshot.agents, entity) } })); },
      saveCampaign: async (campaign) => { await mutate(() => service.saveCampaign(campaign), (entity, state) => ({ snapshot: { ...state.snapshot, campaigns: replaceById(state.snapshot.campaigns, entity) } })); },
      saveSequence: async (sequence) => { await mutate(() => service.saveSequence(sequence), (entity, state) => ({ snapshot: { ...state.snapshot, sequences: replaceById(state.snapshot.sequences, entity) } })); },
      saveTemplate: async (template) => { await mutate(() => service.saveTemplate(template), (entity, state) => ({ snapshot: { ...state.snapshot, templates: replaceById(state.snapshot.templates, entity) } })); },
      updateIntegration: async (id, status) => { await mutate(() => service.updateIntegration(id, status), (entity, state) => ({ snapshot: { ...state.snapshot, integrations: replaceById(state.snapshot.integrations, entity) } })); },
      updateSettings: async (settings) => { await mutate(() => service.saveSettings(settings), (entity, state) => ({ snapshot: { ...state.snapshot, settings: entity } })); },
      applyEvent: (event) => set((state) => ({ snapshot: withDerivedDashboard(applyChatbotRealtimeEvent(state.snapshot, event)) })),
    };
  });
}

export const useChatbotStore = createChatbotStore();
