import { NextRequest, NextResponse } from "next/server";
import { getAgentTool } from "@/lib/onyx/agent-tools/registry";
import { executarTool, type UserCtx } from "@/lib/bibble/tool-executor";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Endpoint chamado pelos AGENTES (via Onyx) — não há sessão de usuário.
 * Autenticação por segredo compartilhado (header x-onyx-tool-secret).
 * Reaproveita o tool-executor do Bibble com um usuário de SERVIÇO.
 *
 * Env necessárias:
 *   ONYX_TOOL_SECRET     — segredo que o Onyx envia no header (obrigatório)
 *   ONYX_AGENT_USER_ID   — id do usuário de serviço p/ ações de escrita (chamado, ficha, arquivos)
 */
function checkSecret(req: NextRequest): boolean {
  const expected = process.env.ONYX_TOOL_SECRET;
  if (!expected) return false; // sem segredo configurado = bloqueado
  const got = req.headers.get("x-onyx-tool-secret") ?? "";
  // comparação simples de tamanho + igualdade
  return got.length === expected.length && got === expected;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const toolName = (await params).tool;
  const def = getAgentTool(toolName);
  if (!def) {
    return NextResponse.json({ error: `Ferramenta desconhecida: ${toolName}` }, { status: 404 });
  }

  // Todas as ações rodam sob um USUÁRIO DE SERVIÇO real — as permissões DELE
  // definem o teto do que qualquer agente pode fazer. Para limitar os agentes,
  // configure esse usuário com menos permissões (não use um admin).
  const serviceUserId = Number(process.env.ONYX_AGENT_USER_ID ?? "");
  if (!Number.isInteger(serviceUserId) || serviceUserId <= 0) {
    return NextResponse.json(
      { error: "ONYX_AGENT_USER_ID não configurado." },
      { status: 403 },
    );
  }

  const svc = await db.usuarios.findUnique({
    where: { id: serviceUserId },
    select: { nome: true, role: true, permissoes: true },
  });
  if (!svc) {
    return NextResponse.json({ error: "Usuário de serviço não encontrado." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Contexto com as permissões REAIS do usuário de serviço (sem forçar admin).
  const ctx: UserCtx = {
    userId: serviceUserId,
    userName: svc.nome ?? "Agente IA",
    role: svc.role ?? "User",
    permissoes: svc.permissoes?.split(",").map(p => p.trim()).filter(Boolean) ?? [],
  };

  try {
    const result = await executarTool(def.executorName, body, ctx);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[ONYX AGENT-TOOL]", toolName, (err as Error).message);
    return NextResponse.json({ error: "Falha ao executar a ferramenta." }, { status: 500 });
  }
}
