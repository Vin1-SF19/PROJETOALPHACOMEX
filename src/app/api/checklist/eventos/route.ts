import { obterAtorChecklist } from "@/lib/checklist/acesso";
import { listarEventos, marcarEventoLido } from "@/lib/checklist/eventos";
import { resultado } from "@/lib/checklist/result";
import { resultHttp } from "@/lib/checklist/http";
export async function GET(req: Request) {
  return resultHttp(
    await resultado(async () => {
      const u = new URL(req.url);
      return listarEventos(await obterAtorChecklist(), {
        cursor: u.searchParams.get("cursor")
          ? JSON.parse(u.searchParams.get("cursor")!)
          : undefined,
        limit: Number(u.searchParams.get("limit") ?? 50),
        somenteNaoLidos: u.searchParams.get("naoLidos") === "true",
      });
    }),
  );
}
export async function POST(req: Request) {
  return resultHttp(
    await resultado(async () =>
      marcarEventoLido(await obterAtorChecklist(), (await req.json()).eventId),
    ),
  );
}
