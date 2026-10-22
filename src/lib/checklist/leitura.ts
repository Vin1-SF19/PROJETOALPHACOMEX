import { documentoDTO } from "./dto";
export { documentoDTO } from "./dto";
import { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { filtroEmpresasSchema, idSchema, paginaSchema } from "./schemas";
import {
  exigirLeituraChecklist,
  exigirEmpresaChecklist,
  obterCapacidadesChecklist,
  capacidadesParaAtor,
  operacionalElegivel,
  liderOperacional,
  type Tx,
} from "./acesso";
import { resumirChecklist, resolverChecklistAtivo } from "./items";
import type { AtorChecklist } from "./types";
import { fail } from "./result";
export const resumoInclude =
  Prisma.validator<Prisma.OperacionalClientesInclude>()({
    cliente: {
      select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true },
    },
    analista: {
      select: { id: true, nome: true, imagemUrl: true, status: true },
    },
  });
export async function listarEmpresas(
  ator: AtorChecklist,
  input: unknown = {},
  tx: Tx = db,
) {
  const user = await exigirLeituraChecklist(ator, tx);
  const f = filtroEmpresasSchema.parse(input);
  const where: Prisma.OperacionalClientesWhereInput = {
    ...(ator.kind === "PORTAL" ? { clienteOperacionalId: ator.id } : {}),
    ...(f.analistaId ? { analistaId: f.analistaId } : {}),
    ...(f.semAnalista ? { analistaId: null } : {}),
    ...(f.clienteId ? { clienteId: f.clienteId } : {}),
    ...(f.tipo ? { tipo: f.tipo } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.busca
      ? {
          cliente: {
            OR: [
              { razaoSocial: { contains: f.busca } },
              { nomeFantasia: { contains: f.busca } },
              { cnpj: { contains: f.busca } },
            ],
          },
        }
      : {}),
  };
  const [rows, totalCount] = await Promise.all([
    tx.operacionalClientes.findMany({
      where,
      include: resumoInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
    tx.operacionalClientes.count({ where }),
  ]);
  const pairs = rows.flatMap((e) =>
    e.tipo ? [{ empresaId: e.id, tipo: e.tipo }] : [],
  );
  const active = pairs.length
    ? await tx.checklist.findMany({
        where: { OR: pairs },
        select: {
          id: true,
          empresaId: true,
          tipo: true,
          itens: { select: { status: true, obrigatorio: true } },
        },
      })
    : [];
  return {
    items: rows.map((e) => {
      const ativo = active.find(
        (c) => c.empresaId === e.id && c.tipo === e.tipo,
      );
      return {
        id: e.id,
        clienteId: e.clienteId,
        razaoSocial: e.cliente.razaoSocial,
        cnpj: e.cliente.cnpj,
        nomeFantasia: e.cliente.nomeFantasia,
        status: e.status,
        embasamento: e.embasamento,
        mesProtocolo: e.mesProtocolo,
        linkGrupo: e.linkGrupo,
        analista: e.analista,
        tipoAtivo: e.tipo,
        checklistAtivoId: ativo?.id ?? null,
        resumo: resumirChecklist(ativo?.itens ?? null),
        revision: e.revision,
        capabilities: capacidadesParaAtor(ator, user.role, e),
      };
    }),
    totalCount,
    page: f.page,
    pageSize: f.pageSize,
  };
}

export async function listarAnalistas(ator: AtorChecklist, tx: Tx = db) {
  if (ator.kind !== "INTERNO") fail("FORBIDDEN", "Sem acesso.");
  await exigirLeituraChecklist(ator, tx);
  const [users, counts] = await Promise.all([
    tx.usuarios.findMany({
      select: {
        id: true,
        nome: true,
        imagemUrl: true,
        role: true,
        status: true,
      },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
    }),
    tx.operacionalClientes.groupBy({
      by: ["analistaId"],
      _count: { id: true },
    }),
  ]);
  const map = new Map(counts.map((c) => [c.analistaId, c._count.id]));
  return users
    .filter(
      (u) =>
        map.has(u.id) || (u.status === "ATIVO" && operacionalElegivel(u.role)),
    )
    .filter((u) => !liderOperacional(u.role) || map.has(u.id))
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      imagemUrl: u.imagemUrl,
      ativo: u.status === "ATIVO",
      legado: !(
        u.status === "ATIVO" &&
        (operacionalElegivel(u.role) || liderOperacional(u.role))
      ),
      totalEmpresas: map.get(u.id) ?? 0,
    }));
}
export async function obterEmpresa(
  ator: AtorChecklist,
  id: string,
  options: { checklistId?: string } = {},
  tx: Tx = db,
) {
  idSchema.parse(id);
  await exigirEmpresaChecklist(tx, ator, id);
  const e = await tx.operacionalClientes.findUniqueOrThrow({
    where: { id },
    include: {
      cliente: true,
      analista: {
        select: { id: true, nome: true, imagemUrl: true, status: true },
      },
      clienteOperacional: { select: { id: true, nome: true, email: true } },
      checklists: {
        select: { id: true, tipo: true, criadoEm: true, atualizadoEm: true },
      },
    },
  });
  const ativo = resolverChecklistAtivo(e.tipo, e.checklists);
  const escolhido = options.checklistId
    ? e.checklists.find((c) => c.id === options.checklistId)
    : ativo;
  if (options.checklistId && !escolhido)
    fail("NOT_FOUND", "Checklist não encontrado.");
  const historical = Boolean(escolhido && escolhido.id !== ativo?.id);
  const itens = escolhido
    ? await tx.itemChecklist.findMany({
        where: { checklistId: escolhido.id },
        orderBy: [
          { secao: "asc" },
          { ordem: "asc" },
          { codigo: "asc" },
          { id: "asc" },
        ],
        select: {
          id: true,
          codigo: true,
          secao: true,
          descricao: true,
          complemento: true,
          status: true,
          observacao: true,
          obrigatorio: true,
          ordem: true,
          atualizadoEm: true,
          _count: { select: { documentos: true } },
        },
      })
    : [];
  const capabilities = await obterCapacidadesChecklist(ator, e, tx);
  return {
    id: e.id,
    clienteId: e.clienteId,
    cliente: {
      id: e.cliente.id,
      razaoSocial: e.cliente.razaoSocial,
      nomeFantasia: e.cliente.nomeFantasia,
      cnpj: e.cliente.cnpj,
      regimeTributario: e.cliente.regimeTributario,
    },
    contaPortal: ator.kind === "INTERNO" ? e.clienteOperacional : undefined,
    analista: e.analista,
    tipoAtivo: e.tipo,
    status: e.status,
    embasamento: e.embasamento,
    mesProtocolo: e.mesProtocolo,
    linkGrupo: e.linkGrupo,
    revision: e.revision,
    checklistAtivoId: ativo?.id ?? null,
    checklist: escolhido ? { ...escolhido, itens } : null,
    checklists: e.checklists,
    historical,
    resumo: resumirChecklist(escolhido ? itens : null),
    capabilities: historical
      ? {
          ...capabilities,
          canEdit: false,
          canManagePortalAccess: false,
          canLinkCrm: false,
        }
      : capabilities,
  };
}
export async function listarDocumentos(
  ator: AtorChecklist,
  input: {
    empresaId: string;
    itemId?: string;
    checklistId?: string;
    excluidos?: boolean;
    page?: number;
    pageSize?: number;
  },
  tx: Tx = db,
) {
  const p = paginaSchema.parse({
    page: input.page,
    pageSize: input.pageSize ?? 50,
  });
  await exigirEmpresaChecklist(tx, ator, idSchema.parse(input.empresaId));
  const where: Prisma.DocumentoChecklistWhereInput = {
    item: {
      ...(input.itemId ? { id: idSchema.parse(input.itemId) } : {}),
      checklist: {
        empresaId: input.empresaId,
        ...(input.checklistId ? { id: idSchema.parse(input.checklistId) } : {}),
      },
    },
    deletadoEm: input.excluidos ? { not: null } : null,
  };
  const [docs, totalCount] = await Promise.all([
    tx.documentoChecklist.findMany({
      where,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
    }),
    tx.documentoChecklist.count({ where }),
  ]);
  return { items: docs.map(documentoDTO), totalCount, ...p };
}
export async function historicoEventos(
  ator: AtorChecklist,
  input: { empresaId: string; page?: number; pageSize?: number },
  tx: Tx = db,
) {
  await exigirEmpresaChecklist(tx, ator, idSchema.parse(input.empresaId));
  const p = paginaSchema.parse(input);
  const where = { empresaId: input.empresaId };
  const [items, totalCount] = await Promise.all([
    tx.checklistEvento.findMany({
      where,
      select: {
        id: true,
        tipo: true,
        revision: true,
        atorTipo: true,
        atorUsuarioId: true,
        atorContaId: true,
        dados: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
    }),
    tx.checklistEvento.count({ where }),
  ]);
  return { items, totalCount, ...p };
}

export async function historicoDocumentos(
  ator: AtorChecklist,
  input: unknown = {},
  tx: Tx = db,
) {
  await exigirLeituraChecklist(ator, tx);
  const c = paginaSchema
    .extend({ empresaId: idSchema.optional() })
    .parse(input);
  const where: Prisma.DocumentoChecklistWhereInput = {
    deletadoEm: { not: null },
    item: {
      checklist: {
        ...(c.empresaId ? { empresaId: c.empresaId } : {}),
        empresa:
          ator.kind === "PORTAL" ? { clienteOperacionalId: ator.id } : {},
      },
    },
  };
  const [rows, totalCount] = await Promise.all([
    tx.documentoChecklist.findMany({
      where,
      include: {
        item: {
          select: {
            id: true,
            codigo: true,
            descricao: true,
            checklist: {
              select: {
                id: true,
                tipo: true,
                empresa: {
                  select: {
                    id: true,
                    cliente: { select: { razaoSocial: true, cnpj: true } },
                    analista: { select: { id: true, nome: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ deletadoEm: "desc" }, { id: "desc" }],
      skip: (c.page - 1) * c.pageSize,
      take: c.pageSize,
    }),
    tx.documentoChecklist.count({ where }),
  ]);
  return {
    items: rows.map((d) => ({
      ...documentoDTO(d),
      itemId: d.item.id,
      itemCodigo: d.item.codigo,
      itemDescricao: d.item.descricao,
      checklistId: d.item.checklist.id,
      tipo: d.item.checklist.tipo,
      empresaId: d.item.checklist.empresa.id,
      razaoSocial: d.item.checklist.empresa.cliente.razaoSocial,
      cnpj: d.item.checklist.empresa.cliente.cnpj,
      analista: d.item.checklist.empresa.analista,
    })),
    totalCount,
    page: c.page,
    pageSize: c.pageSize,
  };
}
