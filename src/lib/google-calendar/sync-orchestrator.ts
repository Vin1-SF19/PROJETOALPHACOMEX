import { randomUUID } from "node:crypto";

import {
  adquirirLeaseSincronizacao,
  liberarLeaseSincronizacao,
  renovarLeaseSincronizacao,
  type LeaseSincronizacaoAgenda,
} from "@/lib/google-calendar/distributed-lock";
import { lerAgendaAlphaRuntimeConfig } from "@/lib/google-calendar/runtime-config";
import {
  sincronizarCalendario,
  type ContadoresSincronizacaoCalendario,
  type OpcoesSincronizacaoCalendario,
  type ResultadoSincronizacaoCalendario,
} from "@/lib/google-calendar/sync";

const COOLDOWN_PADRAO_MS = 30_000;

export interface CalendarioParaOrquestracao {
  id: string;
  googleCalendarId: string;
  syncToken: string | null;
}

export type ResultadoOrquestracaoSincronizacao =
  | {
      status: "sincronizado";
      iniciadoEm: string;
      concluidoEm: string;
      contadores: ContadoresSincronizacaoCalendario;
    }
  | {
      status: "cooldown";
      ultimaTentativaEm: string;
      proximaTentativaPermitidaEm: string;
      resultadoAnterior: "sucesso" | "erro";
    }
  | {
      status: "em_andamento";
      iniciadoEm: string;
    }
  | {
      status: "erro";
      iniciadoEm: string;
      concluidoEm: string;
      erro: string;
      contadores: ContadoresSincronizacaoCalendario;
    };

type ExecutarSync = (
  calendario: CalendarioParaOrquestracao,
  emailUsuario: string,
  permitirRetryFullSync?: boolean,
  opcoes?: OpcoesSincronizacaoCalendario,
) => Promise<ResultadoSincronizacaoCalendario>;

interface OpcoesOrquestrador {
  cooldownMs?: number;
  executarSync?: ExecutarSync;
  agora?: () => number;
  distributedLockEnabled?: boolean;
  ownerId?: string;
  adquirirLease?: typeof adquirirLeaseSincronizacao;
  renovarLease?: typeof renovarLeaseSincronizacao;
  liberarLease?: typeof liberarLeaseSincronizacao;
}

interface SincronizacaoEmAndamento {
  iniciadoEm: number;
  promessa: Promise<ResultadoOrquestracaoSincronizacao>;
}

interface UltimaTentativa {
  executadoEm: number;
  resultado: "sucesso" | "erro";
}

/**
 * Coordena chamadas dentro desta instância Node. O dedupe e o cooldown não são
 * locks distribuídos: réplicas/processos diferentes continuam independentes.
 */
export function criarOrquestradorSincronizacao(opcoes: OpcoesOrquestrador = {}) {
  const cooldownMs = opcoes.cooldownMs ?? COOLDOWN_PADRAO_MS;
  const executarSync = opcoes.executarSync ?? sincronizarCalendario;
  const agora = opcoes.agora ?? Date.now;
  const runtimeConfig = lerAgendaAlphaRuntimeConfig();
  const distributedLockEnabled =
    opcoes.distributedLockEnabled ?? runtimeConfig.distributedLockEnabled;
  const ownerId =
    opcoes.ownerId ?? `agenda-manual:${process.pid}:${randomUUID()}`;
  const adquirirLease = opcoes.adquirirLease ?? adquirirLeaseSincronizacao;
  const renovarLease = opcoes.renovarLease ?? renovarLeaseSincronizacao;
  const liberarLease = opcoes.liberarLease ?? liberarLeaseSincronizacao;
  const emAndamento = new Map<string, SincronizacaoEmAndamento>();
  const usuariosEmAndamento = new Map<number, SincronizacaoEmAndamento>();
  const ultimasTentativas = new Map<string, UltimaTentativa>();

  async function executar(params: {
    userId: number;
    calendario: CalendarioParaOrquestracao;
    emailUsuario: string;
  }): Promise<ResultadoOrquestracaoSincronizacao> {
    const chave = `${params.userId}:${params.calendario.id}`;
    const existente =
      emAndamento.get(chave) ?? usuariosEmAndamento.get(params.userId);
    if (existente) {
      return {
        status: "em_andamento",
        iniciadoEm: new Date(existente.iniciadoEm).toISOString(),
      };
    }

    const instanteAtual = agora();
    const ultimaTentativa = ultimasTentativas.get(chave);
    if (
      ultimaTentativa !== undefined &&
      instanteAtual - ultimaTentativa.executadoEm < cooldownMs
    ) {
      return {
        status: "cooldown",
        ultimaTentativaEm: new Date(ultimaTentativa.executadoEm).toISOString(),
        proximaTentativaPermitidaEm: new Date(
          ultimaTentativa.executadoEm + cooldownMs,
        ).toISOString(),
        resultadoAnterior: ultimaTentativa.resultado,
      };
    }

    const iniciadoEm = instanteAtual;
    const promessa = (async (): Promise<ResultadoOrquestracaoSincronizacao> => {
      let lease: LeaseSincronizacaoAgenda | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let heartbeatEmCurso = Promise.resolve();
      let leasePerdido = false;
      try {
        if (distributedLockEnabled) {
          lease = await adquirirLease({
            calendarioId: params.calendario.id,
            ownerId,
          });
          if (!lease) {
            return {
              status: "em_andamento",
              iniciadoEm: new Date(iniciadoEm).toISOString(),
            };
          }
          heartbeatTimer = setInterval(() => {
            heartbeatEmCurso = heartbeatEmCurso
              .then(async () => {
                if (!lease || leasePerdido) return;
                const renovado = await renovarLease(lease);
                if (!renovado) {
                  leasePerdido = true;
                  return;
                }
                lease = renovado;
              })
              .catch(() => {
                leasePerdido = true;
              });
          }, 30_000);
          heartbeatTimer.unref?.();
        }

        const resultado = await executarSync(
          params.calendario,
          params.emailUsuario,
          true,
          lease
            ? {
                fencing: {
                  ownerId: lease.ownerId,
                  fencingToken: lease.fencingToken,
                },
              }
            : undefined,
        );
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        await heartbeatEmCurso;
        if (leasePerdido) {
          throw new Error("Lease perdido durante a sincronização.");
        }
        const concluidoEm = agora();
        ultimasTentativas.set(chave, {
          executadoEm: concluidoEm,
          resultado: resultado.ok ? "sucesso" : "erro",
        });

        if (!resultado.ok) {
          return {
            status: "erro",
            iniciadoEm: new Date(iniciadoEm).toISOString(),
            concluidoEm: new Date(concluidoEm).toISOString(),
            erro: resultado.erro,
            contadores: resultado.contadores,
          };
        }

        return {
          status: "sincronizado",
          iniciadoEm: new Date(iniciadoEm).toISOString(),
          concluidoEm: new Date(concluidoEm).toISOString(),
          contadores: resultado.contadores,
        };
      } catch {
        const concluidoEm = agora();
        ultimasTentativas.set(chave, {
          executadoEm: concluidoEm,
          resultado: "erro",
        });
        return {
          status: "erro",
          iniciadoEm: new Date(iniciadoEm).toISOString(),
          concluidoEm: new Date(concluidoEm).toISOString(),
          erro: "Falha inesperada ao sincronizar este calendário.",
          contadores: {
            eventosRecebidos: 0,
            eventosAtualizados: 0,
            eventosRemovidos: 0,
            paginasProcessadas: 0,
          },
        };
      } finally {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        await heartbeatEmCurso.catch(() => undefined);
        if (lease) {
          await liberarLease(lease).catch(() => false);
        }
      }
    })();

    const execucao = { iniciadoEm, promessa };
    emAndamento.set(chave, execucao);
    usuariosEmAndamento.set(params.userId, execucao);
    try {
      return await promessa;
    } finally {
      if (emAndamento.get(chave)?.promessa === promessa) {
        emAndamento.delete(chave);
      }
      if (usuariosEmAndamento.get(params.userId)?.promessa === promessa) {
        usuariosEmAndamento.delete(params.userId);
      }
    }
  }

  return { executar };
}

const orquestradorPadrao = criarOrquestradorSincronizacao();

export const orquestrarSincronizacaoCalendario = orquestradorPadrao.executar;
