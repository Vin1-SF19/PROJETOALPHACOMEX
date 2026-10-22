"use server";
import { obterAtorChecklist } from "@/lib/checklist/acesso";
import { resultado } from "@/lib/checklist/result";
import {
  obterDossieCard,
  listarCandidatosCard,
  vincularDossieCard,
} from "@/lib/bpm/checklist-documental";
export async function obterDossieChecklistCard(cardId: string) {
  return resultado(async () =>
    obterDossieCard(await obterAtorChecklist(), cardId),
  );
}
export async function listarDossiesCandidatosCard(
  cardId: string,
  input: unknown = {},
) {
  return resultado(async () =>
    listarCandidatosCard(await obterAtorChecklist(), cardId, input),
  );
}
export async function vincularDossieChecklistCard(input: unknown) {
  return resultado(async () =>
    vincularDossieCard(await obterAtorChecklist(), input),
  );
}
