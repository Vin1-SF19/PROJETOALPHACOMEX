import { describe, expect, it } from "vitest";
import { createChatbotMockSnapshot } from "@/mocks/chatbot/data";
import { removeFlowNode, validateChatbotFlow } from "@/services/chatbot";
import { applyChatbotRealtimeEvent } from "@/store/useChatbotStore";
import type { ChatbotRealtimeEvent, Message } from "@/types/chatbot";

describe("ChatBot Alpha realtime-ready state", () => {
  it("aplica os sete eventos tipados e criação é idempotente", () => {
    let snapshot = createChatbotMockSnapshot();
    const conversation = { ...snapshot.conversations[0], id: "conversation-event" };
    const message: Message = { id: "message-event", conversationId: conversation.id, direction: "incoming", body: "Evento", createdAt: new Date().toISOString(), status: "received", senderName: "Contato" };
    const events: ChatbotRealtimeEvent[] = [
      { type: "conversation.created", payload: conversation },
      { type: "conversation.updated", payload: { id: conversation.id, status: "pending" } },
      { type: "message.created", payload: message },
      { type: "message.updated", payload: { id: message.id, body: "Evento atualizado" } },
      { type: "message.delivered", payload: { id: message.id, conversationId: conversation.id } },
      { type: "message.read", payload: { id: message.id, conversationId: conversation.id } },
      { type: "contact.updated", payload: { id: snapshot.contacts[0].id, notes: "Atualizado" } },
    ];
    for (const event of events) snapshot = applyChatbotRealtimeEvent(snapshot, event);
    snapshot = applyChatbotRealtimeEvent(snapshot, events[0]);
    expect(snapshot.conversations.filter((item) => item.id === conversation.id)).toHaveLength(1);
    expect(snapshot.messages.find((item) => item.id === message.id)?.status).toBe("read");
    expect(snapshot.contacts[0].notes).toBe("Atualizado");
  });
});

describe("ChatBot Alpha flow validation", () => {
  it("detecta trigger ausente, node órfão e edge inválida", () => {
    const flow = { ...createChatbotMockSnapshot().flows[0], nodes: [{ id: "alone", type: "wait" as const, position: { x: 0, y: 0 }, data: { label: "", kind: "wait" as const, description: "", config: {} } }], edges: [{ id: "bad", source: "alone", target: "missing" }] };
    const result = validateChatbotFlow(flow);
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining(["missing-trigger", "missing-field", "orphan-edge"]));
  });

  it("aceita o grafo mock válido e remove edges de node excluído", () => {
    const flow = createChatbotMockSnapshot().flows[0];
    expect(validateChatbotFlow(flow).valid).toBe(true);
    const removed = removeFlowNode(flow, "node-message");
    expect(removed.nodes.some((node) => node.id === "node-message")).toBe(false);
    expect(removed.edges.some((edge) => edge.source === "node-message" || edge.target === "node-message")).toBe(false);
  });
});
