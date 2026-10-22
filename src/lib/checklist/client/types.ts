import type { Result } from "../types";
import type * as api from "@/actions/checklist";
export type Dados<R> = R extends { ok: true; data: infer T } ? T : never;
export type EmpresaDetalhe = Dados<Awaited<ReturnType<typeof api.obterEmpresaChecklist>>>;
export type EmpresaResumo = Dados<Awaited<ReturnType<typeof api.listarEmpresasChecklist>>>["items"][number];
export type Analista = Dados<Awaited<ReturnType<typeof api.listarAnalistasChecklist>>>[number];
export type Documento = Dados<Awaited<ReturnType<typeof api.listarDocumentosChecklist>>>["items"][number];
export type Item = NonNullable<EmpresaDetalhe["checklist"]>["itens"][number];
export async function confirmar<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw new Error(`${result.error.message} (${result.requestId})`);
  return result.data;
}
export const erroChecklist = (error: unknown) => (error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.");
export function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
