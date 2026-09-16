import { MockChatbotProvider } from "./mock-provider";
import type { ChatbotProviderName, ChatbotService } from "./service";

export function createChatbotService(provider: ChatbotProviderName = "mock", options?: { delayMs?: number; fail?: boolean }): ChatbotService {
  if (provider === "api") throw new Error("O provider de API é futuro e não está implementado nesta fase frontend.");
  return new MockChatbotProvider(options);
}

export const chatbotService = createChatbotService("mock");
export * from "./service";
export * from "./flow-validation";
export * from "./schemas";
export * from "./dashboard";
export * from "./clone";
