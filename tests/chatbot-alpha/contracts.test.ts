import { describe, it, expect } from "vitest";
import {
  chatbotAlphaErrorCodeSchema,
  chatbotAlphaErrorSchema,
  chatbotAlphaCheckSchema,
  chatbotAlphaCapabilitySchema,
  chatbotAlphaCliResultSchema,
  makeCliResult,
  CHATBOT_ALPHA_CAPABILITIES,
} from "@/lib/chatbot-alpha/contracts";

describe("chatbot-alpha contracts", () => {
  describe("chatbotAlphaErrorCodeSchema", () => {
    it("accepts all defined error codes", () => {
      const codes = [
        "VALIDATION_ERROR",
        "UNAUTHENTICATED",
        "PERMISSION_DENIED",
        "SERVICE_NOT_CONFIGURED",
        "SERVICE_UNAVAILABLE",
        "TIMEOUT",
        "CONTRACT_INVALID",
      ];
      for (const code of codes) {
        expect(chatbotAlphaErrorCodeSchema.parse(code)).toBe(code);
      }
    });

    it("rejects unknown error codes", () => {
      expect(() => chatbotAlphaErrorCodeSchema.parse("UNKNOWN")).toThrow();
    });
  });

  describe("chatbotAlphaErrorSchema", () => {
    it("accepts a valid error object", () => {
      const result = chatbotAlphaErrorSchema.parse({
        code: "UNAUTHENTICATED",
        message: "User is not authenticated",
        retryable: false,
      });
      expect(result.code).toBe("UNAUTHENTICATED");
      expect(result.retryable).toBe(false);
    });

    it("accepts optional details", () => {
      const result = chatbotAlphaErrorSchema.parse({
        code: "SERVICE_NOT_CONFIGURED",
        message: "MailHog URL is not set",
        retryable: true,
        details: { missing: ["BASMAILOG_URL"] },
      });
      expect(result.details).toEqual({ missing: ["BASMAILOG_URL"] });
    });

    it("rejects empty message", () => {
      expect(() =>
        chatbotAlphaErrorSchema.parse({
          code: "VALIDATION_ERROR",
          message: "",
          retryable: false,
        }),
      ).toThrow();
    });
  });

  describe("chatbotAlphaCheckSchema", () => {
    it("accepts a valid check", () => {
      const result = chatbotAlphaCheckSchema.parse({
        id: "config.mailhog",
        ok: true,
        kind: "config",
        message: "MailHog URL is configured",
      });
      expect(result.id).toBe("config.mailhog");
      expect(result.ok).toBe(true);
    });

    it("accepts all check kinds", () => {
      const kinds = ["config", "dependency", "contract", "safety"];
      for (const kind of kinds) {
        expect(chatbotAlphaCheckSchema.parse({ id: "test", ok: true, kind, message: "ok" }).kind).toBe(kind);
      }
    });

    it("rejects unknown kind", () => {
      expect(() =>
        chatbotAlphaCheckSchema.parse({ id: "test", ok: true, kind: "unknown", message: "ok" }),
      ).toThrow();
    });
  });

  describe("chatbotAlphaCapabilitySchema", () => {
    it("accepts a valid capability", () => {
      const result = chatbotAlphaCapabilitySchema.parse({
        id: "infra.mailhog",
        label: "MailHog",
        description: "Acesso ao MailHog",
        status: "NOT_CONFIGURED",
        serverAction: "ObterUrlSistemaChatBot",
        requiresAdmin: false,
        requiresPermission: "chatBotAlpha",
      });
      expect(result.id).toBe("infra.mailhog");
      expect(result.requiresAdmin).toBe(false);
    });

    it("defaults requiresAdmin to false", () => {
      const result = chatbotAlphaCapabilitySchema.parse({
        id: "test",
        label: "Test",
        description: "Test capability",
        status: "AVAILABLE",
      });
      expect(result.requiresAdmin).toBe(false);
    });
  });

  describe("makeCliResult", () => {
    it("returns ok=true and code=0 when all checks pass", () => {
      const result = makeCliResult({
        command: "doctor",
        checks: [
          { id: "a", ok: true, kind: "config", message: "ok" },
          { id: "b", ok: true, kind: "safety", message: "ok" },
        ],
      });
      expect(result.ok).toBe(true);
      expect(result.code).toBe(0);
      expect(result.command).toBe("doctor");
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("returns ok=false and code=1 when a config check fails", () => {
      const result = makeCliResult({
        command: "doctor",
        checks: [
          { id: "a", ok: false, kind: "config", message: "missing" },
          { id: "b", ok: true, kind: "safety", message: "ok" },
        ],
      });
      expect(result.ok).toBe(false);
      expect(result.code).toBe(1);
    });

    it("returns code=2 when only non-config checks fail", () => {
      const result = makeCliResult({
        command: "doctor",
        checks: [
          { id: "a", ok: false, kind: "dependency", message: "unavailable" },
        ],
      });
      expect(result.ok).toBe(false);
      expect(result.code).toBe(2);
    });

    it("includes capabilities when provided", () => {
      const result = makeCliResult({
        command: "capabilities",
        checks: [{ id: "a", ok: true, kind: "contract", message: "ok" }],
        capabilities: CHATBOT_ALPHA_CAPABILITIES,
      });
      expect(result.capabilities).toHaveLength(CHATBOT_ALPHA_CAPABILITIES.length);
    });
  });

  describe("CHATBOT_ALPHA_CAPABILITIES", () => {
    it("has at least 3 infra capabilities", () => {
      const infra = CHATBOT_ALPHA_CAPABILITIES.filter((c) => c.id.startsWith("infra."));
      expect(infra.length).toBeGreaterThanOrEqual(3);
    });

    it("has at least 3 chat capabilities", () => {
      const chat = CHATBOT_ALPHA_CAPABILITIES.filter((c) => c.id.startsWith("chat."));
      expect(chat.length).toBeGreaterThanOrEqual(3);
    });

    it("chat.conversations e chat.messages têm contrato real (não mais pending reference)", () => {
      const conversations = CHATBOT_ALPHA_CAPABILITIES.find((c) => c.id === "chat.conversations");
      const messages = CHATBOT_ALPHA_CAPABILITIES.find((c) => c.id === "chat.messages");
      expect(conversations?.status).not.toBe("PENDING_REFERENCE");
      expect(messages?.status).not.toBe("PENDING_REFERENCE");
      expect(conversations?.serverAction).toBe("ListarConversasChatbotx");
      expect(messages?.serverAction).toContain("ListarMensagensChatbotx");
    });

    it("chat.uploads permanece pending — multipart não implementado nesta fase", () => {
      const uploads = CHATBOT_ALPHA_CAPABILITIES.find((c) => c.id === "chat.uploads");
      expect(uploads?.status).toBe("PENDING_REFERENCE");
    });

    it("all capabilities have valid schema", () => {
      for (const cap of CHATBOT_ALPHA_CAPABILITIES) {
        expect(() => chatbotAlphaCapabilitySchema.parse(cap)).not.toThrow();
      }
    });

    it("infra capabilities reference ObterUrlSistemaChatBot", () => {
      const infra = CHATBOT_ALPHA_CAPABILITIES.filter((c) => c.id.startsWith("infra."));
      for (const c of infra) {
        expect(c.serverAction).toBe("ObterUrlSistemaChatBot");
      }
    });
  });

  describe("chatbotAlphaCliResultSchema", () => {
    it("accepts a valid CLI result", () => {
      const result = makeCliResult({
        command: "doctor",
        checks: [{ id: "test", ok: true, kind: "config", message: "ok" }],
      });
      expect(() => chatbotAlphaCliResultSchema.parse(result)).not.toThrow();
    });
  });
});
