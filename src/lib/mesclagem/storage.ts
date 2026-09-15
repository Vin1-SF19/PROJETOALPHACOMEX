import "server-only";

import path from "node:path";

import { resolveStorageTarget } from "@/lib/storage/catalog";
import type { StorageTarget } from "@/lib/storage/contracts";
import { StorageError } from "@/lib/storage/contracts";
import { uploadMultipart } from "@/lib/storage/orchestrator";
import { QuObjectsProvider } from "@/lib/storage/providers/quobjects";
import { readStorageRuntimeConfig } from "@/lib/storage/runtime-config";

interface ArquivoParaArmazenar {
  tipo: "principal" | "complementar" | "resultado";
  nome: string;
  conteudo: Blob | Uint8Array;
  tamanho: number;
  contentType: string;
}

interface StoragePrivadoMesclagem {
  provider: QuObjectsProvider;
  target: StorageTarget;
  partSize: number;
  concurrency: number;
  maxRetries: number;
}

function extensaoSegura(nome: string): string {
  const extensao = path.extname(nome).toLocaleLowerCase("pt-BR");
  return /^\.[a-z0-9]{1,8}$/.test(extensao) ? extensao : ".bin";
}

async function* partes(conteudo: Blob | Uint8Array, tamanhoParte: number): AsyncIterable<Uint8Array> {
  const tamanho = conteudo instanceof Blob ? conteudo.size : conteudo.byteLength;
  for (let inicio = 0; inicio < tamanho; inicio += tamanhoParte) {
    const fim = Math.min(tamanho, inicio + tamanhoParte);
    if (conteudo instanceof Blob) {
      yield new Uint8Array(await conteudo.slice(inicio, fim).arrayBuffer());
    } else {
      yield conteudo.slice(inicio, fim);
    }
  }
}

async function storagePrivado(): Promise<StoragePrivadoMesclagem> {
  const runtime = readStorageRuntimeConfig();
  if (!runtime.ok) {
    throw new StorageError("CONFIG_INVALID", "Armazenamento privado da Mesclagem não configurado");
  }
  const target = resolveStorageTarget("documentos", runtime.config);
  const provider = new QuObjectsProvider(runtime.config);
  const diagnostico = await provider.diagnose(target);
  if (!diagnostico.ok) {
    throw new StorageError(diagnostico.errorCode ?? "NETWORK_ERROR", "Armazenamento privado indisponível", {
      provider: provider.id,
      retryable: true,
    });
  }
  return {
    provider,
    target,
    partSize: runtime.config.partSizeBytes,
    concurrency: Math.min(2, runtime.config.concurrency),
    maxRetries: runtime.config.maxRetries,
  };
}

function chavePersistida(target: StorageTarget, objectKey: string): string {
  return `quobjects:${target.bucket}:${objectKey}`;
}

function interpretarChave(storageKey: string, target: StorageTarget): string {
  const prefixo = `quobjects:${target.bucket}:`;
  if (!storageKey.startsWith(prefixo)) throw new StorageError("CONFIG_INVALID", "Referência de arquivo inválida");
  const objectKey = storageKey.slice(prefixo.length);
  if (!objectKey.startsWith("mesclagens/") || objectKey.includes("..")) {
    throw new StorageError("CONFIG_INVALID", "Referência de arquivo fora da Mesclagem");
  }
  return objectKey;
}

export async function diagnosticarStorageMesclagem(): Promise<void> {
  await storagePrivado();
}

export async function armazenarArquivosMesclagem(params: {
  historicoId: string;
  userId: number;
  arquivos: ArquivoParaArmazenar[];
}): Promise<Record<ArquivoParaArmazenar["tipo"], string>> {
  const storage = await storagePrivado();
  const enviados: string[] = [];
  const tarefas = params.arquivos.map(async (arquivo) => {
    const objectKey = `mesclagens/${params.userId}/${params.historicoId}/${arquivo.tipo}${extensaoSegura(arquivo.nome)}`;
    const upload = await uploadMultipart({
      provider: storage.provider,
      target: storage.target,
      objectKey,
      contentType: arquivo.contentType || "application/octet-stream",
      size: arquivo.tamanho,
      partSize: storage.partSize,
      concurrency: storage.concurrency,
      maxRetries: storage.maxRetries,
      source: partes(arquivo.conteudo, storage.partSize),
    });
    enviados.push(objectKey);
    return [arquivo.tipo, chavePersistida(storage.target, upload.metadata.objectKey)] as const;
  });
  const resultados = await Promise.allSettled(tarefas);
  const falha = resultados.find((resultado) => resultado.status === "rejected");
  if (falha) {
    await Promise.allSettled(enviados.map((objectKey) => storage.provider.delete(storage.target, objectKey)));
    throw falha.reason;
  }
  return Object.fromEntries(resultados.map((resultado) => (resultado as PromiseFulfilledResult<readonly [string, string]>).value)) as Record<ArquivoParaArmazenar["tipo"], string>;
}

export async function excluirArquivosMesclagem(storageKeys: string[]): Promise<void> {
  const storage = await storagePrivado();
  await Promise.allSettled(storageKeys.map((storageKey) =>
    storage.provider.delete(storage.target, interpretarChave(storageKey, storage.target))
  ));
}

export async function baixarArquivoMesclagem(storageKey: string): Promise<AsyncIterable<Uint8Array>> {
  const storage = await storagePrivado();
  return storage.provider.download(storage.target, interpretarChave(storageKey, storage.target));
}
