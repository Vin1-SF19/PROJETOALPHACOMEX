import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { getAgent, updateAgent, deleteAgent, getImageGenToolId, OnyxError, type CreateAgentInput } from "@/lib/onyx/client";
import { isAdminRole, userOwnsAgent, removeAgentOwner, recordAgentOwner } from "@/lib/onyx/ownership";
import { getUserOnyxToken } from "@/lib/onyx/user-token";

/** Remove a skill de geração de imagem dos tool_ids quando o usuário não é admin. */
async function sanitizeToolIds(
  toolIds: number[],
  role: string,
  userToken?: string | null,
): Promise<number[]> {
  if (isAdminRole(role)) return toolIds;
  const imgId = await getImageGenToolId(userToken);
  return imgId === null ? toolIds : toolIds.filter(id => id !== imgId);
}

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Retorna null se autorizado; senão uma Response de erro 403. */
async function ensureCanManage(
  userId: number,
  role: string,
  agentId: number,
): Promise<NextResponse | null> {
  if (isAdminRole(role)) return null;
  const owns = await userOwnsAgent(agentId, userId);
  if (!owns) {
    return NextResponse.json({ error: "Você não tem permissão sobre este agente." }, { status: 403 });
  }
  return null;
}

// GET /api/onyx/agents/[id] — detalhe de um agente
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const userToken = await getUserOnyxToken(session.user.id);
    const agent = await getAgent(id, userToken);
    return NextResponse.json({ agent });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

// PATCH /api/onyx/agents/[id] — atualiza um agente
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const denied = await ensureCanManage(
    Number(session.user.id),
    (session.user as { role?: string }).role ?? "",
    id,
  );
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as Partial<CreateAgentInput>;
  const name = body.name?.trim();
  const description = body.description?.trim();
  const systemPrompt = body.system_prompt?.trim();

  if (!name || !description || !systemPrompt) {
    return NextResponse.json(
      { error: "Campos obrigatórios: name, description, system_prompt." },
      { status: 400 },
    );
  }

  const isPublic = body.is_public ?? false;
  const role = (session.user as { role?: string }).role ?? "";

  try {
    const userToken = await getUserOnyxToken(session.user.id);
    const toolIds = await sanitizeToolIds(
      Array.isArray(body.tool_ids) ? body.tool_ids : [],
      role,
      userToken,
    );
    const agent = await updateAgent(id, {
      name,
      description,
      system_prompt: systemPrompt,
      task_prompt: body.task_prompt,
      tool_ids: toolIds,
      is_public: isPublic,
      starter_messages: body.starter_messages,
      icon_name: body.icon_name ?? null,
      uploaded_image_id: body.uploaded_image_id ?? null,
      remove_image: body.remove_image ?? false,
    }, userToken);
    // Sincroniza nome e visibilidade no vínculo (não altera o dono original)
    await recordAgentOwner(id, Number(session.user.id), agent.name, isPublic).catch(() => {});
    return NextResponse.json({ agent });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

// DELETE /api/onyx/agents/[id] — remove um agente
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const denied = await ensureCanManage(
    Number(session.user.id),
    (session.user as { role?: string }).role ?? "",
    id,
  );
  if (denied) return denied;

  try {
    const userToken = await getUserOnyxToken(session.user.id);
    await deleteAgent(id, userToken);
    await removeAgentOwner(id).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
