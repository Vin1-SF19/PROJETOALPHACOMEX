const JANELA_MS = 60_000;
const MAXIMO_POR_JANELA = 5;
const MAXIMO_CHAVES = 2_000;

/**
 * Defesa em profundidade por instância do processo. Não é um rate limit
 * distribuído e não oferece coordenação entre réplicas/serverless sem uma
 * infraestrutura compartilhada (Redis/KV), que não faz parte desta story.
 */

interface EstadoLimiteImportacao {
  tentativas: number[];
  emAndamento: boolean;
  ultimoAcesso: number;
}

declare global {
  var csNpsImportacaoRateLimit: Map<string, EstadoLimiteImportacao> | undefined;
}

const estados = globalThis.csNpsImportacaoRateLimit ?? new Map<string, EstadoLimiteImportacao>();
if (process.env.NODE_ENV !== "production") globalThis.csNpsImportacaoRateLimit = estados;

export type ResultadoLimiteImportacao =
  | { permitido: true; liberar: () => void }
  | { permitido: false; motivo: "RATE_LIMIT" | "CONCURRENT_IMPORT" };

function limparEstadosAntigos(agora: number): void {
  for (const [chave, estado] of estados) {
    if (!estado.emAndamento && agora - estado.ultimoAcesso > JANELA_MS * 5) estados.delete(chave);
  }
  if (estados.size <= MAXIMO_CHAVES) return;
  const ordenados = [...estados.entries()]
    .filter(([, estado]) => !estado.emAndamento)
    .sort((a, b) => a[1].ultimoAcesso - b[1].ultimoAcesso);
  for (const [chave] of ordenados.slice(0, estados.size - MAXIMO_CHAVES)) estados.delete(chave);
}

export function adquirirLimiteImportacao(userId: number, ip: string): ResultadoLimiteImportacao {
  const agora = Date.now();
  limparEstadosAntigos(agora);
  const chave = `${userId}:${ip.slice(0, 80)}`;
  const estado = estados.get(chave) ?? { tentativas: [], emAndamento: false, ultimoAcesso: agora };
  estado.tentativas = estado.tentativas.filter((instante) => agora - instante < JANELA_MS);
  estado.ultimoAcesso = agora;

  if (estado.tentativas.length >= MAXIMO_POR_JANELA) {
    estados.set(chave, estado);
    return { permitido: false, motivo: "RATE_LIMIT" };
  }
  if (estado.emAndamento) {
    estados.set(chave, estado);
    return { permitido: false, motivo: "CONCURRENT_IMPORT" };
  }

  estado.tentativas.push(agora);
  estado.emAndamento = true;
  estados.set(chave, estado);
  let liberado = false;
  return {
    permitido: true,
    liberar: () => {
      if (liberado) return;
      liberado = true;
      const atual = estados.get(chave);
      if (atual) {
        atual.emAndamento = false;
        atual.ultimoAcesso = Date.now();
        estados.set(chave, atual);
      }
    },
  };
}

export function obterIpImportacao(headers: Headers): string {
  const encaminhado = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || headers.get("x-real-ip")?.trim() || "ip-indisponivel";
}
