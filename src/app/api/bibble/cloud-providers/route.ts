import { NextResponse, type NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { auth } from "../../../../../auth";
import { isAdminRole } from "@/lib/roles";

export const runtime = "nodejs";

const FILE_PATH = path.join(process.cwd(), ".bibble", "cloud-providers.json");

interface CloudProvider {
  id: string;
  provider: "openai" | "google" | "anthropic";
  modelId: string;
  label: string;
  apiKey: string;
  enabled: boolean;
  createdAt: string;
}

interface CloudProviderPublic {
  id: string;
  provider: "openai" | "google" | "anthropic";
  modelId: string;
  label: string;
  enabled: boolean;
}

async function readProviders(): Promise<CloudProvider[]> {
  try {
    const content = await readFile(FILE_PATH, "utf-8");
    return JSON.parse(content) as CloudProvider[];
  } catch {
    return [];
  }
}

async function saveProviders(providers: CloudProvider[]): Promise<void> {
  await mkdir(path.dirname(FILE_PATH), { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(providers, null, 2), "utf-8");
}

// GET — público (sem API keys)
export async function GET() {
  const providers = await readProviders();
  const result: CloudProviderPublic[] = providers
    .filter((p) => p.enabled)
    .map(({ id, provider, modelId, label, enabled }) => ({ id, provider, modelId, label, enabled }));
  return NextResponse.json(result);
}

// POST — admin only
export async function POST(req: NextRequest) {
  const session = await auth();
  const userTyped = session?.user as { role?: string } | undefined;
  if (!session?.user || !isAdminRole(userTyped?.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    provider?: string;
    modelId?: string;
    label?: string;
    apiKey?: string;
  };

  if (!body.provider || !body.modelId?.trim() || !body.apiKey?.trim()) {
    return NextResponse.json(
      { error: "Campos obrigatórios: provider, modelId, apiKey" },
      { status: 400 },
    );
  }

  const providers = await readProviders();
  const newEntry: CloudProvider = {
    id: randomUUID(),
    provider: body.provider as "openai" | "google" | "anthropic",
    modelId: body.modelId.trim(),
    label: (body.label?.trim() || body.modelId.trim()),
    apiKey: body.apiKey.trim(),
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  providers.push(newEntry);
  await saveProviders(providers);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey: _unused, ...pub } = newEntry;
  return NextResponse.json(pub, { status: 201 });
}

// DELETE — admin only
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const userTyped = session?.user as { role?: string } | undefined;
  if (!session?.user || !isAdminRole(userTyped?.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }

  const providers = await readProviders();
  const filtered = providers.filter((p) => p.id !== id);
  if (filtered.length === providers.length) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  await saveProviders(filtered);
  return NextResponse.json({ success: true });
}
