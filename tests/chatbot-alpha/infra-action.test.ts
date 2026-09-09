import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const getPermissoesEfetivasMock = vi.hoisted(() => vi.fn());

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/actions/PermissoesSetor", () => ({ getPermissoesEfetivas: getPermissoesEfetivasMock }));

import { ObterUrlSistemaChatBot } from "@/actions/ChatBotAlpha";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BASMAILOG_URL = "https://mailhog.example.com";
});

describe("ObterUrlSistemaChatBot — autorização direta do MailHog", () => {
  it("nega não-admin sem chatBotAlpha antes de resolver a URL", async () => {
    authMock.mockResolvedValue({ user: { id: "10", role: "colaborador" } });
    getPermissoesEfetivasMock.mockResolvedValue([]);
    const result = await ObterUrlSistemaChatBot("mailhog");
    expect(result.success).toBe(false);
  });

  it("permite não-admin com chatBotAlpha", async () => {
    authMock.mockResolvedValue({ user: { id: "10", role: "colaborador" } });
    getPermissoesEfetivasMock.mockResolvedValue(["chatBotAlpha"]);
    const result = await ObterUrlSistemaChatBot("mailhog");
    expect(result.success).toBe(true);
    if (result.success) expect(result.url).toBe("https://mailhog.example.com");
  });

  it("mantém Adminer restrito a admin mesmo com chatBotAlpha", async () => {
    authMock.mockResolvedValue({ user: { id: "10", role: "colaborador" } });
    getPermissoesEfetivasMock.mockResolvedValue(["chatBotAlpha"]);
    const result = await ObterUrlSistemaChatBot("adminer");
    expect(result.success).toBe(false);
  });
});
