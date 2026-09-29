// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CampoBpmInput } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { RegistrarAnexoBpm } from "@/actions/bpm/Anexos";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import JSZip from "jszip";

vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));

it("enfileira upload e registro antes do await e abre o arquivo confirmado no modal", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    success: true,
    file: { recibo: "recibo-assinado" },
  }), { status: 200, headers: { "Content-Type": "application/json" } })));
  vi.mocked(RegistrarAnexoBpm).mockResolvedValue({
    success: true,
    data: { id: "anexo-1", nome: "contrato.pdf", url: "/api/bpm/anexos/anexo-1" },
  } as Awaited<ReturnType<typeof RegistrarAnexoBpm>>);
  const registerFileSave = vi.fn(async (save: () => Promise<boolean>) => save());
  const onFileConfirmed = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(h(CampoBpmInput, {
    campo: { id: "campo-arquivo", nome: "Contrato", tipo: "arquivo", obrigatorio: false, opcoesJson: null },
    value: "",
    onChange: vi.fn(),
    className: "",
    cardId: "card-1",
    registerFileSave,
    onFileConfirmed,
  })));
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["pdf"], "contrato.pdf", { type: "application/pdf" });
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));

  expect(registerFileSave).toHaveBeenCalledOnce();
  expect(RegistrarAnexoBpm).toHaveBeenCalledExactlyOnceWith({
    cardId: "card-1",
    campoId: "campo-arquivo",
    recibo: "recibo-assinado",
  });
  expect(onFileConfirmed).toHaveBeenCalledWith({
    id: "anexo-1",
    nome: "contrato.pdf",
    url: "/api/bpm/anexos/anexo-1",
  });

  await act(async () => root.render(h(CampoBpmInput, {
    campo: { id: "campo-arquivo", nome: "Contrato", tipo: "arquivo", obrigatorio: false, opcoesJson: null },
    value: "anexo-1",
    arquivoAtual: { id: "anexo-1", nome: "contrato.pdf", url: "/api/bpm/anexos/anexo-1" },
    onChange: vi.fn(),
    className: "",
    cardId: "card-1",
  })));
  const abrir = Array.from(container.querySelectorAll("button")).find((botao) => botao.textContent === "contrato.pdf");
  expect(abrir).toBeDefined();
  await act(async () => abrir?.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("contrato.pdf");

  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("limpa a pendência do anexo depois de falha e retry pelo diálogo", async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const card = {
    id: "card-upload", updatedAt: "2026-09-22T10:00:00Z",
    etapa: { nome: "Reunião", chave: "RADAR" }, anexos: [],
    camposEtapa: [{ id: "anexo", nome: "Documento", tipo: "arquivo", valor: "", obrigatorio: false, opcoesJson: null, editavel: true }],
  };
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: "Falha" }), { status: 500 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, file: { recibo: "recibo" } }), { status: 200 })));
  vi.mocked(RegistrarAnexoBpm).mockResolvedValue({ success: true, data: { id: "anexo-1", nome: "documento.pdf", url: "/anexo" } } as Awaited<ReturnType<typeof RegistrarAnexoBpm>>);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: {
    ...card, updatedAt: "2026-09-22T10:01:00Z", camposEtapa: [{ ...card.camposEtapa[0], valor: "anexo-1" }],
  } } as unknown as Awaited<ReturnType<typeof ObterCardBpm>>);
  let context!: ReturnType<typeof useCardSave>;
  function Probe() { const value = useCardSave(); React.useEffect(() => { context = value; }, [value]); return null; }
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    const painel = () => h(PainelCamposEtapaAtual, { card: card as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"],
      campoIds: ["anexo"], instanceKey: "upload", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn() });
    await act(async () => root.render(h(CardSaveProvider, null,
      h(Probe),
      painel())));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["%PDF-1.7"], "documento.pdf", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(context.getPendingChanges("card-upload")).toEqual([{ label: "Documento", before: "", after: "documento.pdf" }]);
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => root.render(h(CardSaveProvider, null, h(Probe))));
    await act(async () => root.render(h(CardSaveProvider, null, h(Probe), painel())));
    expect(container.textContent).toContain("Arquivo pronto para salvar: documento.pdf");
    await act(async () => { [...container.querySelectorAll("button")].find((botao) => botao.textContent?.includes("Salvar alterações"))!.click(); });
    expect(context.getFailedSaveKeys("card-upload")).toEqual(["card-upload:arquivo:anexo"]);
    expect(container.textContent).toContain("Arquivo pronto para salvar: documento.pdf");
    await act(async () => { [...container.querySelectorAll("button")].find((botao) => botao.textContent?.includes("Salvar alterações"))!.click(); });
    expect(context.getPendingChanges("card-upload")).toEqual([]);
    expect(context.getFailedSaveKeys("card-upload")).toEqual([]);
    expect(RegistrarAnexoBpm).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("recusa arquivo acima do limite na seleção sem criar pendência ou enviar request", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("fetch", vi.fn());
  const registerFileSave = vi.fn();
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(h(CampoBpmInput, {
      campo: { id: "anexo", nome: "Contrato", tipo: "arquivo", obrigatorio: false, opcoesJson: null },
      value: "", onChange: vi.fn(), className: "", cardId: "card-1", registerFileSave,
    })));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toContain(".png");
    expect(input.accept).toContain(".jpg");
    expect(input.accept).toContain(".jpeg");
    expect(input.accept).toContain(".docx");
    expect(input.accept).toContain(".pdf");
    Object.defineProperty(input, "files", { configurable: true, value: [new File([new ArrayBuffer(4 * 1024 * 1024 + 1)], "grande.pdf", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("4 MiB");
    expect(registerFileSave).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
  }
});

it("encerra estado de envio após erro HTTP e permite tentar novamente com o arquivo preservado", async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: "Armazenamento privado indisponível" }), { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, file: { recibo: "recibo" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(RegistrarAnexoBpm).mockResolvedValue({ success: true, data: { id: "anexo-1", nome: "contrato.pdf", url: "/anexo" } } as Awaited<ReturnType<typeof RegistrarAnexoBpm>>);
  let salvarArquivo: (() => Promise<boolean>) | undefined;
  const registerFileSave = vi.fn(async (save: () => Promise<boolean>) => { salvarArquivo = save; return true; });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(h(CampoBpmInput, {
      campo: { id: "anexo", nome: "Contrato", tipo: "arquivo", obrigatorio: false, opcoesJson: null },
      value: "", onChange: vi.fn(), className: "", cardId: "card-1", registerFileSave,
    })));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["%PDF-1.7"], "contrato.pdf", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { expect(await salvarArquivo?.()).toBe(false); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Armazenamento privado indisponível");
    expect(input.disabled).toBe(false);
    expect(container.textContent).not.toContain("Enviando arquivo");
    await act(async () => { expect(await salvarArquivo?.()).toBe(true); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(RegistrarAnexoBpm).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
  }
});

it("interrompe upload travado após 60 segundos e libera nova tentativa", async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    options.signal?.addEventListener("abort", () => reject(new DOMException("Abortado", "AbortError")));
  }));
  vi.stubGlobal("fetch", fetchMock);
  let salvarArquivo: (() => Promise<boolean>) | undefined;
  const registerFileSave = vi.fn(async (save: () => Promise<boolean>) => { salvarArquivo = save; return true; });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(h(CampoBpmInput, {
      campo: { id: "anexo", nome: "Contrato", tipo: "arquivo", obrigatorio: false, opcoesJson: null },
      value: "", onChange: vi.fn(), className: "", cardId: "card-1", registerFileSave,
    })));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["%PDF-1.7"], "contrato.pdf", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    vi.useFakeTimers();
    await act(async () => {
      const resultado = salvarArquivo?.();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(await resultado).toBe(false);
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(input.disabled).toBe(false);
    expect(container.textContent).not.toContain("Enviando arquivo");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("60 segundos");
  } finally {
    vi.useRealTimers();
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
  }
});

it("reutiliza recibo confirmado ao repetir registro que falhou, sem duplicar upload", async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, file: { recibo: "recibo-confirmado" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(RegistrarAnexoBpm)
    .mockResolvedValueOnce({ success: false, error: "Falha temporária ao registrar" } as Awaited<ReturnType<typeof RegistrarAnexoBpm>>)
    .mockResolvedValueOnce({ success: true, data: { id: "anexo-1", nome: "contrato.pdf", url: "/anexo" } } as Awaited<ReturnType<typeof RegistrarAnexoBpm>>);
  let salvarArquivo: (() => Promise<boolean>) | undefined;
  const registerFileSave = vi.fn(async (save: () => Promise<boolean>) => { salvarArquivo = save; return true; });
  const onFileConfirmed = vi.fn();
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(h(CampoBpmInput, {
      campo: { id: "anexo", nome: "Contrato", tipo: "arquivo", obrigatorio: false, opcoesJson: null },
      value: "", onChange: vi.fn(), className: "", cardId: "card-1", registerFileSave, onFileConfirmed,
    })));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["%PDF-1.7"], "contrato.pdf", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => { expect(await salvarArquivo?.()).toBe(false); });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(RegistrarAnexoBpm).toHaveBeenCalledExactlyOnceWith({ cardId: "card-1", campoId: "anexo", recibo: "recibo-confirmado" });
    expect(onFileConfirmed).not.toHaveBeenCalled();
    await act(async () => { expect(await salvarArquivo?.()).toBe(true); });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(RegistrarAnexoBpm).toHaveBeenCalledTimes(2);
    expect(vi.mocked(RegistrarAnexoBpm).mock.calls[1][0]).toEqual({ cardId: "card-1", campoId: "anexo", recibo: "recibo-confirmado" });
    expect(onFileConfirmed).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
  }
});

it("aceita seleção sem MIME para PDF, JPG e DOCX e bloqueia MIME explícito divergente", async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("fetch", vi.fn());
  const registerFileSave = vi.fn(async () => true);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(h(CampoBpmInput, {
      campo: { id: "anexo", nome: "Contrato", tipo: "arquivo", obrigatorio: false, opcoesJson: null },
      value: "", onChange: vi.fn(), className: "", cardId: "card-1", registerFileSave,
    })));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const zip = new JSZip(); zip.file("[Content_Types].xml", "<Types/>"); zip.file("word/document.xml", "<document/>");
    const docx = await zip.generateAsync({ type: "uint8array" });
    const arquivos = [
      new File(["%PDF-1.7"], "contrato.pdf"),
      new File([Uint8Array.from([0xff, 0xd8, 0xff]).buffer as ArrayBuffer], "foto.jpg", { type: "application/octet-stream" }),
      new File([docx.buffer as ArrayBuffer], "contrato.docx"),
    ];
    for (const arquivo of arquivos) {
      Object.defineProperty(input, "files", { configurable: true, value: [arquivo] });
      await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    }
    expect(registerFileSave).toHaveBeenCalledTimes(3);
    expect(fetch).not.toHaveBeenCalled();
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["%PDF-1.7"], "foto.jpg", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(registerFileSave).toHaveBeenCalledTimes(3);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Tipo de arquivo não permitido");
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
  }
});

it.each(["prazo preventivo", "erro de comprovante expirado"])("renova recibo no retry após %s", async (cenario) => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  let agora = 1_000_000;
  const relogio = vi.spyOn(Date, "now").mockImplementation(() => agora);
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, file: { recibo: "recibo-antigo" } }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, file: { recibo: "recibo-novo" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(RegistrarAnexoBpm)
    .mockResolvedValueOnce({ success: false, error: cenario === "prazo preventivo" ? "Falha temporária" : "Comprovante de upload inválido ou expirado" } as Awaited<ReturnType<typeof RegistrarAnexoBpm>>)
    .mockResolvedValueOnce({ success: true, data: { id: "anexo-1", nome: "contrato.pdf", url: "/anexo" } } as Awaited<ReturnType<typeof RegistrarAnexoBpm>>);
  let salvarArquivo: (() => Promise<boolean>) | undefined;
  const registerFileSave = vi.fn(async (save: () => Promise<boolean>) => { salvarArquivo = save; return true; });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(h(CampoBpmInput, {
      campo: { id: "anexo", nome: "Contrato", tipo: "arquivo", obrigatorio: false, opcoesJson: null },
      value: "", onChange: vi.fn(), className: "", cardId: "card-1", registerFileSave,
    })));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["%PDF-1.7"], "contrato.pdf", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => { expect(await salvarArquivo?.()).toBe(false); });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(vi.mocked(RegistrarAnexoBpm).mock.calls[0][0]).toMatchObject({ recibo: "recibo-antigo" });
    if (cenario === "prazo preventivo") agora += 9 * 60_000 + 1;
    else expect(container.querySelector('[role="alert"]')?.textContent).toContain("Clique em Salvar novamente");
    await act(async () => { expect(await salvarArquivo?.()).toBe(true); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.mocked(RegistrarAnexoBpm).mock.calls[1][0]).toMatchObject({ recibo: "recibo-novo" });
  } finally {
    relogio.mockRestore();
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
  }
});
