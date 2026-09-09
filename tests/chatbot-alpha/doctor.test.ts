import { describe, expect, it } from "vitest";
import { runChatbotAlphaDoctor } from "@/lib/chatbot-alpha/doctor";

function chatbotxCheck(env: Record<string, string | undefined>) {
  return runChatbotAlphaDoctor({ env, timestamp: "2026-09-08T00:00:00.000Z" }).then(
    (result) => result.checks.find((check) => check.id === "config.chatbotx-api"),
  );
}

describe("chatbot-alpha doctor — configuração workspace-token", () => {
  it("exige URL e CHATBOTX_API_KEY", async () => {
    expect(await chatbotxCheck({ CHATBOTX_API_URL: "https://example.com" })).toMatchObject({ ok: false });
    expect(await chatbotxCheck({ CHATBOTX_API_KEY: "key" })).toMatchObject({ ok: false });
    expect(await chatbotxCheck({ CHATBOTX_API_URL: "https://example.com", CHATBOTX_API_KEY: "key" })).toMatchObject({ ok: true });
  });

  it("aceita o token legado como fallback explícito", async () => {
    expect(await chatbotxCheck({ CHATBOTX_API_URL: "https://example.com", CHATBOTX_API_TOKEN: "legacy" })).toMatchObject({ ok: true });
  });

  it("rejeita CHATBOTX_API_URL malformada ou fora de HTTP/HTTPS", async () => {
    expect(await chatbotxCheck({ CHATBOTX_API_URL: "not-a-url", CHATBOTX_API_KEY: "key" })).toMatchObject({ ok: false });
    expect(await chatbotxCheck({ CHATBOTX_API_URL: "file:///tmp/chatbotx", CHATBOTX_API_KEY: "key" })).toMatchObject({ ok: false });
  });
});
