import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/prisma";
import { authorizeAlphaBridge } from "@/lib/alpha-crm/bridge-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Delegate = { findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]> };
const models = Prisma.dmmf.datamodel.models.filter(model => model.name.startsWith("Bpm") || model.name === "Cliente");
const resources = new Map(models.map(model => {
  const idField = model.fields.find(field => field.name === "id") || model.fields.find(field => field.name === "cardId");
  return [model.name, { delegate: model.name[0].toLowerCase() + model.name.slice(1), idField: idField?.name, idType: idField?.type }] as const;
}));
const sensitive = /(senha|password|secret|segredo|token|credential|credencial|authorization|apikey|api_key|hash)/i;

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.test(key)).map(([key, item]) => [key, scrub(item)]));
  }
  return value;
}

function sanitizedRecord(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !sensitive.test(key)).map(([key, value]) => {
    if (typeof value === "string" && /Json$/.test(key)) {
      try { return [key, JSON.stringify(scrub(JSON.parse(value)))]; } catch { /* keep non-JSON legacy value */ }
    }
    return [key, value];
  }));
}

export async function GET(request: NextRequest) {
  if (!authorizeAlphaBridge(request.headers.get("authorization"))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const resource = request.nextUrl.searchParams.get("resource");
  if (!resource) return NextResponse.json({ version: 1, resources: [...resources.keys()].sort() }, { headers: { "Cache-Control": "no-store" } });
  const model = resources.get(resource);
  if (!model || !model.idField || !model.idType) return NextResponse.json({ error: "Recurso não permitido" }, { status: 400 });
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || "100");
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) return NextResponse.json({ error: "Limite inválido" }, { status: 400 });
  const rawCursor = request.nextUrl.searchParams.get("cursor");
  const cursorId = rawCursor === null ? null : model.idType === "Int" ? Number(rawCursor) : rawCursor;
  if (rawCursor !== null && (rawCursor.length > 200 || (model.idType === "Int" && (!Number.isInteger(cursorId) || Number(cursorId) < 1)))) {
    return NextResponse.json({ error: "Cursor inválido" }, { status: 400 });
  }
  try {
    const delegate = (db as unknown as Record<string, Delegate>)[model.delegate];
    const rows = await delegate.findMany({
      take: rawLimit + 1,
      orderBy: { [model.idField]: "asc" },
      ...(cursorId === null ? {} : { cursor: { [model.idField]: cursorId }, skip: 1 }),
      ...(resource === "Cliente" ? { select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true, uf: true, municipio: true, status: true, createdAt: true, updatedAt: true } } : {}),
    });
    const hasMore = rows.length > rawLimit;
    const page = rows.slice(0, rawLimit);
    return NextResponse.json({ resource, records: page.map(row => ({ ...sanitizedRecord(row), __sourceId: String(row[model.idField!]) })), nextCursor: hasMore ? String(page.at(-1)?.[model.idField]) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[alpha-crm/snapshot]", resource, error);
    return NextResponse.json({ error: "Falha ao consultar o recurso" }, { status: 500 });
  }
}
