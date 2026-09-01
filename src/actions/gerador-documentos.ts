"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

import db from "@/lib/prisma";
import { getUserOnyxToken } from "@/lib/onyx/user-token";
import { OnyxError } from "@/lib/onyx/client";
import { extractTextFromBuffer } from "@/lib/bibble/tika";
import {
  exigirAcessoModulo,
  exigirOwnershipTemplate,
  exigirOwnershipDocumento,
  getSessaoGeradorDocumentos,
  type ContextoGeradorDocumentos,
} from "@/lib/gerador-documentos/ownership";
import {
  CriarTemplateSchema,
  AtualizarTemplateSchema,
  CriarClasulaSchema,
  AtualizarClasulaSchema,
  ReordenarClasulasSchema,
  GerarDocumentoSchema,
  ReescreverClasulaSchema,
  EditarClasulaGeradaSchema,
  VariavelTemplateSchema,
  type VariavelTemplate,
  type CriarTemplateInput,
} from "@/lib/gerador-documentos/schemas";
import { renderizarConteudo, validarVariaveisObrigatorias } from "@/lib/gerador-documentos/render";
import { reescreverClasulaViaIA, identificarVariaveisEClasulasViaIA } from "@/lib/gerador-documentos/onyx";
import { gerarPdfDocumento } from "@/lib/gerador-documentos/pdf";
import { converterParaHtml } from "@/lib/gerador-documentos/html";
import { renderHtmlComVariaveis } from "@/lib/gerador-documentos/html-render";
import { renderHtmlParaPdf } from "@/lib/gerador-documentos/pdf-renderer";

// Mesma lista de tipos suportados por extractTextFromBuffer (src/lib/bibble/tika.ts) — mantida em
// sincronia manual, já que a extração é responsabilidade daquele módulo, não deste.
const TIPOS_UPLOAD_TEMPLATE_SUPORTADOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "application/rtf",
];
const TAMANHO_MAXIMO_UPLOAD_TEMPLATE = 10 * 1024 * 1024; // 10MB — mesmo teto já usado em outros uploads do painel

const ROTA_BASE = "/PainelAlpha/GeradorDocumentos";

const getSessao = getSessaoGeradorDocumentos;

function parseVariaveisJson(json: unknown): VariavelTemplate[] {
  const parsed = z.array(VariavelTemplateSchema).safeParse(json);
  return parsed.success ? parsed.data : [];
}

function mensagemErro(error: unknown): string {
  if (error instanceof OnyxError) return error.message;
  if (error instanceof z.ZodError) return "Dados inválidos";
  if (error instanceof Error) {
    if (["Não autenticado", "Não autorizado", "Template não encontrado", "Documento não encontrado"].includes(error.message)) {
      return error.message;
    }
  }
  return "Não foi possível concluir a operação";
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function ListarTemplatesDocumentos() {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);

    const where = ctx.isAdmin ? {} : { criadoPorId: userId };
    const templates = await db.documentoTemplate.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        categoria: true,
        status: true,
        criadoEm: true,
        atualizadoEm: true,
        criadoPor: { select: { id: true, nome: true } },
        _count: { select: { clausulas: true, documentos: true } },
      },
    });

    return { success: true as const, data: templates };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error), data: [] };
  }
}

export async function ObterTemplateDocumento(templateId: string) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    await exigirOwnershipTemplate(templateId, ctx);

    const template = await db.documentoTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { clausulas: { orderBy: { ordem: "asc" } } },
    });

    return {
      success: true as const,
      data: { ...template, variaveis: parseVariaveisJson(template.variaveisJson) },
    };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

/**
 * Persiste um template (DocumentoTemplate + DocumentoClasula[]) em uma única
 * transação — helper reaproveitado tanto pela criação manual (CriarTemplateDocumento)
 * quanto pela criação via upload (CriarTemplateViaUpload).
 */
async function persistirNovoTemplate(
  input: CriarTemplateInput,
  criadoPorId: number,
  arquivoOrigem?: { url: string; nome: string },
) {
  return db.$transaction(async (tx) => {
    const criado = await tx.documentoTemplate.create({
      data: {
        titulo: input.titulo,
        descricao: input.descricao,
        categoria: input.categoria,
        variaveisJson: JSON.stringify(input.variaveis),
        criadoPorId,
        ...(arquivoOrigem
          ? { arquivoOrigemUrl: arquivoOrigem.url, arquivoOrigemNome: arquivoOrigem.nome }
          : {}),
      },
    });
    await tx.documentoClasula.createMany({
      data: input.clausulas.map((c, ordem) => ({
        templateId: criado.id,
        ordem,
        titulo: c.titulo,
        conteudo: c.conteudo,
        tipo: c.tipo,
        editavel: c.editavel,
      })),
    });
    return criado;
  });
}

export async function CriarTemplateDocumento(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = CriarTemplateSchema.parse(payload);

    const nomesVariaveis = new Set(input.variaveis.map((v) => v.nome));
    if (nomesVariaveis.size !== input.variaveis.length) {
      return { success: false as const, error: "Nomes de variáveis duplicados" };
    }

    const template = await persistirNovoTemplate(input, ctx.userId);

    revalidatePath(ROTA_BASE);
    return { success: true as const, templateId: template.id };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

/**
 * Cria um template a partir de um documento enviado por upload: extrai o
 * texto (Tika/pdf-parse/OCR, via extractTextFromBuffer), guarda o arquivo
 * original em Vercel Blob, e usa IA (Onyx) para identificar variáveis e
 * cláusulas automaticamente (RM-2026-93645F). Único campo de entrada real é
 * o arquivo — nada mais é obrigatório no cadastro.
 */
export async function CriarTemplateViaUpload(formData: FormData) {
  try {
    const { userId, role } = await getSessao();
    const ctx: ContextoGeradorDocumentos = await exigirAcessoModulo(userId, role);

    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File)) {
      return { success: false as const, error: "Envie um documento para criar o template" };
    }
    if (arquivo.size === 0) {
      return { success: false as const, error: "O arquivo enviado está vazio" };
    }
    if (arquivo.size > TAMANHO_MAXIMO_UPLOAD_TEMPLATE) {
      return { success: false as const, error: "O arquivo excede o limite de 10MB" };
    }
    if (!TIPOS_UPLOAD_TEMPLATE_SUPORTADOS.includes(arquivo.type)) {
      return {
        success: false as const,
        error: "Formato não suportado. Envie PDF, DOC, DOCX, ODT, RTF ou TXT.",
      };
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());

    const { text: textoExtraido, source } = await extractTextFromBuffer(buffer, arquivo.type, arquivo.name);
    if (source === "unsupported" || !textoExtraido.trim()) {
      return {
        success: false as const,
        error: "Não foi possível extrair texto deste documento. Verifique se ele não está vazio ou ilegível (ex: scan sem OCR).",
      };
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) throw new Error("Armazenamento de arquivos não configurado");
    const blob = await put(`gerador-documentos/templates-origem/${ctx.userId}/${Date.now()}_${arquivo.name}`, buffer, {
      access: "public",
      addRandomSuffix: true,
      token: blobToken,
    });

    const userToken = await getUserOnyxToken(ctx.userId);
    const identificacao = await identificarVariaveisEClasulasViaIA(textoExtraido, userToken);

    const input = CriarTemplateSchema.parse({
      titulo: arquivo.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Novo template",
      variaveis: identificacao.variaveis,
      clausulas: identificacao.clausulas.map((c) => ({ ...c, tipo: "TEXTO" as const, editavel: true })),
    });

    // HTML fiel (RM-2026-94CBF6): conversão best-effort — se falhar, não bloqueia a criação
    let htmlUrl: string | undefined;
    try {
      const html = await converterParaHtml(buffer, arquivo.type, arquivo.name);
      const blobTokenHtml = process.env.BLOB_READ_WRITE_TOKEN;
      if (blobTokenHtml) {
        const htmlBlob = await put(`gerador-documentos/templates-html/${ctx.userId}/${Date.now()}.html`, Buffer.from(html, "utf-8"), {
          access: "public",
          addRandomSuffix: true,
          token: blobTokenHtml,
          contentType: "text/html",
        });
        htmlUrl = htmlBlob.url;
      }
    } catch (htmlErr) {
      console.warn("[GeradorDocumentos] Falha na conversão para HTML (não bloqueante):", htmlErr);
    }

    const template = await persistirNovoTemplate(input, ctx.userId, { url: blob.url, nome: arquivo.name });

    // Salva htmlUrl via raw query (campo adicionado por migration aditiva — RM-2026-94CBF6)
    if (htmlUrl) {
      await db.$executeRaw`UPDATE "DocumentoTemplate" SET "htmlUrl" = ${htmlUrl} WHERE "id" = ${template.id}`;
    }

    revalidatePath(ROTA_BASE);
    return { success: true as const, templateId: template.id };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function AtualizarTemplateDocumento(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = AtualizarTemplateSchema.parse(payload);
    await exigirOwnershipTemplate(input.templateId, ctx);

    if (input.variaveis) {
      const nomesVariaveis = new Set(input.variaveis.map((v) => v.nome));
      if (nomesVariaveis.size !== input.variaveis.length) {
        return { success: false as const, error: "Nomes de variáveis duplicados" };
      }
    }

    await db.documentoTemplate.update({
      where: { id: input.templateId },
      data: {
        ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
        ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
        ...(input.variaveis !== undefined ? { variaveisJson: JSON.stringify(input.variaveis) } : {}),
      },
    });

    revalidatePath(ROTA_BASE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function ArquivarTemplateDocumento(templateId: string) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    await exigirOwnershipTemplate(templateId, ctx);

    await db.documentoTemplate.update({ where: { id: templateId }, data: { status: "ARQUIVADO" } });
    revalidatePath(ROTA_BASE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

// ─── Cláusulas de template ──────────────────────────────────────────────────

export async function CriarClasulaTemplate(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = CriarClasulaSchema.parse(payload);
    await exigirOwnershipTemplate(input.templateId, ctx);

    const total = await db.documentoClasula.count({ where: { templateId: input.templateId } });
    if (total >= 200) {
      return { success: false as const, error: "Limite de 200 cláusulas por template atingido" };
    }

    const clasula = await db.documentoClasula.create({
      data: {
        templateId: input.templateId,
        ordem: input.ordem,
        titulo: input.titulo,
        conteudo: input.conteudo,
        tipo: input.tipo,
        editavel: input.editavel,
      },
    });

    revalidatePath(`${ROTA_BASE}/${input.templateId}`);
    return { success: true as const, data: clasula };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function AtualizarClasulaTemplate(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = AtualizarClasulaSchema.parse(payload);

    const clasula = await db.documentoClasula.findUnique({
      where: { id: input.clasulaId },
      select: { templateId: true },
    });
    if (!clasula) return { success: false as const, error: "Cláusula não encontrada" };
    await exigirOwnershipTemplate(clasula.templateId, ctx);

    await db.documentoClasula.update({
      where: { id: input.clasulaId },
      data: {
        ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
        ...(input.conteudo !== undefined ? { conteudo: input.conteudo } : {}),
        ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
        ...(input.editavel !== undefined ? { editavel: input.editavel } : {}),
      },
    });

    revalidatePath(`${ROTA_BASE}/${clasula.templateId}`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function RemoverClasulaTemplate(clasulaId: string) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);

    const clasula = await db.documentoClasula.findUnique({
      where: { id: clasulaId },
      select: { templateId: true },
    });
    if (!clasula) return { success: false as const, error: "Cláusula não encontrada" };
    await exigirOwnershipTemplate(clasula.templateId, ctx);

    await db.documentoClasula.delete({ where: { id: clasulaId } });
    revalidatePath(`${ROTA_BASE}/${clasula.templateId}`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function ReordenarClasulasTemplate(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = ReordenarClasulasSchema.parse(payload);
    await exigirOwnershipTemplate(input.templateId, ctx);

    const clausulasExistentes = await db.documentoClasula.findMany({
      where: { templateId: input.templateId },
      select: { id: true },
    });
    const idsExistentes = new Set(clausulasExistentes.map((c) => c.id));
    if (input.ordem.length !== idsExistentes.size || !input.ordem.every((id) => idsExistentes.has(id))) {
      return { success: false as const, error: "Lista de ordenação não corresponde às cláusulas do template" };
    }

    // Offset temporário evita colidir com a constraint @@unique([templateId, ordem])
    // durante a reordenação (mesmo padrão de shift usado no Roadmap Alpha).
    await db.$transaction([
      ...input.ordem.map((id, i) =>
        db.documentoClasula.update({ where: { id }, data: { ordem: i + 1_000_000 } }),
      ),
      ...input.ordem.map((id, i) => db.documentoClasula.update({ where: { id }, data: { ordem: i } })),
    ]);

    revalidatePath(`${ROTA_BASE}/${input.templateId}`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

// ─── Geração de documento ───────────────────────────────────────────────────

export async function GerarDocumento(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = GerarDocumentoSchema.parse(payload);

    const template = await db.documentoTemplate.findUnique({
      where: { id: input.templateId },
      include: { clausulas: { orderBy: { ordem: "asc" } } },
    });
    if (!template) return { success: false as const, error: "Template não encontrado" };
    if (!ctx.isAdmin && template.criadoPorId !== ctx.userId) {
      return { success: false as const, error: "Não autorizado" };
    }
    if (template.status === "ARQUIVADO") {
      return { success: false as const, error: "Este template está arquivado" };
    }

    const variaveisTemplate = parseVariaveisJson(template.variaveisJson);
    const faltando = validarVariaveisObrigatorias(variaveisTemplate, input.variaveis);
    if (faltando.length > 0) {
      return { success: false as const, error: `Variáveis obrigatórias ausentes: ${faltando.join(", ")}` };
    }

    const tokenAcesso = randomUUID();
    const documento = await db.$transaction(async (tx) => {
      const criado = await tx.documentoGerado.create({
        data: {
          templateId: template.id,
          titulo: input.titulo,
          variaveisJson: JSON.stringify(input.variaveis),
          tokenAcesso,
          criadoPorId: ctx.userId,
          status: "CONFERENCIA",
          ...(input.clienteId !== undefined ? { clienteId: input.clienteId } : {}),
          ...(input.empresaContratadaId !== undefined ? { empresaContratadaId: input.empresaContratadaId } : {}),
        },
      });
      await tx.documentoClasulaGerada.createMany({
        data: template.clausulas.map((c) => ({
          documentoId: criado.id,
          ordem: c.ordem,
          titulo: c.titulo,
          conteudo: renderizarConteudo(c.conteudo, variaveisTemplate, input.variaveis),
          conteudoOriginal: c.conteudo,
        })),
      });
      return criado;
    });

    // Gera o PDF com qualificação das partes (se cliente/empresa foram fornecidos)
    let pdfUrl: string | undefined;
    try {
      const clausulasRenderizadas = template.clausulas.map((c) => ({
        titulo: c.titulo,
        conteudo: renderizarConteudo(c.conteudo, variaveisTemplate, input.variaveis),
      }));

      let partes: { contratante?: { razaoSocial: string; cnpj?: string | null; endereco?: string }; contratada?: { razaoSocial: string; cnpj?: string | null; endereco?: string; naturezaJuridica?: string | null; representanteLegal?: string } } | undefined;

      if (input.clienteId || input.empresaContratadaId) {
        partes = {};
        if (input.clienteId) {
          const cliente = await db.cliente.findUnique({
            where: { id: input.clienteId },
            select: { razaoSocial: true, cnpj: true, uf: true, municipio: true },
          });
          if (cliente) {
            partes.contratante = {
              razaoSocial: cliente.razaoSocial,
              cnpj: cliente.cnpj,
              endereco: [cliente.municipio, cliente.uf].filter(Boolean).join(", "),
            };
          }
        }
        if (input.empresaContratadaId) {
          const empresa = await db.empresaContratada.findUnique({
            where: { id: input.empresaContratadaId },
            select: {
              razaoSocial: true, cnpj: true, logradouro: true, numero: true,
              bairro: true, municipio: true, uf: true, cep: true,
              naturezaJuridica: true, representanteLegalNome: true,
            },
          });
          if (empresa) {
            partes.contratada = {
              razaoSocial: empresa.razaoSocial,
              cnpj: empresa.cnpj,
              endereco: [empresa.logradouro, empresa.numero, empresa.bairro, empresa.municipio, empresa.uf, empresa.cep ? `CEP ${empresa.cep}` : ""].filter(Boolean).join(", "),
              naturezaJuridica: empresa.naturezaJuridica,
              representanteLegal: empresa.representanteLegalNome,
            };
          }
        }
      }

      const bufferPdf = await gerarPdfDocumento({
        titulo: input.titulo,
        clausulas: clausulasRenderizadas,
        partes,
        numeroContrato: documento.id,
      });

      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      if (blobToken) {
        const blob = await put(`gerador-documentos/pdfs-gerados/${ctx.userId}/${documento.id}.pdf`, bufferPdf, {
          access: "public",
          addRandomSuffix: false,
          token: blobToken,
        });
        pdfUrl = blob.url;
        await db.documentoGerado.update({ where: { id: documento.id }, data: { pdfUrl } });
      }
    } catch {
      // PDF generation is best-effort at this stage; FinalizarDocumento can retry
    }

    // HTML renderizado com variáveis (RM-2026-94CBF6): best-effort, não bloqueia
    let htmlUrl: string | undefined;
    try {
      // htmlUrl não está no schema Prisma (migration aditiva pendente) — busca via raw query
      let templateHtmlUrl: string | null = null;
      try {
        const rows = await db.$queryRaw<Array<{ htmlUrl: string | null }>>`
          SELECT "htmlUrl" FROM "DocumentoTemplate" WHERE "id" = ${template.id}
        `;
        templateHtmlUrl = rows[0]?.htmlUrl ?? null;
      } catch {
        // coluna ainda não existe (migration não aplicada) — ignora
      }
      if (templateHtmlUrl) {
        const htmlRes = await fetch(templateHtmlUrl);
        if (htmlRes.ok) {
          const htmlOriginal = await htmlRes.text();
          const htmlRenderizado = renderHtmlComVariaveis(htmlOriginal, variaveisTemplate, input.variaveis);
          const blobTokenHtml = process.env.BLOB_READ_WRITE_TOKEN;
          if (blobTokenHtml) {
            const htmlBlob = await put(`gerador-documentos/documentos-html/${ctx.userId}/${documento.id}.html`, Buffer.from(htmlRenderizado, "utf-8"), {
              access: "public",
              addRandomSuffix: false,
              token: blobTokenHtml,
              contentType: "text/html",
            });
            htmlUrl = htmlBlob.url;
            await db.$executeRaw`UPDATE "DocumentoGerado" SET "htmlUrl" = ${htmlUrl} WHERE "id" = ${documento.id}`;

            // HTML→PDF (RM-2026-94CBF6 Fase 3): gera PDF mais fiel a partir do HTML
            // Se o PDF baseado em cláusulas já foi gerado acima, este substitui (mais fiel).
            // Se falhar, mantém o PDF anterior (best-effort).
            try {
              const bufferPdfHtml = await renderHtmlParaPdf(htmlRenderizado);
              const blobPdfHtml = await put(`gerador-documentos/documentos-pdf/${ctx.userId}/${documento.id}.pdf`, bufferPdfHtml, {
                access: "public",
                addRandomSuffix: false,
                token: blobTokenHtml,
              });
              pdfUrl = blobPdfHtml.url;
              await db.documentoGerado.update({ where: { id: documento.id }, data: { pdfUrl } });
            } catch (pdfHtmlErr) {
              console.warn("[GeradorDocumentos] Falha na renderização HTML→PDF (mantém PDF anterior):", pdfHtmlErr);
            }
          }
        }
      }
    } catch (htmlErr) {
      console.warn("[GeradorDocumentos] Falha na renderização HTML (não bloqueante):", htmlErr);
    }

    revalidatePath(ROTA_BASE);
    return {
      success: true as const,
      documentoId: documento.id,
      pdfUrl,
      htmlUrl,
      urlConferencia: `${ROTA_BASE}/conferencia/${documento.tokenAcesso}`,
    };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function ListarDocumentosGerados() {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);

    const where = ctx.isAdmin ? {} : { criadoPorId: userId };
    const documentos = await db.documentoGerado.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        titulo: true,
        status: true,
        tokenAcesso: true,
        pdfUrl: true,
        criadoEm: true,
        finalizadoEm: true,
        template: { select: { id: true, titulo: true } },
        criadoPor: { select: { id: true, nome: true } },
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      },
    });

    return { success: true as const, data: documentos };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error), data: [] };
  }
}

/** Busca de Cliente master (contratante) por razão social/nome fantasia/CNPJ — mesmo padrão de BuscarEmpresasBpm (src/actions/bpm/Cards.ts), mas sob o gate do módulo Gerador de Documentos. */
export async function BuscarClientesParaContratante(termo: string) {
  try {
    const { userId, role } = await getSessao();
    await exigirAcessoModulo(userId, role);

    const termoSeguro = termo.trim().slice(0, 120);
    if (termoSeguro.length < 2) return { success: true as const, data: [] };

    const clientes = await db.cliente.findMany({
      where: {
        OR: [
          { razaoSocial: { contains: termoSeguro } },
          { nomeFantasia: { contains: termoSeguro } },
          { cnpj: { contains: termoSeguro.replace(/\D/g, "") || termoSeguro } },
        ],
      },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, email: true, telefone: true },
      take: 20,
      orderBy: { razaoSocial: "asc" },
    });

    return { success: true as const, data: clientes };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error), data: [] };
  }
}

// ─── Conferência ─────────────────────────────────────────────────────────────

export async function ObterDocumentoConferencia(tokenAcesso: string) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);

    const documento = await db.documentoGerado.findUnique({
      where: { tokenAcesso },
      include: { clausulas: { orderBy: { ordem: "asc" } }, template: { select: { titulo: true } } },
    });
    if (!documento) return { success: false as const, error: "Documento não encontrado" };
    if (!ctx.isAdmin && documento.criadoPorId !== ctx.userId) {
      return { success: false as const, error: "Não autorizado" };
    }

    // htmlUrl (RM-2026-94CBF6): campo adicionado por migration aditiva — busca via raw query
    let htmlUrl: string | null = null;
    try {
      const rows = await db.$queryRaw<Array<{ htmlUrl: string | null }>>`
        SELECT "htmlUrl" FROM "DocumentoGerado" WHERE "id" = ${documento.id}
      `;
      htmlUrl = rows[0]?.htmlUrl ?? null;
    } catch {
      // coluna ainda não existe (migration não aplicada) — ignora
    }

    return { success: true as const, data: { ...documento, htmlUrl } };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function EditarClasulaGerada(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = EditarClasulaGeradaSchema.parse(payload);
    await exigirOwnershipDocumento(input.documentoId, ctx);

    await db.documentoClasulaGerada.updateMany({
      where: { id: input.clasulaId, documentoId: input.documentoId },
      data: { conteudo: input.conteudo },
    });

    revalidatePath(`${ROTA_BASE}/conferencia`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function ReescreverClasulaComIA(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = ReescreverClasulaSchema.parse(payload);
    const documento = await exigirOwnershipDocumento(input.documentoId, ctx);

    const [clasula, todasClausulas] = await Promise.all([
      db.documentoClasulaGerada.findUnique({ where: { id: input.clasulaId } }),
      db.documentoClasulaGerada.findMany({
        where: { documentoId: documento.id },
        orderBy: { ordem: "asc" },
        select: { titulo: true, conteudo: true },
      }),
    ]);
    if (!clasula || clasula.documentoId !== documento.id) {
      return { success: false as const, error: "Cláusula não encontrada" };
    }

    const contextoContrato = todasClausulas.map((c) => `${c.titulo}\n${c.conteudo}`).join("\n\n");
    const userToken = await getUserOnyxToken(ctx.userId);

    const novoTexto = await reescreverClasulaViaIA({
      contextoContrato,
      tituloClasula: clasula.titulo,
      textoAtual: clasula.conteudo,
      instrucao: input.instrucao,
      userToken,
    });

    await db.documentoClasulaGerada.update({
      where: { id: clasula.id },
      data: { conteudo: novoTexto, reescritoPorIA: true, instrucaoIA: input.instrucao },
    });

    revalidatePath(`${ROTA_BASE}/conferencia`);
    return { success: true as const, conteudo: novoTexto };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function FinalizarDocumento(documentoId: string) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    await exigirOwnershipDocumento(documentoId, ctx);

    const documento = await db.documentoGerado.findUnique({
      where: { id: documentoId },
      select: { titulo: true, clausulas: { orderBy: { ordem: "asc" }, select: { titulo: true, conteudo: true } } },
    });
    if (!documento) return { success: false as const, error: "Documento não encontrado" };

    // Gera o PDF ANTES de mudar o status — se a geração/upload falhar, a
    // finalização inteira falha (nunca fica FINALIZADO sem pdfUrl).
    const bufferPdf = await gerarPdfDocumento({ titulo: documento.titulo, clausulas: documento.clausulas });

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) throw new Error("Armazenamento de arquivos não configurado");
    const blob = await put(`gerador-documentos/pdfs-gerados/${ctx.userId}/${documentoId}.pdf`, bufferPdf, {
      access: "public",
      addRandomSuffix: false,
      token: blobToken,
    });

    await db.documentoGerado.update({
      where: { id: documentoId },
      data: { status: "FINALIZADO", finalizadoEm: new Date(), pdfUrl: blob.url },
    });

    revalidatePath(`${ROTA_BASE}/conferencia`);
    return { success: true as const, pdfUrl: blob.url };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}
