import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { listAgents, createAgent, getImageGenToolId, OnyxError, type CreateAgentInput } from "@/lib/onyx/client";
import { isAdminRole, recordAgentOwner, getOwnerInfoMap } from "@/lib/onyx/ownership";

/** Remove a skill de geração de imagem dos tool_ids quando o usuário não é admin. */
async function sanitizeToolIds(toolIds: number[], role: string): Promise<number[]> {
  if (isAdminRole(role)) return toolIds;
  const imgId = await getImageGenToolId();
  return imgId === null ? toolIds : toolIds.filter(id => id !== imgId);
}

export const dynamic = "force-dynamic";

// GET /api/onyx/agents — lista agentes visíveis ao usuário, com info do criador.
// Regra: vê os PRÓPRIOS (público ou privado) + os PÚBLICOS de outros. Admin vê todos.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = Number(session.user.id);
  const role = (session.user as { role?: string }).role ?? "";
  const admin = isAdminRole(role);

  try {
    const all = await listAgents();
    const ownerMap = await getOwnerInfoMap();

    const agents = all
      .filter(a => {
        if (admin) return true;
        const o = ownerMap.get(a.id);
        return !!o && (o.userId === userId || o.isPublic);
      })
      .map(a => {
        const o = ownerMap.get(a.id);
        return {
          ...a,
          createdByName: o?.userName ?? null,
          isPublic: o?.isPublic ?? false,
          ownedByMe: o?.userId === userId,
        };
      });

    return NextResponse.json({ agents });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

// POST /api/onyx/agents — cria um novo agente
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = Number(session.user.id);
  const role = (session.user as { role?: string }).role ?? "";

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

  try {
    const toolIds = await sanitizeToolIds(Array.isArray(body.tool_ids) ? body.tool_ids : [], role);
    const agent = await createAgent({
      name,
      description,
      system_prompt: systemPrompt,
      task_prompt: body.task_prompt,
      tool_ids: toolIds,
      is_public: body.is_public ?? false,
      starter_messages: body.starter_messages,
      icon_name: body.icon_name ?? null,
      uploaded_image_id: body.uploaded_image_id ?? null,
    });
    // Vincula o agente ao usuário do Painel que o criou, com a visibilidade escolhida
    await recordAgentOwner(agent.id, userId, agent.name, body.is_public ?? false).catch(() => {});
    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
