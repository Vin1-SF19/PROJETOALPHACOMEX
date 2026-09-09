export const TEMPO_LIMITE_AGENDAS_COMPARTILHADAS_MS = 12_000;

type ResultadoCompartilhado<T> =
  | { success: true; data: T }
  | { success: false; error: string };

interface MensagensEsperaCompartilhada {
  timeout: string;
  falha: string;
}

/** Impede que uma integração remota deixe o indicador de carregamento preso. */
export async function aguardarResultadoCompartilhado<T>(
  operacao: Promise<ResultadoCompartilhado<T>>,
  mensagens: MensagensEsperaCompartilhada,
  tempoLimiteMs = TEMPO_LIMITE_AGENDAS_COMPARTILHADAS_MS,
): Promise<ResultadoCompartilhado<T>> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<ResultadoCompartilhado<T>>((resolve) => {
    temporizador = setTimeout(() => {
      resolve({ success: false, error: mensagens.timeout });
    }, tempoLimiteMs);
  });

  try {
    return await Promise.race([operacao, limite]);
  } catch {
    return { success: false, error: mensagens.falha };
  } finally {
    if (temporizador !== undefined) clearTimeout(temporizador);
  }
}
