const JANELA_MS = 60_000;
const MAXIMO_POR_JANELA = 5;
const MAXIMO_CHAVES = 2_000;

interface EstadoLimiteMesclagem {
  tentativas: number[];
  emAndamento: boolean;
  ultimoAcesso: number;
}

declare global {
  var mesclagemRateLimit: Map<string, EstadoLimiteMesclagem> | undefined;
}

const estados = globalThis.mesclagemRateLimit ?? new Map<string, EstadoLimiteMesclagem>();
if (process.env.NODE_ENV !== "production") globalThis.mesclagemRateLimit = estados;

export type ResultadoLimiteMesclagem =
  | { permitido: true; liberar: () => void }
  | { permitido: false; motivo: "RATE_LIMIT" | "CONCURRENT_MESCLAGEM" };

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

export function adquirirLimiteMesclagem(userId: number, ip: string): ResultadoLimiteMesclagem {
  const agora = Date.now();
  limparEstadosAntigos(agora);
  // Concorrência e orçamento são primariamente por identidade autenticada.
  // O IP não compõe a chave: trocá-lo/proxy não pode abrir um segundo processamento.
  void ip;
  const chave = `user:${userId}`;
  const estado = estados.get(chave) ?? { tentativas: [], emAndamento: false, ultimoAcesso: agora };
  estado.tentativas = estado.tentativas.filter((instante) => agora - instante < JANELA_MS);
  estado.ultimoAcesso = agora;

  if (estado.tentativas.length >= MAXIMO_POR_JANELA) {
    estados.set(chave, estado);
    return { permitido: false, motivo: "RATE_LIMIT" };
  }
  if (estado.emAndamento) {
    estados.set(chave, estado);
    return { permitido: false, motivo: "CONCURRENT_MESCLAGEM" };
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

export function obterIpMesclagem(headers: Headers): string {
  const encaminhado = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || headers.get("x-real-ip")?.trim() || "ip-indisponivel";
}
