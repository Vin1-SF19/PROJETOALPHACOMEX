import "server-only";

import { randomUUID } from "node:crypto";

import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

import type { ResumoMesclagem } from "./tipos";
import { armazenarArquivosMesclagem, baixarArquivoMesclagem, excluirArquivosMesclagem } from "./storage";

export type TipoArquivoHistoricoMesclagem = "principal" | "complementar" | "resultado";

function nomeSeguro(nome: string, fallback: string): string {
  const limpo = nome.replace(/[\r\n\0]/g, "").trim();
  return (limpo || fallback).slice(0, 255);
}

async function usuarioEhAdmin(userId: number): Promise<boolean> {
  const usuario = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
  return isAdminRole(usuario?.role);
}

export async function listarHistoricoMesclagem(userId: number) {
  const admin = await usuarioEhAdmin(userId);
  return db.mesclagemHistorico.findMany({
    where: admin ? undefined : { criadoPorId: userId },
    orderBy: { criadoEm: "desc" },
    take: 50,
    select: {
      id: true,
      criadoEm: true,
      principalNome: true,
      complementarNome: true,
      resultadoNome: true,
      empresasProcessadas: true,
      empresasComCorrespondencia: true,
      empresasSemCorrespondencia: true,
      linhasResultado: true,
      criadoPor: { select: { nome: true } },
    },
  });
}

export async function obterHistoricoMesclagem(userId: number, id: string) {
  const registro = await db.mesclagemHistorico.findUnique({
    where: { id },
    include: { criadoPor: { select: { nome: true } } },
  });
  if (!registro) return null;
  if (registro.criadoPorId !== userId && !await usuarioEhAdmin(userId)) return null;
  return registro;
}

export async function registrarHistoricoMesclagem(params: {
  userId: number;
  principal: File;
  complementar: File;
  resultado: Buffer;
  resumo: ResumoMesclagem;
  resultadoNome: string;
}) {
  const id = randomUUID();
  const principalNome = nomeSeguro(params.principal.name, "principal.xlsx");
  const complementarNome = nomeSeguro(params.complementar.name, "complementar.xlsx");
  const resultadoNome = nomeSeguro(params.resultadoNome, "resultado.xlsx");
  const chaves = await armazenarArquivosMesclagem({
    historicoId: id,
    userId: params.userId,
    arquivos: [
      { tipo: "principal", nome: principalNome, conteudo: params.principal, tamanho: params.principal.size, contentType: params.principal.type },
      { tipo: "complementar", nome: complementarNome, conteudo: params.complementar, tamanho: params.complementar.size, contentType: params.complementar.type },
      { tipo: "resultado", nome: resultadoNome, conteudo: params.resultado, tamanho: params.resultado.byteLength, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    ],
  });
  try {
    return await db.mesclagemHistorico.create({
      data: {
        id,
        criadoPorId: params.userId,
        principalNome,
        principalStorageKey: chaves.principal,
        principalTamanhoBytes: params.principal.size,
        complementarNome,
        complementarStorageKey: chaves.complementar,
        complementarTamanhoBytes: params.complementar.size,
        resultadoNome,
        resultadoStorageKey: chaves.resultado,
        resultadoTamanhoBytes: params.resultado.byteLength,
        empresasProcessadas: params.resumo.comMatch + params.resumo.semMatch,
        empresasComCorrespondencia: params.resumo.comMatch,
        empresasSemCorrespondencia: params.resumo.semMatch,
        linhasResultado: params.resumo.totalLinhas,
      },
    });
  } catch (error) {
    await excluirArquivosMesclagem(Object.values(chaves)).catch(() => undefined);
    throw error;
  }
}

export async function obterArquivoHistoricoMesclagem(userId: number, id: string, tipo: TipoArquivoHistoricoMesclagem) {
  const registro = await obterHistoricoMesclagem(userId, id);
  if (!registro) return null;
  const arquivo = tipo === "principal"
    ? { nome: registro.principalNome, tamanho: registro.principalTamanhoBytes, storageKey: registro.principalStorageKey }
    : tipo === "complementar"
      ? { nome: registro.complementarNome, tamanho: registro.complementarTamanhoBytes, storageKey: registro.complementarStorageKey }
      : { nome: registro.resultadoNome, tamanho: registro.resultadoTamanhoBytes, storageKey: registro.resultadoStorageKey };
  return { ...arquivo, conteudo: await baixarArquivoMesclagem(arquivo.storageKey) };
}
