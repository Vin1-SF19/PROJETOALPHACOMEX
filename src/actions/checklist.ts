"use server";
import { resultado } from "@/lib/checklist/result";
import { obterAtorChecklist } from "@/lib/checklist/acesso";
import {
  listarEmpresas,
  listarAnalistas,
  obterEmpresa,
  listarDocumentos,
  historicoEventos,
} from "@/lib/checklist/leitura";
import {
  criarAtendimento,
  selecionarTipo,
  atualizarEmpresa,
  atualizarItem,
  atribuirAnalista,
  alterarDocumento,
} from "@/lib/checklist/service";
import { registrarDocumento } from "@/lib/checklist/documentos";
export async function listarEmpresasChecklist(input: unknown = {}) {
  return resultado(async () =>
    listarEmpresas(await obterAtorChecklist(), input),
  );
}
export async function listarAnalistasChecklist() {
  return resultado(async () => listarAnalistas(await obterAtorChecklist()));
}
export async function obterEmpresaChecklist(
  id: string,
  options: { checklistId?: string } = {},
) {
  return resultado(async () =>
    obterEmpresa(await obterAtorChecklist(), id, options),
  );
}
export async function criarAtendimentoChecklist(input: unknown) {
  return resultado(async () =>
    criarAtendimento(await obterAtorChecklist(), input),
  );
}
export async function selecionarTipoChecklist(input: unknown) {
  return resultado(async () =>
    selecionarTipo(await obterAtorChecklist(), input),
  );
}
export async function atualizarEmpresaChecklist(input: unknown) {
  return resultado(async () =>
    atualizarEmpresa(await obterAtorChecklist(), input),
  );
}
export async function atualizarItemChecklist(input: unknown) {
  return resultado(async () =>
    atualizarItem(await obterAtorChecklist(), input),
  );
}
export async function atribuirAnalistaChecklist(input: unknown) {
  return resultado(async () =>
    atribuirAnalista(await obterAtorChecklist(), input),
  );
}
export async function listarDocumentosChecklist(
  input: Parameters<typeof listarDocumentos>[1],
) {
  return resultado(async () =>
    listarDocumentos(await obterAtorChecklist(), input),
  );
}
export async function obterHistoricoChecklist(
  input: Parameters<typeof historicoEventos>[1],
) {
  return resultado(async () =>
    historicoEventos(await obterAtorChecklist(), input),
  );
}
export async function registrarDocumentoChecklist(input: unknown) {
  return resultado(async () =>
    registrarDocumento(await obterAtorChecklist(), input),
  );
}
export async function excluirDocumentoChecklist(input: unknown) {
  return resultado(async () =>
    alterarDocumento(await obterAtorChecklist(), input, "EXCLUIR"),
  );
}
export async function restaurarDocumentoChecklist(input: unknown) {
  return resultado(async () =>
    alterarDocumento(await obterAtorChecklist(), input, "RESTAURAR"),
  );
}
export async function atualizarObservacaoDocumento(input: unknown) {
  return resultado(async () =>
    alterarDocumento(await obterAtorChecklist(), input, "OBSERVACAO"),
  );
}
// Compatibility names delegate to the same command. Consumers must send CAS + mutationId.
export async function criarChecklist(input: unknown) {
  return selecionarTipoChecklist(input);
}
export async function trocarEmbasamentoChecklist(input: unknown) {
  return selecionarTipoChecklist(input);
}
export async function getEmpresaChecklist(id: string) {
  return obterEmpresaChecklist(id);
}
export async function getEmpresasChecklist() {
  return listarEmpresasChecklist();
}
export async function listarHistoricoDocumentosChecklist(input: unknown = {}) {
  return resultado(async () => {
    const { historicoDocumentos } = await import("@/lib/checklist/leitura");
    return historicoDocumentos(await obterAtorChecklist(), input);
  });
}
