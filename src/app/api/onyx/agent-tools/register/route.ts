import { NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { createCustomTool, OnyxError } from "@/lib/onyx/client";
import { isAdminRole } from "@/lib/onyx/ownership";
import { AGENT_TOOLS } from "@/lib/onyx/agent-tools/registry";

export const dynamic = "force-dynamic";

const OPTIONAL_PARAMS = new Set(["status", "recursivo"]);

function buildSchema(title: string, baseUrl: string, toolNames: string[]): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const name of toolNames) {
    const def = AGENT_TOOLS[name];
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [p, desc] of Object.entries(def.params)) {
      properties[p] = { type: "string", description: desc };
      if (!OPTIONAL_PARAMS.has(p)) required.push(p);
    }
    paths[`/api/onyx/agent-tools/${name}`] = {
      post: {
        summary: def.description,
        operationId: name,
        requestBody: {
          required: required.length > 0,
          content: {
            "application/json": {
              schema: { type: "object", properties, required },
            },
          },
        },
        responses: {
          "200": {
            description: "Resultado da ação",
            content: {
              "application/json": {
                schema: { type: "object", properties: { result: { type: "string" } } },
              },
            },
          },
        },
      },
    };
  }
  return {
    openapi: "3.0.0",
    info: { title, version: "1.0.0", description: title },
    servers: [{ url: baseUrl }],
    paths,
  };
}

// POST /api/onyx/agent-tools/register — (admin) registra as skills do PainelAlpha no Onyx.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (!isAdminRole(role)) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  const baseUrl = (process.env.PAINELALPHA_PUBLIC_URL ?? "").replace(/\/+$/, "");
  const secret = process.env.ONYX_TOOL_SECRET ?? "";
  if (!baseUrl || /localhost|127\.0\.0\.1/.test(baseUrl)) {
    return NextResponse.json(
      { error: "Configure PAINELALPHA_PUBLIC_URL com uma URL alcançável pelo servidor Onyx (não pode ser localhost)." },
      { status: 400 },
    );
  }
  if (!secret) {
    return NextResponse.json({ error: "Configure ONYX_TOOL_SECRET." }, { status: 400 });
  }

  const headers = [{ key: "x-onyx-tool-secret", value: secret }];
  const dataTools = Object.keys(AGENT_TOOLS).filter(n => !AGENT_TOOLS[n].fs);
  const fileTools = Object.keys(AGENT_TOOLS).filter(n => AGENT_TOOLS[n].fs);

  try {
    const created: Array<{ skill: string; toolId: number }> = [];

    const dados = await createCustomTool({
      definition: buildSchema("PainelAlpha — Dados", baseUrl, dataTools),
      custom_headers: headers,
      passthrough_auth: false,
    });
    created.push({ skill: "PainelAlpha — Dados", toolId: dados.id });

    const arquivos = await createCustomTool({
      definition: buildSchema("PainelAlpha — Arquivos (acesso ao computador)", baseUrl, fileTools),
      custom_headers: headers,
      passthrough_auth: false,
    });
    created.push({ skill: "PainelAlpha — Arquivos (acesso ao computador)", toolId: arquivos.id });

    return NextResponse.json({ success: true, created });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
