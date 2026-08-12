import "server-only";

import { google, meet_v2 } from "googleapis";

import type {
  EntradaTranscricaoMeet,
  RegistroConferenciaMeet,
} from "@/lib/bpm/transcricao-reuniao";

export const ESCOPO_MEETINGS_SPACE_READONLY =
  "https://www.googleapis.com/auth/meetings.space.readonly";
const MAX_PAGINAS_MEET = 100;
const MAX_ITENS_MEET = 50_000;
const TIMEOUT_CHAMADA_MEET_MS = 15_000;

type ClienteMeet = meet_v2.Meet;

export class GoogleMeetIntegracaoError extends Error {
  constructor(
    message: string,
    readonly recuperavel = false,
  ) {
    super(message);
    this.name = "GoogleMeetIntegracaoError";
  }
}

function obterEnvObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new GoogleMeetIntegracaoError(`Variável de ambiente ${nome} não configurada.`);
  return valor;
}

function criarClienteMeet(emailUsuario: string): ClienteMeet {
  const email = obterEnvObrigatoria("GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL");
  const chave = obterEnvObrigatoria("GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email,
    key: chave,
    scopes: [ESCOPO_MEETINGS_SPACE_READONLY],
    subject: emailUsuario,
  });
  return google.meet({ version: "v2", auth });
}

function classificarErro(erro: unknown): GoogleMeetIntegracaoError {
  if (erro instanceof GoogleMeetIntegracaoError) return erro;
  if (erroEhTimeout(erro)) {
    return new GoogleMeetIntegracaoError("A consulta ao Google Meet excedeu o tempo limite. Tente novamente.", true);
  }
  const status = statusErro(erro);
  if (status === 401 || status === 403) {
    return new GoogleMeetIntegracaoError(
      "Google Meet não autorizou a leitura. Verifique a API, a delegação do domínio e o escopo meetings.space.readonly.",
    );
  }
  if (status === 429 || status >= 500) {
    return new GoogleMeetIntegracaoError("Google Meet está temporariamente indisponível. Tente novamente.", true);
  }
  return new GoogleMeetIntegracaoError("Não foi possível consultar a transcrição no Google Meet.");
}

function statusErro(erro: unknown): number {
  if (typeof erro !== "object" || erro === null) return 0;
  const forma = erro as { code?: unknown; response?: { status?: unknown } };
  return Number(forma.response?.status ?? forma.code ?? 0);
}

function erroEhTimeout(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) return false;
  const forma = erro as { code?: unknown; message?: unknown };
  const codigo = String(forma.code ?? "").toUpperCase();
  const mensagem = String(forma.message ?? "").toLowerCase();
  return ["ETIMEDOUT", "ECONNABORTED"].includes(codigo) || mensagem.includes("timeout");
}

async function executarComRetry<T>(operacao: () => Promise<T>): Promise<T> {
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      return await operacao();
    } catch (erro) {
      const status = statusErro(erro);
      if ((status !== 429 && status < 500 && !erroEhTimeout(erro)) || tentativa === 2) throw erro;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** tentativa));
    }
  }
  throw new GoogleMeetIntegracaoError("Google Meet está temporariamente indisponível.", true);
}

export async function paginarGoogleMeet<T>(
  buscar: (pageToken?: string) => Promise<{ itens: T[]; nextPageToken?: string | null }>,
  limites: { maxPaginas?: number; maxItens?: number } = {},
): Promise<T[]> {
  const resultado: T[] = [];
  const tokens = new Set<string>();
  const maxPaginas = limites.maxPaginas ?? MAX_PAGINAS_MEET;
  const maxItens = limites.maxItens ?? MAX_ITENS_MEET;
  let paginas = 0;
  let pageToken: string | undefined;
  do {
    paginas += 1;
    if (paginas > maxPaginas) {
      throw new GoogleMeetIntegracaoError("A resposta do Google Meet excedeu o limite seguro de páginas.");
    }
    const pagina = await executarComRetry(() => buscar(pageToken));
    resultado.push(...pagina.itens);
    if (resultado.length > maxItens) {
      throw new GoogleMeetIntegracaoError("A resposta do Google Meet excedeu o limite seguro de itens.");
    }
    const proximo = pagina.nextPageToken?.trim() || undefined;
    if (proximo && tokens.has(proximo)) {
      throw new GoogleMeetIntegracaoError("O Google Meet devolveu uma paginação inválida.");
    }
    if (proximo) tokens.add(proximo);
    pageToken = proximo;
  } while (pageToken);
  return resultado;
}

export async function listarRegistrosConferenciaMeet(
  emailUsuario: string,
  meetingCode: string,
): Promise<RegistroConferenciaMeet[]> {
  const meet = criarClienteMeet(emailUsuario);
  try {
    const itens = await paginarGoogleMeet(async (pageToken) => {
      const resposta = await meet.conferenceRecords.list({
        filter: `space.meeting_code = "${meetingCode}"`,
        pageSize: 100,
        pageToken,
      }, { timeout: TIMEOUT_CHAMADA_MEET_MS });
      return { itens: resposta.data.conferenceRecords ?? [], nextPageToken: resposta.data.nextPageToken };
    }, { maxItens: 1_000 });
    return itens.flatMap((item) => item.name && item.startTime
      ? [{ name: item.name, startTime: item.startTime, endTime: item.endTime ?? null }]
      : []);
  } catch (erro) {
    throw classificarErro(erro);
  }
}

export async function carregarArtefatoTranscricaoMeet(
  emailUsuario: string,
  conferenceRecordName: string,
): Promise<{
  transcriptsEncontrados: number;
  entradas: EntradaTranscricaoMeet[];
  participantes: Map<string, string>;
}> {
  const meet = criarClienteMeet(emailUsuario);
  try {
    const [transcripts, participantesApi] = await Promise.all([
      paginarGoogleMeet(async (pageToken) => {
        const resposta = await meet.conferenceRecords.transcripts.list({
          parent: conferenceRecordName,
          pageSize: 100,
          pageToken,
        }, { timeout: TIMEOUT_CHAMADA_MEET_MS });
        return { itens: resposta.data.transcripts ?? [], nextPageToken: resposta.data.nextPageToken };
      }, { maxItens: 500 }),
      paginarGoogleMeet(async (pageToken) => {
        const resposta = await meet.conferenceRecords.participants.list({
          parent: conferenceRecordName,
          pageSize: 250,
          pageToken,
        }, { timeout: TIMEOUT_CHAMADA_MEET_MS });
        return { itens: resposta.data.participants ?? [], nextPageToken: resposta.data.nextPageToken };
      }, { maxItens: 5_000 }),
    ]);

    const participantes = new Map<string, string>();
    for (const participante of participantesApi) {
      const nome = participante.signedinUser?.displayName
        ?? participante.anonymousUser?.displayName
        ?? participante.phoneUser?.displayName;
      if (participante.name && nome?.trim()) participantes.set(participante.name, nome.trim());
    }

    const entradasPorTranscript = await Promise.all(
      transcripts.filter((transcript) => transcript.name).map(async (transcript) => {
        const transcriptName = transcript.name!;
        return paginarGoogleMeet(async (pageToken) => {
          const resposta = await meet.conferenceRecords.transcripts.entries.list({
            parent: transcriptName,
            pageSize: 100,
            pageToken,
          }, { timeout: TIMEOUT_CHAMADA_MEET_MS });
          return { itens: resposta.data.transcriptEntries ?? [], nextPageToken: resposta.data.nextPageToken };
        }, { maxItens: 20_000 });
      }),
    );

    const entradas = entradasPorTranscript.flat().flatMap((entrada) => {
      if (!entrada.name || !entrada.text?.trim()) return [];
      return [{
        name: entrada.name,
        participant: entrada.participant ?? null,
        text: entrada.text,
        startTime: entrada.startTime ?? null,
      }];
    });
    return { transcriptsEncontrados: transcripts.length, entradas, participantes };
  } catch (erro) {
    throw classificarErro(erro);
  }
}
