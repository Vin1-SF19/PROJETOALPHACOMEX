import db from "@/lib/prisma";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { AtorChecklist } from "./types";
import {
  atribuirSchema,
  criarAtendimentoSchema,
  patchEmpresaSchema,
  patchItemSchema,
  selecionarTipoSchema,
  documentoComandoSchema,
  observacaoDocumentoSchema,
} from "./schemas";
import {
  exigirLeituraChecklist,
  exigirAnalistaElegivel,
  exigirLiderChecklist,
  exigirEscritaChecklist,
  operacionalElegivel,
  liderOperacional,
  type Tx,
} from "./acesso";
import { executarAtendimento, replay, registrarEvento } from "./commands";
import { fail } from "./result";
import { obterEmpresa, documentoDTO } from "./leitura";
import { calcularProgressoItens } from "./items";
import { modelosAplicaveis } from "./catalogo";
export async function materializarTipo(
  tx: Tx,
  empresaId: string,
  tipo:
    | "RECEITA_BRUTA_DAS"
    | "RECEITA_BRUTA_CPRB"
    | "INICIO_RETOMADA"
    | "DISPONIBILIDADE_FINANCEIRA",
) {
  let checklist = await tx.checklist.findUnique({
    where: { empresaId_tipo: { empresaId, tipo } },
    include: { itens: { select: { status: true, obrigatorio: true } } },
  });
  if (!checklist) {
    const modelos = await modelosAplicaveis(tx, tipo);
    if (!modelos.length)
      fail("MODEL_EMPTY", "Este tipo ainda não possui modelos publicados.");
    checklist = await tx.checklist.create({
      data: {
        empresaId,
        tipo,
        modelosSnapshot: modelos.map((m) => ({
          id: m.id,
          versao: m.versao,
          codigo: m.codigo,
        })),
        itens: {
          create: modelos.map((m) => ({
            modeloRevisaoId: m.id,
            codigo: m.codigo,
            secao: m.secao,
            descricao: m.nome,
            complemento: m.descricao,
            obrigatorio: m.obrigatorio,
            ordem: m.ordem,
          })),
        },
      },
      include: { itens: { select: { status: true, obrigatorio: true } } },
    });
  }
  await tx.operacionalClientes.update({
    where: { id: empresaId },
    data: { tipo, progresso: calcularProgressoItens(checklist.itens) },
  });
  return checklist;
}
export async function selecionarTipo(ator: AtorChecklist, input: unknown) {
  const c = selecionarTipoSchema.parse(input);
  await executarAtendimento(
    ator,
    c,
    c,
    "CHECKLIST_TIPO_ALTERADO",
    async (tx, e) => {
      if (e.tipo === c.tipo) {
        const found = await tx.checklist.findUnique({
          where: { empresaId_tipo: { empresaId: e.id, tipo: c.tipo } },
          select: { id: true },
        });
        if (found) return { changed: false };
      }
      await materializarTipo(tx, e.id, c.tipo);
      return {
        changed: true,
        dados: { antes: { tipo: e.tipo }, depois: { tipo: c.tipo } },
      };
    },
  );
  return obterEmpresa(ator, c.empresaId);
}
export async function atualizarEmpresa(ator: AtorChecklist, input: unknown) {
  const c = patchEmpresaSchema.parse(input);
  await executarAtendimento(
    ator,
    c,
    c,
    "CHECKLIST_EMPRESA_ALTERADA",
    async (tx, e) => {
      const before = await tx.operacionalClientes.findUniqueOrThrow({
        where: { id: e.id },
        select: {
          status: true,
          embasamento: true,
          mesProtocolo: true,
          linkGrupo: true,
        },
      });
      const changed = Object.entries(c.patch).some(
        ([k, v]) => before[k as keyof typeof before] !== v,
      );
      if (!changed) return { changed: false };
      await tx.operacionalClientes.update({
        where: { id: e.id },
        data: c.patch,
      });
      return { changed: true, dados: { campos: Object.keys(c.patch) } };
    },
  );
  return obterEmpresa(ator, c.empresaId);
}
export async function atualizarItem(ator: AtorChecklist, input: unknown) {
  const c = patchItemSchema.parse(input);
  const item = await db.itemChecklist.findUnique({
    where: { id: c.itemId },
    select: { checklist: { select: { empresaId: true } } },
  });
  if (!item) fail("NOT_FOUND", "Item não encontrado.");
  const empresaId = item.checklist.empresaId;
  await executarAtendimento(
    ator,
    { ...c, empresaId },
    c,
    "CHECKLIST_ITEM_ALTERADO",
    async (tx, e) => {
      const atual = await tx.itemChecklist.findUniqueOrThrow({
        where: { id: c.itemId },
        include: { checklist: { select: { tipo: true } } },
      });
      if (atual.checklist.tipo !== e.tipo)
        fail("FORBIDDEN", "Checklist histórico é somente leitura.");
      const mudou = Object.entries(c.patch).some(
        ([k, v]) => atual[k as "status" | "observacao"] !== v,
      );
      if (!mudou) return { changed: false };
      await tx.itemChecklist.update({
        where: { id: atual.id },
        data: { ...c.patch, atualizadoEm: new Date() },
      });
      const itens = await tx.itemChecklist.findMany({
        where: { checklistId: atual.checklistId },
        select: { status: true, obrigatorio: true },
      });
      await tx.operacionalClientes.update({
        where: { id: e.id },
        data: { progresso: calcularProgressoItens(itens) },
      });
      return {
        changed: true,
        dados: {
          itemId: atual.id,
          antes: { status: atual.status },
          depois: { status: c.patch.status ?? atual.status },
          observacaoAlterada: "observacao" in c.patch,
        },
      };
    },
  );
  return obterEmpresa(ator, empresaId);
}
export async function atribuirAnalista(ator: AtorChecklist, input: unknown) {
  const c = atribuirSchema.parse(input);
  await executarAtendimento(
    ator,
    c,
    c,
    "CHECKLIST_OWNER_ALTERADO",
    async (tx, e) => {
      await exigirLiderChecklist(ator, tx);
      await exigirAnalistaElegivel(tx, c.analistaId);
      if (e.analistaId === c.analistaId) return { changed: false };
      await tx.operacionalClientes.update({
        where: { id: e.id },
        data: { analistaId: c.analistaId },
      });
      return {
        changed: true,
        dados: {
          antes: { analistaId: e.analistaId },
          depois: { analistaId: c.analistaId },
        },
      };
    },
  );
  return obterEmpresa(ator, c.empresaId);
}
export async function criarAtendimento(ator: AtorChecklist, input: unknown) {
  const c = criarAtendimentoSchema.parse(input);
  const senhaGerada = c.novaConta
    ? randomBytes(18).toString("base64url")
    : undefined;
  const senhaHash = senhaGerada ? await hash(senhaGerada, 12) : undefined;
  const result = await db.$transaction(
    async (tx) => {
      const user = await exigirLeituraChecklist(ator, tx);
      if (
        ator.kind !== "INTERNO" ||
        (!operacionalElegivel(user.role) && !liderOperacional(user.role))
      )
        fail("FORBIDDEN", "Sem permissão para criar atendimento.");
      const analistaId = liderOperacional(user.role) ? c.analistaId : ator.id;
      if (!analistaId) fail("VALIDATION", "Selecione o analista.");
      await exigirAnalistaElegivel(tx, analistaId);
      const prior = await replay(tx, ator, c.mutationId, c);
      if (prior) {
        const saved = prior.resultado as { empresaId?: string } | null;
        if (!saved?.empresaId) fail("CONFLICT", "Intenção inválida.");
        await exigirEscritaChecklist(tx, ator, saved.empresaId);
        return { empresaId: saved.empresaId, replayed: true };
      }
      if (
        !(await tx.cliente.findUnique({
          where: { id: c.clienteId },
          select: { id: true },
        }))
      )
        fail("NOT_FOUND", "Empresa não encontrada.");
      let contaId = c.clienteOperacionalId;
      if (c.novaConta) {
        const conta = await tx.clienteOperacional.create({
          data: {
            nome: c.novaConta.nome,
            email: c.novaConta.email,
            senha: "",
            senhaHash,
          },
        });
        contaId = conta.id;
      }
      if (
        !contaId ||
        !(await tx.clienteOperacional.findUnique({
          where: { id: contaId },
          select: { id: true },
        }))
      )
        fail("NOT_FOUND", "Conta de portal não encontrada.");
      if (c.clienteOperacionalId && !liderOperacional(user.role)) {
        const alheias = await tx.operacionalClientes.count({
          where: {
            clienteOperacionalId: contaId,
            OR: [{ analistaId: null }, { analistaId: { not: ator.id } }],
          },
        });
        const proprias = await tx.operacionalClientes.count({
          where: { clienteOperacionalId: contaId, analistaId: ator.id },
        });
        if (alheias || !proprias)
          fail(
            "FORBIDDEN",
            "Somente a liderança pode associar uma conta sem controle exclusivo comprovado.",
          );
      }
      const e = await tx.operacionalClientes.create({
        data: {
          clienteId: c.clienteId,
          clienteOperacionalId: contaId,
          analistaId,
          embasamento: "",
          revision: 1,
        },
      });
      if (c.tipo) await materializarTipo(tx, e.id, c.tipo);
      await registrarEvento(tx, ator, {
        mutationId: c.mutationId,
        payload: c,
        agregadoTipo: "ATENDIMENTO",
        agregadoId: e.id,
        revision: 1,
        tipo: "CHECKLIST_ATENDIMENTO_CRIADO",
        empresaId: e.id,
        dados: { clienteId: c.clienteId, analistaId },
        resultado: { empresaId: e.id },
      });
      return { empresaId: e.id, replayed: false };
    },
    { timeout: 20000 },
  );
  return {
    atendimento: await obterEmpresa(ator, result.empresaId),
    ...(senhaGerada && !result.replayed
      ? { credencialInicial: senhaGerada }
      : {}),
    replayed: result.replayed,
  };
}
export async function alterarDocumento(
  ator: AtorChecklist,
  input: unknown,
  operation: "EXCLUIR" | "RESTAURAR" | "OBSERVACAO",
) {
  const c =
    operation === "OBSERVACAO"
      ? observacaoDocumentoSchema.parse(input)
      : documentoComandoSchema.parse(input);
  const doc = await db.documentoChecklist.findUnique({
    where: { id: c.documentoId },
    include: {
      item: { select: { checklist: { select: { empresaId: true } } } },
    },
  });
  if (!doc) fail("NOT_FOUND", "Documento não encontrado.");
  const empresaId = doc.item.checklist.empresaId;
  await executarAtendimento(
    ator,
    { ...c, empresaId },
    { ...c, operation },
    `CHECKLIST_DOCUMENTO_${operation}`,
    async (tx, e) => {
      const d = await tx.documentoChecklist.findUniqueOrThrow({
        where: { id: c.documentoId },
        include: {
          item: { select: { checklist: { select: { tipo: true } } } },
        },
      });
      if (d.item.checklist.tipo !== e.tipo)
        fail("FORBIDDEN", "Checklist histórico é somente leitura.");
      if (
        ator.kind === "PORTAL" &&
        (operation === "RESTAURAR" || d.uploadedByContaId !== ator.id)
      )
        fail("FORBIDDEN", "Sem permissão para alterar este documento.");
      if (operation === "EXCLUIR") {
        if (d.deletadoEm) return { changed: false };
        await tx.documentoChecklist.update({
          where: { id: d.id },
          data: {
            deletadoEm: new Date(),
            deletadoPorCliente: ator.kind === "PORTAL",
            deletadoPorUsuarioId: ator.kind === "INTERNO" ? ator.id : null,
            deletadoPorContaId: ator.kind === "PORTAL" ? ator.id : null,
          },
        });
      } else if (operation === "RESTAURAR") {
        if (!d.deletadoEm) return { changed: false };
        const { abrirDocumento } = await import("./documentos");
        const body = await abrirDocumento(ator, d.id);
        await body.body.cancel();
        await tx.documentoChecklist.update({
          where: { id: d.id },
          data: {
            deletadoEm: null,
            deletadoPorCliente: false,
            deletadoPorUsuarioId: null,
            deletadoPorContaId: null,
          },
        });
      } else {
        if (d.deletadoEm)
          fail("FORBIDDEN", "Documento removido é somente leitura.");
        const observacao = observacaoDocumentoSchema.parse(input).observacao;
        if (d.observacao === observacao) return { changed: false };
        await tx.documentoChecklist.update({
          where: { id: d.id },
          data: { observacao },
        });
      }
      return {
        changed: true,
        dados: {
          documentoId: d.id,
          antes: { removido: Boolean(d.deletadoEm) },
          depois: { removido: operation === "EXCLUIR" },
        },
      };
    },
    ator.kind === "PORTAL",
  );
  return documentoDTO(
    await db.documentoChecklist.findUniqueOrThrow({ where: { id: doc.id } }),
  );
}
