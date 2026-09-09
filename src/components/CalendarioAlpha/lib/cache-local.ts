import type { SnapshotIntervaloAgendaAlpha } from "@/actions/google-calendar-agenda";

import { formatarDataCivil, type VisaoCalendario } from "./datas";

const BANCO_CACHE_AGENDA = "painel-alpha-agenda-cache";
const VERSAO_BANCO_CACHE = 1;
const STORE_SNAPSHOTS = "snapshots";
const TTL_SNAPSHOT_MS = 24 * 60 * 60 * 1000;
const LIMITE_SNAPSHOTS = 24;

export interface SnapshotAgendaLocal extends SnapshotIntervaloAgendaAlpha {
  chave: string;
  conexaoId: string;
  salvoEm: number;
}

export function chaveSnapshotAgenda(
  conexaoId: string,
  visao: VisaoCalendario,
  dataReferencia: Date,
): string {
  return `${conexaoId}:${visao}:${formatarDataCivil(dataReferencia)}`;
}

export function snapshotAgendaEstaValido(
  snapshot: Pick<SnapshotAgendaLocal, "salvoEm">,
  agora = Date.now(),
): boolean {
  const idade = agora - snapshot.salvoEm;
  return idade >= 0 && idade <= TTL_SNAPSHOT_MS;
}

function abrirBancoCache(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const requisicao = window.indexedDB.open(
      BANCO_CACHE_AGENDA,
      VERSAO_BANCO_CACHE,
    );
    requisicao.onupgradeneeded = () => {
      const banco = requisicao.result;
      if (!banco.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        const store = banco.createObjectStore(STORE_SNAPSHOTS, {
          keyPath: "chave",
        });
        store.createIndex("porConexaoESalvoEm", ["conexaoId", "salvoEm"]);
      }
    };
    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => resolve(null);
    requisicao.onblocked = () => resolve(null);
  });
}

export async function lerSnapshotAgenda(
  chave: string,
): Promise<SnapshotAgendaLocal | null> {
  const banco = await abrirBancoCache();
  if (!banco) return null;

  return new Promise((resolve) => {
    const transacao = banco.transaction(STORE_SNAPSHOTS, "readwrite");
    const store = transacao.objectStore(STORE_SNAPSHOTS);
    const requisicao = store.get(chave);
    requisicao.onsuccess = () => {
      const snapshot = requisicao.result as SnapshotAgendaLocal | undefined;
      if (snapshot && snapshotAgendaEstaValido(snapshot)) {
        resolve(snapshot);
        return;
      }
      if (snapshot) store.delete(chave);
      resolve(null);
    };
    requisicao.onerror = () => resolve(null);
    transacao.oncomplete = () => banco.close();
    transacao.onerror = () => banco.close();
  });
}

export async function salvarSnapshotAgenda(
  snapshot: SnapshotAgendaLocal,
): Promise<void> {
  const banco = await abrirBancoCache();
  if (!banco) return;

  await new Promise<void>((resolve) => {
    const transacao = banco.transaction(STORE_SNAPSHOTS, "readwrite");
    transacao.objectStore(STORE_SNAPSHOTS).put(snapshot);
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => resolve();
    transacao.onabort = () => resolve();
  });

  const snapshotsConexao = await new Promise<SnapshotAgendaLocal[]>((resolve) => {
    const transacao = banco.transaction(STORE_SNAPSHOTS, "readonly");
    const indice = transacao
      .objectStore(STORE_SNAPSHOTS)
      .index("porConexaoESalvoEm");
    const requisicao = indice.getAll(
      IDBKeyRange.bound(
        [snapshot.conexaoId, 0],
        [snapshot.conexaoId, Number.MAX_SAFE_INTEGER],
      ),
    );
    requisicao.onsuccess = () =>
      resolve((requisicao.result as SnapshotAgendaLocal[]) ?? []);
    requisicao.onerror = () => resolve([]);
  });

  const validos = snapshotsConexao.filter((item) => snapshotAgendaEstaValido(item));
  const chavesParaRemover = new Set([
    ...snapshotsConexao
      .filter((item) => !snapshotAgendaEstaValido(item))
      .map((item) => item.chave),
    ...validos
    .sort((a, b) => b.salvoEm - a.salvoEm)
      .slice(LIMITE_SNAPSHOTS)
      .map((item) => item.chave),
  ]);

  if (chavesParaRemover.size > 0) {
    await new Promise<void>((resolve) => {
      const transacao = banco.transaction(STORE_SNAPSHOTS, "readwrite");
      const store = transacao.objectStore(STORE_SNAPSHOTS);
      for (const chave of chavesParaRemover) store.delete(chave);
      transacao.oncomplete = () => resolve();
      transacao.onerror = () => resolve();
      transacao.onabort = () => resolve();
    });
  }

  banco.close();
}
