import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks de dependências externas
vi.mock("next/server", () => ({
  NextResponse: class MockNextResponse {
    body: unknown;
    status: number;
    headers: Headers;
    constructor(body: unknown, init?: { status?: number; headers?: HeadersInit }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }
    static json(body: unknown, init?: { status?: number }) {
      return new MockNextResponse(body, init);
    }
  },
}));

vi.mock("../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/roles", () => ({
  isAdminRole: (role: string) => role === "ADMIN" || role === "CEO",
}));

vi.mock("@/actions/PermissoesSetor", () => ({
  getPermissoesEfetivas: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    documentoGerado: {
      findUnique: vi.fn(),
    },
  },
}));

import { auth } from "../../auth";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import { GET } from "../../src/app/PainelAlpha/GeradorDocumentos/[templateId]/download/route";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockPerms = getPermissoesEfetivas as ReturnType<typeof vi.fn>;
const mockFindUnique = db.documentoGerado.findUnique as ReturnType<typeof vi.fn>;

describe("GET /PainelAlpha/GeradorDocumentos/[id]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 quando não autenticado", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api"), { params: Promise.resolve({ templateId: "doc1" }) });
    expect(res.status).toBe(401);
  });

  it("retorna 403 quando autenticado sem permissão do módulo", async () => {
    mockAuth.mockResolvedValue({ user: { id: "99", role: "USER" } });
    mockPerms.mockResolvedValue(["outroModulo"]);

    const res = await GET(new Request("http://localhost/api"), { params: Promise.resolve({ templateId: "doc1" }) });
    expect(res.status).toBe(403);
  });

  it("retorna 404 quando o documento não existe", async () => {
    mockAuth.mockResolvedValue({ user: { id: "1", role: "ADMIN" } });
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api"), { params: Promise.resolve({ templateId: "inexistente" }) });
    expect(res.status).toBe(404);
  });

  it("retorna 403 quando autenticado como não-dono (não admin)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "2", role: "USER" } });
    mockPerms.mockResolvedValue(["geradorDocumentos"]);
    mockFindUnique.mockResolvedValue({
      id: "doc1",
      criadoPorId: 1, // dono é outro
      titulo: "Contrato",
      pdfUrl: "https://blob.example.com/doc.pdf",
    });

    const res = await GET(new Request("http://localhost/api"), { params: Promise.resolve({ templateId: "doc1" }) });
    expect(res.status).toBe(403);
  });

  it("retorna 404 quando pdfUrl é nulo", async () => {
    mockAuth.mockResolvedValue({ user: { id: "1", role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({
      id: "doc1",
      criadoPorId: 1,
      titulo: "Contrato",
      pdfUrl: null,
    });

    const res = await GET(new Request("http://localhost/api"), { params: Promise.resolve({ templateId: "doc1" }) });
    expect(res.status).toBe(404);
  });

  it("retorna 200 com PDF quando autenticado como dono", async () => {
    mockAuth.mockResolvedValue({ user: { id: "1", role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({
      id: "doc1",
      criadoPorId: 1,
      titulo: "Contrato de Teste",
      pdfUrl: "https://blob.example.com/doc.pdf",
    });

    // Mock do fetch para buscar o PDF do Blob
    const pdfBuffer = Buffer.from("%PDF-1.4 fake pdf content");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength),
    }));

    const res = await GET(new Request("http://localhost/api"), { params: Promise.resolve({ templateId: "doc1" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");

    vi.unstubAllGlobals();
  });

  it("retorna o mesmo PDF como inline para o visualizador autenticado", async () => {
    mockAuth.mockResolvedValue({ user: { id: "1", role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({ id: "doc-inline", criadoPorId: 1, titulo: "Contrato", pdfUrl: "https://blob.example.com/doc.pdf" });
    const pdfBuffer = Buffer.from("%PDF-1.4 fake pdf content");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength),
    }));

    const res = await GET(new Request("http://localhost/api?disposition=inline"), { params: Promise.resolve({ templateId: "doc-inline" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");

    vi.unstubAllGlobals();
  });

  it("recarregar a prévia não consome o limite de downloads", async () => {
    mockAuth.mockResolvedValue({ user: { id: "98765", role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({ id: "doc-revisado", criadoPorId: 98765, titulo: "Contrato", pdfUrl: "https://blob.example.com/revisao.pdf" });
    const pdfBuffer = Buffer.from("%PDF-1.4 revisado");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength),
    }));

    const params = { params: Promise.resolve({ templateId: "doc-revisado" }) };
    for (let revisao = 0; revisao < 6; revisao += 1) {
      expect((await GET(new Request(`http://localhost/api?disposition=inline&revision=${revisao}`), params)).status).toBe(200);
    }
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      expect((await GET(new Request("http://localhost/api"), params)).status).toBe(200);
    }
    expect((await GET(new Request("http://localhost/api"), params)).status).toBe(429);
    vi.unstubAllGlobals();
  });
});
