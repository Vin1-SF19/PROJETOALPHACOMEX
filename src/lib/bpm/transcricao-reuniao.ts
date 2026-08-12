export type RegistroConferenciaMeet = {
  name: string;
  startTime: string;
  endTime: string | null;
};

export type EntradaTranscricaoMeet = {
  name: string;
  participant: string | null;
  text: string;
  startTime: string | null;
};

const CODIGO_MEET = /^[a-z]+-[a-z]+-[a-z]+$/;
const JANELA_COMPATIBILIDADE_MS = 24 * 60 * 60 * 1000;

export function extrairCodigoMeet(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "meet.google.com") return null;
    const codigo = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
    return CODIGO_MEET.test(codigo) ? codigo : null;
  } catch {
    return null;
  }
}

export function selecionarRegistroConferencia(
  registros: RegistroConferenciaMeet[],
  dataReuniao: Date | null,
): RegistroConferenciaMeet | null {
  const encerrados = registros.filter((registro) => {
    return Boolean(registro.name && registro.endTime && Number.isFinite(Date.parse(registro.startTime)));
  });
  if (encerrados.length === 0) return null;

  if (!dataReuniao) {
    return encerrados.sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))[0] ?? null;
  }

  const alvo = dataReuniao.getTime();
  const porProximidade = encerrados.sort((a, b) => {
    return Math.abs(Date.parse(a.startTime) - alvo) - Math.abs(Date.parse(b.startTime) - alvo);
  });
  const escolhido = porProximidade[0];
  if (!escolhido || Math.abs(Date.parse(escolhido.startTime) - alvo) > JANELA_COMPATIBILIDADE_MS) {
    return null;
  }
  return escolhido;
}

export function consolidarTranscricao(
  entradas: EntradaTranscricaoMeet[],
  participantes: ReadonlyMap<string, string>,
): string | null {
  const linhas = entradas
    .filter((entrada) => entrada.text.trim().length > 0)
    .sort((a, b) => {
      const tempoA = a.startTime ? Date.parse(a.startTime) : Number.MAX_SAFE_INTEGER;
      const tempoB = b.startTime ? Date.parse(b.startTime) : Number.MAX_SAFE_INTEGER;
      return tempoA - tempoB || a.name.localeCompare(b.name);
    })
    .map((entrada) => {
      const horario = entrada.startTime && Number.isFinite(Date.parse(entrada.startTime))
        ? new Date(entrada.startTime).toISOString().slice(11, 19)
        : "--:--:--";
      const participante = entrada.participant
        ? participantes.get(entrada.participant) ?? "Participante"
        : "Participante";
      return `[${horario}] ${participante}: ${entrada.text.trim()}`;
    });

  return linhas.length > 0 ? linhas.join("\n") : null;
}
