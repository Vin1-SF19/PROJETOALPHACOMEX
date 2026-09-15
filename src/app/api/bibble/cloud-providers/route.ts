import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { isAdminRole } from "@/lib/roles";

export const runtime = "nodejs";

interface CloudProviderPublic {
  id: string;
  provider: "openai" | "google" | "anthropic";
  modelId: string;
  label: string;
  enabled: boolean;
}

function configuredProviders(): CloudProviderPublic[] {
  return [
    ['openai', 'OPENAI_API_KEY'], ['google', 'GOOGLE_AI_API_KEY'], ['anthropic', 'ANTHROPIC_API_KEY'],
  ].filter(([, env]) => Boolean(process.env[env])).map(([provider]) => ({
    id: `env:${provider}`, provider: provider as CloudProviderPublic['provider'],
    modelId: 'configurado-por-ambiente', label: `${provider} (server-side)`, enabled: true,
  }));
}

// GET — público (sem API keys)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(configuredProviders());
}

// POST — admin only
export async function POST() {
  const session = await auth();
  const userTyped = session?.user as { role?: string } | undefined;
  if (!session?.user || !isAdminRole(userTyped?.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  return NextResponse.json({ error: "Chaves devem ser configuradas exclusivamente por variáveis de ambiente no servidor." }, { status: 410 });
}

// DELETE — admin only
export async function DELETE() {
  const session = await auth();
  const userTyped = session?.user as { role?: string } | undefined;
  if (!session?.user || !isAdminRole(userTyped?.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  return NextResponse.json({ error: "Providers server-side são gerenciados por variáveis de ambiente." }, { status: 410 });
}
