import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { criarFixtureChecklist } from "./sqlite-fixture";
import JSZip from "jszip";
const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get default() { return state.db; } }));
vi.mock("../../auth", () => ({ auth: vi.fn() }));
import { gerarZipChecklist } from "@/lib/checklist/zip";
const owner = { kind: "INTERNO", id: 1, sessionVersion: 0 } as const;
let fixture: Awaited<ReturnType<typeof criarFixtureChecklist>>;
beforeAll(async () => { fixture = await criarFixtureChecklist(); state.db = fixture.db; }, 30000);
afterAll(async () => { await fixture?.close(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function documents(count: number) {
  const f = await fixture.atendimento();
  await state.db.documentoChecklist.createMany({ data: Array.from({ length: count }, (_, i) => ({ itemId: f.item.id, nome: `doc-${i}.pdf`, url: `https://fixture.invalid/${i}` })) });
  vi.stubEnv("CHECKLIST_LEGACY_ALLOWED_HOSTS", '["fixture.invalid"]');
  return f;
}
function bodyMiB(total: number, onRead: () => void = () => {}, onCancel: () => void = () => {}) {
  const chunk = new Uint8Array(1024 * 1024);
  let sent = 0;
  return new ReadableStream<Uint8Array>({ pull(controller) { if (sent++ < total) { onRead(); controller.enqueue(chunk); } else controller.close(); }, cancel: onCancel });
}
async function archive(stream: ReadableStream<Uint8Array>) {
  const zip = await JSZip.loadAsync(await new Response(stream).arrayBuffer());
  const manifest = JSON.parse(await zip.file("manifesto.json")!.async("string")) as { incluidos: number; parcial: boolean; totalSolicitados: number; falhas: Array<{ documentoId: string; nome: string; motivo: string }> };
  return { zip, manifest };
}

describe.sequential("ZIP — limites pelo corpo e cancelamento", () => {
  it("sem Content-Length, fonte80MiB é interrompida ao ultrapassar25MiB e manifesto mantém outro arquivo", async () => {
    const f = await documents(2);
    const reads = vi.fn(), cancelled = vi.fn();
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => new Response(String(url).endsWith("/0") ? bodyMiB(80, reads, cancelled) : "%PDF-small"));
    const { zip, manifest } = await archive(await gerarZipChecklist(owner, f.empresa.id, { escopo: "ATIVO" }));
    expect(manifest).toMatchObject({ incluidos: 1, parcial: true, totalSolicitados: 2, falhas: [expect.objectContaining({ nome: "doc-0.pdf", motivo: "Limite de bytes excedido." })] });
    expect(Object.keys(zip.files).some((name) => name.endsWith("doc-1.pdf"))).toBe(true);
    expect(Object.keys(zip.files).some((name) => name.endsWith("doc-0.pdf"))).toBe(false);
    expect(cancelled).toHaveBeenCalledOnce();
    expect(reads.mock.calls.length).toBeLessThanOrEqual(27);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("limita100MiB agregados,3 downloads simultâneos e relata falha parcial", async () => {
    const f = await documents(5);
    let active = 0, peak = 0, bytesRead = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      active++; peak = Math.max(peak, active);
      let read = 0, ended = false;
      const finish = () => { if (!ended) { ended = true; active--; } };
      const chunk = new Uint8Array(1024 * 1024);
      return new Response(new ReadableStream<Uint8Array>({
        pull(controller) { if (read++ < 24) { bytesRead += chunk.length; controller.enqueue(chunk); } else { controller.close(); finish(); } }, cancel: finish,
      }));
    });
    const { manifest } = await archive(await gerarZipChecklist(owner, f.empresa.id, { escopo: "ATIVO" }));
    expect(peak).toBeLessThanOrEqual(3);
    expect(manifest.parcial).toBe(true);
    expect(manifest.incluidos).toBeLessThan(5);
    expect(manifest.incluidos + manifest.falhas.length).toBe(5);
    expect(manifest.falhas.every((failure) => failure.motivo === "Limite de bytes excedido.")).toBe(true);
    // Streams may prefetch one chunk per worker; persisted spool still observes100MiB.
    expect(bytesRead).toBeLessThanOrEqual(106 * 1024 * 1024);
    // The harness compresses/inflates ~100MiB: 4.24s isolated versus 16.9s for
    // this file under the 24-worker coverage run. Allow CPU contention here;
    // production byte/concurrency/deadline limits above remain unchanged.
  }, 20000);
  it("101arquivos falham antes de iniciar qualquer download", async () => {
    const f = await documents(101);
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(gerarZipChecklist(owner, f.empresa.id, { escopo: "TODOS" })).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("redirect não é seguido; origem não permitida nunca chega ao fetch", async () => {
    const f = await documents(2);
    const docs = await state.db.documentoChecklist.findMany({ where: { itemId: f.item.id }, orderBy: { nome: "asc" } });
    await state.db.documentoChecklist.update({ where: { id: docs[1].id }, data: { url: "https://evil.invalid/private" } });
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://evil.invalid/private" } }));
    const { manifest } = await archive(await gerarZipChecklist(owner, f.empresa.id, { escopo: "ATIVO" }));
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: "error", cache: "no-store", signal: expect.any(AbortSignal) }));
    expect(manifest).toMatchObject({ incluidos: 0, parcial: true, totalSolicitados: 2 });
    expect(manifest.falhas).toHaveLength(2);
  });
  it("abort de requisição interrompe body em andamento e não devolve ZIP parcial", async () => {
    const f = await documents(1);
    const controller = new AbortController();
    let bodyStarted!: () => void;
    const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const signal = init?.signal;
      return new Response(new ReadableStream<Uint8Array>({ start(stream) { stream.enqueue(new Uint8Array([1])); bodyStarted(); signal?.addEventListener("abort", () => stream.error(new Error("ABORTED")), { once: true }); } }));
    });
    const task = gerarZipChecklist(owner, f.empresa.id, {}, controller.signal);
    await started;
    controller.abort();
    await expect(task).rejects.toThrow("ABORTED");
  });
  it("deadlines porfetch e global encerram fontes sem resposta com manifesto completo", async () => {
    const f = await documents(7);
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const deadlines: number[] = [];
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => { deadlines.push(ms); return realTimeout(ms === 45000 ? 25 : 10); });
    let active = 0, peak = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      active++; peak = Math.max(peak, active);
      await new Promise<void>((_resolve, reject) => { init?.signal?.addEventListener("abort", () => { active--; reject(new Error("TIMEOUT")); }, { once: true }); });
      throw new Error("unreachable");
    });
    const { manifest } = await archive(await gerarZipChecklist(owner, f.empresa.id, {}));
    expect(deadlines).toContain(45000);
    expect(deadlines).toContain(10000);
    expect(peak).toBeLessThanOrEqual(3);
    expect(manifest).toMatchObject({ incluidos: 0, parcial: true, totalSolicitados: 7 });
    expect(manifest.falhas).toHaveLength(7);
  });
});
