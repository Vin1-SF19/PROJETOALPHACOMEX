"use server";
import { resultado } from "@/lib/checklist/result";
import { obterAtorChecklist } from "@/lib/checklist/acesso";
import {
  listarCatalogo,
  publicarModelo,
  revisarModelo,
} from "@/lib/checklist/catalogo";
export async function listarModelosChecklist(input: unknown = {}) {
  return resultado(async () =>
    listarCatalogo(await obterAtorChecklist(), input),
  );
}
export async function publicarModeloChecklist(input: unknown) {
  return resultado(async () =>
    publicarModelo(await obterAtorChecklist(), input),
  );
}
export async function desativarModeloChecklist(input: unknown) {
  return resultado(async () =>
    revisarModelo(await obterAtorChecklist(), input, "DESATIVAR"),
  );
}
export async function ordenarModelosChecklist(input: unknown) {
  return resultado(async () =>
    revisarModelo(await obterAtorChecklist(), input, "ORDENAR"),
  );
}
