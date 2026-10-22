"use server";
import { resultado } from "@/lib/checklist/result";
import { obterAtorChecklist } from "@/lib/checklist/acesso";
import { listarEventos, marcarEventoLido } from "@/lib/checklist/eventos";
export async function listarEventosChecklist(input: unknown = {}) {
  return resultado(async () =>
    listarEventos(await obterAtorChecklist(), input),
  );
}
export async function marcarEventoChecklistLido(id: string) {
  return resultado(async () =>
    marcarEventoLido(await obterAtorChecklist(), id),
  );
}
