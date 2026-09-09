import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitizeLogValue,
  sanitizeLogObject,
  generateCorrelationId,
  startOperation,
  completeOperation,
  makeOperationalError,
  getMetrics,
  resetMetrics,
  setLogSink,
  getLogSink,
  chatbotAlphaLogEntrySchema,
  chatbotAlphaOperationalErrorSchema,
  chatbotAlphaErrorCategorySchema,
  chatbotAlphaOperationStatusSchema,
  chatbotAlphaMetricNameSchema,
  type ChatbotAlphaLogEntry,
} from "@/lib/chatbot-alpha/observability";

describe("observability — sanitization", () => {
  it("redacts token patterns in strings", () => {
    const input = "Connection failed: token=abc123def456";
    const result = sanitizeLogValue(input);
    expect(result).not.toContain("abc123def456");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts Bearer tokens", () => {
    const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig";
    const result = sanitizeLogValue(input);
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts API keys", () => {
    const input = "api_key=sk-ant-abc123xyz";
    const result = sanitizeLogValue(input);
    expect(result).not.toContain("sk-ant-abc123xyz");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts passwords", () => {
    const input = "password=SuperSecret123!";
    const result = sanitizeLogValue(input);
    expect(result).not.toContain("SuperSecret123!");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts sensitive query params in URLs", () => {
    const input = "https://admin.example.com?token=secret123&user=admin";
    const result = sanitizeLogValue(input);
    expect(result).not.toContain("secret123");
    expect(result).toContain("[REDACTED]");
  });

  it("preserves non-sensitive strings", () => {
    const input = "Operation completed successfully in 120ms";
    expect(sanitizeLogValue(input)).toBe(input);
  });

  it("redacts sensitive keys in objects", () => {
    const input = {
      url: "https://example.com",
      token: "secret-token-value",
      apiKey: "sk-123",
      message: "hello",
    };
    const result = sanitizeLogObject(input);
    expect(result.token).toBe("[REDACTED]");
    expect(result.apiKey).toBe("[REDACTED]");
    expect(result.message).toBe("hello");
    expect(result.url).toBe("https://example.com");
  });

  it("redacts nested objects with sensitive keys", () => {
    const input = {
      config: {
        password: "nested-secret",
        host: "localhost",
      },
    };
    const result = sanitizeLogObject(input);
    const config = result.config as Record<string, unknown>;
    expect(config.password).toBe("[REDACTED]");
    expect(config.host).toBe("localhost");
  });

  it("redacts prompt and attachment keys", () => {
    const input = {
      prompt: "private user prompt content",
      attachment: "file-content-here",
    };
    const result = sanitizeLogObject(input);
    expect(result.prompt).toBe("[REDACTED]");
    expect(result.attachment).toBe("[REDACTED]");
  });
});

describe("observability — correlation ID", () => {
  it("generates valid UUIDs", () => {
    const id = generateCorrelationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateCorrelationId()));
    expect(ids.size).toBe(100);
  });
});

describe("observability — operation tracking", () => {
  let capturedEntries: ChatbotAlphaLogEntry[] = [];

  beforeEach(() => {
    capturedEntries = [];
    setLogSink((entry) => capturedEntries.push(entry));
    resetMetrics();
  });

  it("tracks a successful operation", () => {
    const ctx = startOperation("ObterUrlSistemaChatBot", { system: "mailhog", userId: "user-1" });
    const entry = completeOperation(ctx, {
      status: "SUCCESS",
      message: "URL resolved successfully",
    });

    expect(entry.status).toBe("SUCCESS");
    expect(entry.operation).toBe("ObterUrlSistemaChatBot");
    expect(entry.system).toBe("mailhog");
    expect(entry.userId).toBe("user-1");
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(entry.correlationId).toBe(ctx.correlationId);
    expect(capturedEntries).toHaveLength(1);
  });

  it("tracks an auth failure and records metric", () => {
    const ctx = startOperation("ObterUrlSistemaChatBot", { system: "adminer" });
    completeOperation(ctx, {
      status: "DENIED",
      message: "User not authenticated",
      errorCategory: "AUTH",
      errorCode: "UNAUTHENTICATED",
    });

    expect(getMetrics().auth_failure_count).toBe(1);
  });

  it("tracks a timeout and records metric", () => {
    const ctx = startOperation("ObterUrlSistemaChatBot", { system: "redis" });
    completeOperation(ctx, {
      status: "TIMEOUT",
      message: "Request timed out after 30000ms",
      errorCategory: "TIMEOUT",
      errorCode: "TIMEOUT",
    });

    expect(getMetrics().timeout_count).toBe(1);
  });

  it("tracks external unavailability and records metric", () => {
    const ctx = startOperation("ObterUrlSistemaChatBot", { system: "mailhog" });
    completeOperation(ctx, {
      status: "UNAVAILABLE",
      message: "MailHog service not reachable",
      errorCategory: "EXTERNAL_UNAVAILABLE",
      errorCode: "SERVICE_UNAVAILABLE",
    });

    expect(getMetrics().external_unavailable_count).toBe(1);
  });

  it("tracks rate limit and records metric", () => {
    const ctx = startOperation("ObterUrlSistemaChatBot");
    completeOperation(ctx, {
      status: "ERROR",
      message: "Rate limit exceeded",
      errorCategory: "RATE_LIMIT",
      errorCode: "RATE_LIMIT",
    });

    expect(getMetrics().rate_limit_count).toBe(1);
  });

  it("tracks stream interruption and records metric", () => {
    const ctx = startOperation("chat.send", { system: "chat" });
    completeOperation(ctx, {
      status: "ERROR",
      message: "Stream was interrupted",
      errorCategory: "STREAM_INTERRUPTED",
      errorCode: "STREAM_INTERRUPTED",
    });

    expect(getMetrics().stream_interrupted_count).toBe(1);
  });

  it("sanitizes error messages in log entries", () => {
    const ctx = startOperation("ObterUrlSistemaChatBot");
    const entry = completeOperation(ctx, {
      status: "ERROR",
      message: "Failed: token=supersecret123",
      errorCategory: "INTERNAL",
    });

    expect(entry.message).not.toContain("supersecret123");
    expect(entry.message).toContain("[REDACTED]");
  });

  it("produces valid log entries matching the schema", () => {
    const ctx = startOperation("ObterUrlSistemaChatBot", { system: "mailhog" });
    const entry = completeOperation(ctx, {
      status: "SUCCESS",
      message: "OK",
    });

    expect(() => chatbotAlphaLogEntrySchema.parse(entry)).not.toThrow();
  });
});

describe("observability — operational errors (UI-safe)", () => {
  it("produces a safe error for AUTH category", () => {
    const err = makeOperationalError("AUTH", "uuid-1234");
    expect(err.code).toBe("AUTH");
    expect(err.message).toBe("Sessão expirada. Faça login novamente.");
    expect(err.retryable).toBe(false);
    expect(err.supportId).toBe("uuid-1234");
    expect(() => chatbotAlphaOperationalErrorSchema.parse(err)).not.toThrow();
  });

  it("produces a safe error for TIMEOUT category (retryable)", () => {
    const err = makeOperationalError("TIMEOUT", "uuid-5678");
    expect(err.retryable).toBe(true);
    expect(err.message).toContain("Tente novamente");
  });

  it("produces a safe error for EXTERNAL_UNAVAILABLE (retryable)", () => {
    const err = makeOperationalError("EXTERNAL_UNAVAILABLE", "uuid-9012");
    expect(err.retryable).toBe(true);
  });

  it("produces a safe error for PERMISSION_DENIED (not retryable)", () => {
    const err = makeOperationalError("PERMISSION", "uuid-3456");
    expect(err.retryable).toBe(false);
    expect(err.message).toContain("permissão");
  });

  it("never leaks internal details in operational errors", () => {
    const err = makeOperationalError("INTERNAL", "uuid-7890");
    expect(err.message).not.toContain("stack");
    expect(err.message).not.toContain("at ");
    expect(err.message).toContain("identificador");
  });
});

describe("observability — schemas", () => {
  it("error category schema accepts all valid values", () => {
    const valid = [
      "VALIDATION",
      "AUTH",
      "PERMISSION",
      "CONFIG",
      "EXTERNAL_UNAVAILABLE",
      "TIMEOUT",
      "RATE_LIMIT",
      "STREAM_INTERRUPTED",
      "INTERNAL",
    ];
    for (const v of valid) {
      expect(chatbotAlphaErrorCategorySchema.parse(v)).toBe(v);
    }
  });

  it("operation status schema accepts all valid values", () => {
    const valid = ["SUCCESS", "ERROR", "TIMEOUT", "DENIED", "UNAVAILABLE"];
    for (const v of valid) {
      expect(chatbotAlphaOperationStatusSchema.parse(v)).toBe(v);
    }
  });

  it("metric name schema accepts all valid values", () => {
    const valid = [
      "latency_ms",
      "timeout_count",
      "external_unavailable_count",
      "auth_failure_count",
      "rate_limit_count",
      "stream_interrupted_count",
    ];
    for (const v of valid) {
      expect(chatbotAlphaMetricNameSchema.parse(v)).toBe(v);
    }
  });

  it("rejects invalid error categories", () => {
    expect(() => chatbotAlphaErrorCategorySchema.parse("INVALID")).toThrow();
  });

  it("rejects invalid operation statuses", () => {
    expect(() => chatbotAlphaOperationStatusSchema.parse("INVALID")).toThrow();
  });
});

describe("observability — log sink", () => {
  it("allows custom log sink registration", () => {
    const entries: ChatbotAlphaLogEntry[] = [];
    setLogSink((e) => entries.push(e));

    const ctx = startOperation("test.op");
    completeOperation(ctx, { status: "SUCCESS", message: "ok" });

    expect(entries).toHaveLength(1);
    expect(entries[0].operation).toBe("test.op");
  });

  it("getLogSink returns the active sink", () => {
    const sink = () => {};
    setLogSink(sink);
    expect(getLogSink()).toBe(sink);
  });
});
