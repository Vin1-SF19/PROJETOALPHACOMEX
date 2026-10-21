import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Preserve the actual route -> ownership -> document resolver chain. Only I/O is replaced.
const io = vi.hoisted(() => ({
  auth: vi.fn(), blob: vi.fn(), push: vi.fn(), alert: vi.fn(), event: vi.fn(),
  db: {
    usuarios: { findUnique: vi.fn() }, setorPermissao: { findMany: vi.fn() },
    usuarioPermissaoOverride: { findMany: vi.fn() }, bpmPipeline: { findUnique: vi.fn() },
    bpmCardMembro: { findUnique: vi.fn() },
    bpmCard: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
    bpmCardAnexo: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    documentoGerado: { findUnique: vi.fn() }, bpmTarefa: { create: vi.fn(), update: vi.fn() },
    bpmCardHistorico: { create: vi.fn() },
  },
}));
vi.mock("../../auth", () => ({ auth: io.auth }));
vi.mock("@/lib/prisma", () => ({ default: io.db }));
vi.mock("@vercel/blob", () => ({ get: io.blob }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: io.push }));
vi.mock("@/lib/bpm/alertas-tarefas", () => ({ dispararAlertaTarefaBpm: io.alert, tarefaAlertaSelect: {} }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: io.event }));

import { GET } from "@/app/api/bpm/cards/[cardId]/contrato/route";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import { resolverDocumentosContratacaoComercial } from "@/lib/bpm/contratacao-comercial-server";
import { CHAVES_CAMPOS as C } from "@/lib/bpm/financeiro-config.client";

const comercialId = "cm12345678901234567890123";
const financeiroId = "cm12345678901234567890124";
const outroComercialId = "cm12345678901234567890125";
const tokenDocumento = "12345678-1234-4234-8234-123456789abc";
const referenciaGerada = "https://fixture.public.blob.vercel-storage.com/gerador-documentos/pdfs-gerados/7/contrato.pdf";
type FileRow = { id: string; cardId: string; campoId: string; nome: string; tipo: string; url: string };

function fixture() {
  const usuario = { id: 7, role: "Comercial", status: "ATIVO", permissoes: "crm" };
  const comercial = {
    id: comercialId, empresaId: 3066, empresa: { razaoSocial: "EMPRESA FICTICIA", nomeFantasia: null },
    pipelineId: "radar", responsavelId: 7, status: "ATIVO", statusPosFechamento: "AGUARDANDO_CONTRATO",
    updatedAt: new Date("2026-10-21T18:00:00Z"),
    pipeline: { nome: "Revisão de Radar", chave: "comercial", ativo: true,
      visualizacaoConfigJson: null, setores: [{ setor: { nome: "Comercial", ativo: true } }] },
    etapa: { nome: "Contrato fechado", chave: "fechado", ehFinal: true, visibilidades: [] },
    vinculosOrigem: [{ id: "vinculo-ficticio", cardDestinoId: financeiroId }],
  };
  const financeiro = {
    id: financeiroId, empresaId: 3066, pipelineId: "financeiro", responsavelId: 9, status: "ATIVO",
    updatedAt: new Date("2026-10-21T18:00:00Z"),
    pipeline: { nome: "Financeiro", chave: "financeiro", ativo: true,
      visualizacaoConfigJson: null, setores: [{ setor: { nome: "Financeiro", ativo: true } }] },
    etapa: { nome: "Elaboração", ehFinal: false, visibilidades: [] }, vinculosOrigem: [],
    vinculosDestino: [{ cardOrigemId: comercialId }],
    campoValores: [
      { campoId: "f-elaborado", valor: "Sim", campo: { chave: C.CONTRATO_ELABORADO as string } },
      { campoId: "f-envio", valor: "file-envio", campo: { chave: C.LINK_CONTRATO as string } },
      { campoId: "f-assinado", valor: "file-assinado", campo: { chave: C.ANEXO_ASSINADO as string } },
    ],
  };
  const files: FileRow[] = [
    { id: "file-envio", cardId: financeiroId, campoId: "f-envio", nome: "Minuta.pdf", tipo: "application/pdf", url: `bpm-blob:bpm/${financeiroId}/minuta.pdf` },
    { id: "file-assinado", cardId: financeiroId, campoId: "f-assinado", nome: "Assinado.png", tipo: "image/png", url: `bpm-blob:bpm/${financeiroId}/assinado.png` },
  ];
  const gerado = { id: "documento-ficticio", clienteId: 3066, status: "FINALIZADO", pdfUrl: referenciaGerada,
    variaveisJson: JSON.stringify({ __bpmCardId: financeiroId }), finalizadoEm: new Date("2026-10-21T18:01:00Z") };
  io.auth.mockResolvedValue({ user: { id: "7", role: "Comercial" } });
  io.db.usuarios.findUnique.mockImplementation(async ({ where }: { where: { id: number } }) => where.id === 7 ? usuario : null);
  io.db.setorPermissao.findMany.mockResolvedValue([]);
  io.db.usuarioPermissaoOverride.findMany.mockResolvedValue([]);
  io.db.bpmCardMembro.findUnique.mockResolvedValue(null);
  io.db.bpmCard.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === comercialId ? comercial : where.id === financeiroId ? financeiro : null);
  io.db.bpmCard.findUniqueOrThrow.mockImplementation(async ({ where }: { where: { id: string } }) => {
    if (where.id !== financeiroId) throw new Error("Registro inexistente");
    return financeiro;
  });
  io.db.bpmCardAnexo.findFirst.mockImplementation(async ({ where }: { where: { id: string; cardId: string; campoId: string } }) =>
    files.find((row) => row.id === where.id && row.cardId === where.cardId && row.campoId === where.campoId) ?? null);
  io.db.documentoGerado.findUnique.mockImplementation(async ({ where }: { where: { tokenAcesso: string } }) =>
    where.tokenAcesso === tokenDocumento ? gerado : null);
  io.blob.mockImplementation(async (reference: string) => ({ statusCode: 200,
    blob: { contentType: files.find((file) => file.url === `bpm-blob:${reference}` || file.url === reference)?.tipo ?? "application/pdf" },
    stream: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("%PDF-fixture")); controller.close(); } }) }));
  return { usuario, comercial, financeiro, files, gerado };
}
const chamar = (query = "", cardId = comercialId) => GET(new Request(`https://fixture.test/api/bpm/cards/${cardId}/contrato${query}`),
  { params: Promise.resolve({ cardId }) });
function usarGerado(f: ReturnType<typeof fixture>) {
  f.files[0].tipo = "application/x-painel-alpha-documento";
  f.files[0].url = `/PainelAlpha/GeradorDocumentos/conferencia/${tokenDocumento}`;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BLOBCRM_READ_WRITE_TOKEN", "fixture-private-token");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "fixture-generated-token");
  vi.stubEnv("CRM_READ_WRITE_TOKEN", "fixture-legacy-token");
});
afterEach(() => vi.unstubAllEnvs());

describe("projeção de contrato: autorização real e isolamento entre negociações", () => {
  it("o closer pode ler pelo Comercial sem ganhar acesso ao Financeiro", async () => {
    fixture();
    expect((await checarAcessoBpmCard(financeiroId, 7, "Comercial", "visualizar")).autorizado).toBe(false);
    const response = await chamar();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-fixture");
    expect(io.blob).toHaveBeenCalledWith(`bpm/${financeiroId}/minuta.pdf`, expect.objectContaining({ access: "private", useCache: false }));
  });
  it("nega sem sessão antes de consultar os arquivos", async () => {
    fixture(); io.auth.mockResolvedValue(null);
    expect((await chamar()).status).toBe(401);
    expect(io.db.bpmCardAnexo.findFirst).not.toHaveBeenCalled();
    expect(io.blob).not.toHaveBeenCalled();
  });
  it.each(["INATIVO", "BLOQUEADO"])("conta %s não reutiliza papel Admin de sessão antiga", async (status) => {
    const f = fixture(); f.usuario.status = status;
    io.auth.mockResolvedValue({ user: { id: "7", role: "Admin (TI)" } });
    expect((await chamar()).status).toBe(403);
    expect(io.db.bpmCard.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(io.blob).not.toHaveBeenCalled();
  });
  it("revogação de CRM é aplicada mesmo com sessão antiga de Admin", async () => {
    const f = fixture(); f.usuario.permissoes = "";
    io.auth.mockResolvedValue({ user: { id: "7", role: "Admin (TI)" } });
    expect((await chamar()).status).toBe(403);
    expect(io.blob).not.toHaveBeenCalled();
  });
  it("revalida acesso em cada GET após o primeiro download autorizado", async () => {
    const f = fixture();
    expect((await chamar()).status).toBe(200);
    f.usuario.status = "INATIVO";
    expect((await chamar()).status).toBe(403);
    expect(io.blob).toHaveBeenCalledOnce();
  });
  it("não lê arquivo de outro Comercial apenas por aceitar um CUID válido", async () => {
    fixture();
    expect((await chamar("", outroComercialId)).status).toBe(403);
    expect(io.db.bpmCard.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(io.blob).not.toHaveBeenCalled();
  });
  it.each(["?tipo=outro", "?tipo=assinado%26url%3Dhttps%3A%2F%2Fevil.test", "?tipo="])("recusa tipo não enumerado: %s", async (query) => {
    fixture(); expect((await chamar(query)).status).toBe(400);
    expect(io.db.bpmCardAnexo.findFirst).not.toHaveBeenCalled();
    expect(io.blob).not.toHaveBeenCalled();
  });
  it.each(["noloss_123", "../financeiro", "contratacao:forjado:para_envio"])("ID virtual/forjado não seleciona documento: %s", async (id) => {
    fixture(); expect((await chamar("", id)).status).toBe(400);
    expect(io.blob).not.toHaveBeenCalled();
  });
  it("parâmetros financeiros e URL arbitrários não mudam o documento resolvido", async () => {
    fixture();
    const response = await chamar("?tipo=para_envio&financeiroId=outro&anexoId=secret&url=https%3A%2F%2Fevil.test%2Fsecret");
    expect(response.status).toBe(200);
    expect(io.blob.mock.calls[0][0]).toBe(`bpm/${financeiroId}/minuta.pdf`);
  });
  it.each(["empresa", "duas-origens", "outra-origem", "dois-financeiros", "cancelado"])("falha fechada para vínculo inválido: %s", async (modo) => {
    const f = fixture();
    if (modo === "empresa") f.financeiro.empresaId = 999;
    if (modo === "duas-origens") f.financeiro.vinculosDestino.push({ cardOrigemId: outroComercialId });
    if (modo === "outra-origem") f.financeiro.vinculosDestino[0].cardOrigemId = outroComercialId;
    if (modo === "dois-financeiros") f.comercial.vinculosOrigem.push({ id: "segundo", cardDestinoId: "cm12345678901234567890126" });
    if (modo === "cancelado") f.financeiro.status = "CANCELADO";
    expect((await chamar()).status).toBe(404);
    const dto = await resolverDocumentosContratacaoComercial(comercialId);
    expect(dto?.paraEnvio).toEqual({ estado: "PENDENTE", documento: null });
    expect(dto?.assinado).toEqual({ estado: "PENDENTE", documento: null });
    expect(io.blob).not.toHaveBeenCalled();
  });
  it("outro documento mais novo da mesma empresa não substitui o valor atual do campo", async () => {
    const f = fixture(); f.files.push({ ...f.files[0], id: "mais-novo", cardId: "cm12345678901234567890126", url: "bpm-blob:bpm/contratacao-outra/secreto.pdf" });
    expect((await chamar()).status).toBe(200);
    expect(io.blob.mock.calls[0][0]).toBe(`bpm/${financeiroId}/minuta.pdf`);
  });
  it.each(["card", "campo", "valor-ausente"])("somente anexo atual do campo financeiro exato é elegível: %s", async (modo) => {
    const f = fixture();
    if (modo === "card") f.files[0].cardId = outroComercialId;
    if (modo === "campo") f.files[0].campoId = "f-assinado";
    if (modo === "valor-ausente") f.financeiro.campoValores[1].valor = "";
    expect((await chamar()).status).toBe(404);
    expect((await chamar("?tipo=assinado")).status).toBe(200);
  });
});

describe("prontidão, geração e assinatura independentes", () => {
  it("minuta em CONFERENCIA não libera envio, mas assinado válido continua independente", async () => {
    const f = fixture(); usarGerado(f); f.gerado.status = "CONFERENCIA";
    expect((await chamar()).status).toBe(404);
    const response = await chamar("?tipo=assinado");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(io.blob).toHaveBeenCalledOnce();
  });
  it("assinado não depende de contrato elaborado nem status de assinatura preenchido", async () => {
    const f = fixture(); f.financeiro.campoValores[0].valor = "Não";
    expect((await chamar()).status).toBe(404);
    expect((await chamar("?tipo=assinado")).status).toBe(200);
  });
  it("FINALIZADO, origem financeira e caminho permitido tornam a referência gerada elegível", async () => {
    const f = fixture(); usarGerado(f);
    expect((await chamar()).status).toBe(200);
    expect(io.blob).toHaveBeenCalledWith(referenciaGerada, expect.objectContaining({ access: "public", token: "fixture-generated-token" }));
  });
  it.each([
    "http://fixture.public.blob.vercel-storage.com/gerador-documentos/pdfs-gerados/a.pdf",
    "https://evil.test/gerador-documentos/pdfs-gerados/a.pdf",
    "https://fixture.public.blob.vercel-storage.com.evil.test/gerador-documentos/pdfs-gerados/a.pdf",
    "https://fixture.public.blob.vercel-storage.com/outro-prefixo/a.pdf",
    "https://fixture.public.blob.vercel-storage.com/gerador-documentos/pdfs-gerados/a.pdf?token=forjado",
    "https://fixture.public.blob.vercel-storage.com/gerador-documentos/pdfs-gerados/a.pdf#fragmento",
    "https://user:secret@fixture.public.blob.vercel-storage.com/gerador-documentos/pdfs-gerados/a.pdf",
  ])("URL gerada não permitida não chega ao armazenamento: %s", async (url) => {
    const f = fixture(); usarGerado(f); f.gerado.pdfUrl = url;
    expect((await chamar()).status).toBe(404);
    expect(io.blob).not.toHaveBeenCalled();
  });
  it.each([JSON.stringify({ __bpmCardId: outroComercialId }), "{json-invalido}", "{}"])("identidade de geração incorreta não libera documento: %s", async (variaveisJson) => {
    const f = fixture(); usarGerado(f); f.gerado.variaveisJson = variaveisJson;
    expect((await chamar()).status).toBe(404);
    expect(io.blob).not.toHaveBeenCalled();
  });
  it.each(["token-malformado", `${tokenDocumento}?token=outro`, `${tokenDocumento}/extra`])("referência de conferência malformada não consulta documento: %s", async (token) => {
    const f = fixture(); usarGerado(f); f.files[0].url = `/PainelAlpha/GeradorDocumentos/conferencia/${token}`;
    expect((await chamar()).status).toBe(404);
    expect(io.db.documentoGerado.findUnique).not.toHaveBeenCalled();
  });
  it("gerado sem PDF não usa arquivo antigo ou outro anexo como fallback", async () => {
    const f = fixture(); usarGerado(f); f.gerado.pdfUrl = "";
    expect((await chamar()).status).toBe(404);
    expect(io.blob).not.toHaveBeenCalled();
  });
  it("identidade de geração concordante não dispensa a empresa do documento", async () => {
    const f = fixture(); usarGerado(f); f.gerado.clienteId = 999;
    expect((await chamar()).status).toBe(404);
    expect(io.blob).not.toHaveBeenCalled();
  });
  it("anexo local Comercial não se torna fallback documental do Financeiro no servidor", async () => {
    const f = fixture(); f.financeiro.campoValores[1].valor = "";
    f.files.push({ ...f.files[0], id: "local-comercial", cardId: comercialId, campoId: "campo-local", url: `bpm-blob:bpm/${comercialId}/local.pdf` });
    expect((await resolverDocumentosContratacaoComercial(comercialId))?.paraEnvio.estado).toBe("PENDENTE");
    expect((await chamar()).status).toBe(404);
  });
});

describe("privacidade da projeção e transporte autenticado", () => {
  it("DTO estável não contém identidade financeira, URL/token físico ou anexo persistido", async () => {
    const f = fixture(); usarGerado(f);
    const dto = await resolverDocumentosContratacaoComercial(comercialId);
    expect(dto?.paraEnvio.documento).toEqual({ id: `contratacao:${comercialId}:para_envio`, nome: "Minuta.pdf", tipo: "application/pdf",
      urlAcesso: `/api/bpm/cards/${comercialId}/contrato?tipo=para_envio`, origem: "CONTRATACAO", somenteLeitura: true });
    const json = JSON.stringify(dto);
    for (const segredo of [financeiroId, referenciaGerada, tokenDocumento, "file-envio", "file-assinado", "variaveisJson", "fixture-generated-token"])
      expect(json).not.toContain(segredo);
  });
  it("reabrir/refetch/baixar é somente leitura e nunca materializa alerta ou tarefa", async () => {
    fixture();
    await resolverDocumentosContratacaoComercial(comercialId);
    await resolverDocumentosContratacaoComercial(comercialId);
    expect((await chamar()).status).toBe(200);
    for (const write of [io.db.bpmCard.updateMany, io.db.bpmCardAnexo.create, io.db.bpmCardAnexo.delete,
      io.db.bpmTarefa.create, io.db.bpmTarefa.update, io.db.bpmCardHistorico.create, io.event, io.push, io.alert])
      expect(write).not.toHaveBeenCalled();
  });
  it("nome com CRLF/unicode não injeta headers e resposta privada não redireciona ao blob", async () => {
    const f = fixture(); f.files[0].nome = 'contrato ç\r\nX-Injetado: sim".pdf';
    const response = await chamar();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-injetado")).toBeNull();
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''");
    expect(response.headers.get("content-disposition")).not.toMatch(/[\r\n]/);
  });
  it("formato permitido sem preview é download, com seu MIME preservado", async () => {
    const f = fixture(); f.files[0].tipo = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; f.files[0].nome = "Contrato.docx";
    const response = await chamar();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(f.files[0].tipo);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
  });
  it.each(["text/html", "image/svg+xml", "application/javascript"])("MIME ativo não é liberado como contrato: %s", async (mime) => {
    const f = fixture(); f.files[0].tipo = mime;
    expect((await chamar()).status).toBe(404);
    expect(io.blob).not.toHaveBeenCalled();
  });
  it.each(["bpm-blob:bpm/outro-card/secreto.pdf", "bpm-blob:bpm/../segredo.pdf", "https://evil.test/arquivo.pdf"])("referência de upload fora do escopo não chega ao blob: %s", async (url) => {
    const f = fixture(); f.files[0].url = url;
    expect((await chamar()).status).toBe(404);
    expect(io.blob).not.toHaveBeenCalled();
  });
  it.each([
    "https://fixture.public.blob.vercel-storage.com/bpm/outro-card/secreto.pdf",
    `https://user:secret@fixture.public.blob.vercel-storage.com/bpm/${financeiroId}/contrato.pdf`,
    `https://fixture.public.blob.vercel-storage.com/bpm/${financeiroId}/contrato.pdf?token=forjado`,
    `https://fixture.public.blob.vercel-storage.com/bpm/${financeiroId}/contrato.pdf#fragmento`,
  ])("referência legada com propriedade/credencial indevida não chega ao blob: %s", async (url) => {
    const f = fixture(); f.files[0].url = url;
    expect((await chamar()).status).toBe(404);
    expect(io.blob).not.toHaveBeenCalled();
  });
  it("legado válido da própria contratação usa seu armazenamento sem redirect", async () => {
    const f = fixture(); f.files[0].url = `https://fixture.public.blob.vercel-storage.com/bpm/${financeiroId}/contrato.pdf`;
    const response = await chamar(); expect(response.status).toBe(200);
    expect(io.blob).toHaveBeenCalledWith(f.files[0].url, expect.objectContaining({ access: "public", token: "fixture-legacy-token" }));
    expect(response.headers.get("location")).toBeNull();
  });
  it("MIME físico divergente cancela stream antes de disponibilizar conteúdo ativo", async () => {
    fixture(); const cancel = vi.fn();
    io.blob.mockResolvedValue({ statusCode: 200, blob: { contentType: "text/html" }, stream: new ReadableStream({ cancel }) });
    const response = await chamar();
    expect(response.status).toBe(404);
    expect(cancel).toHaveBeenCalledOnce();
    expect(response.headers.get("content-type")).not.toBe("application/pdf");
  });
  it("objeto físico ausente retorna erro seguro sem URL nem token", async () => {
    fixture(); io.blob.mockResolvedValue(null);
    const response = await chamar(); expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(financeiroId);
  });
  it("exceção do armazenamento não expõe suas referências internas", async () => {
    fixture(); io.blob.mockRejectedValue(new Error(`secret=fixture-private-token path=bpm/${financeiroId}/minuta.pdf`));
    const response = await chamar(); expect(response.status).toBe(502);
    const body = await response.text(); expect(body).not.toContain("fixture-private-token"); expect(body).not.toContain(financeiroId);
  });
  it("token de origem ausente não cai em outro armazenamento", async () => {
    fixture(); vi.stubEnv("BLOBCRM_READ_WRITE_TOKEN", "");
    expect((await chamar()).status).toBe(503);
    expect(io.blob).not.toHaveBeenCalled();
  });
});
