import db from "@/lib/prisma";
import { erroSqliteBusy, repetirTransacaoOcupada } from "@/lib/bpm/sqlite-busy-retry";
import { chamadoDestinoEhTI, obterAtorChamados, podeConcluirChamado } from "./acesso";

export class ErroConclusaoChamado extends Error {
  constructor(public readonly code: "NAO_ENCONTRADO" | "STATUS_INVALIDO" | "SEM_PERMISSAO" | "CONCORRENCIA" | "BANCO_OCUPADO", options?: ErrorOptions) {
    const mensagens = {
      NAO_ENCONTRADO: "Chamado não encontrado.",
      STATUS_INVALIDO: "Somente chamados em atendimento podem ser finalizados.",
      SEM_PERMISSAO: "Somente o responsável ativo e autorizado que assumiu o chamado pode finalizá-lo.",
      CONCORRENCIA: "O chamado foi alterado por outro usuário. Atualize a página e tente novamente.",
      BANCO_OCUPADO: "O banco está ocupado no momento. Aguarde alguns segundos e tente finalizar o chamado novamente.",
    } satisfies Record<ErroConclusaoChamado["code"], string>;
    super(mensagens[code], options);
    this.name = "ErroConclusaoChamado";
  }
}

type DadosConclusao = {
  chamadoId: number;
  tecnicoId: number;
  concluidoEm: Date;
  solucao?: string | null;
  causa?: string | null;
  mensagemFinal?: string | null;
  templateId?: number | null;
};

export async function concluirChamadoComFeedback(dados: DadosConclusao) {
  try {
    // O retry envolve somente a transação revertida. Cada tentativa relê a
    // autorização e o estado; notificações e Agenda ficam após o commit.
    return await repetirTransacaoOcupada(() => db.$transaction(async (tx) => {
      const ator = await obterAtorChamados(dados.tecnicoId, tx);
      if (!ator) throw new ErroConclusaoChamado("SEM_PERMISSAO");
      const chamado = await tx.chamados.findUnique({
        where: { id: dados.chamadoId },
        select: {
          id: true,
          titulo: true,
          usuarioId: true,
          tecnicoId: true,
          status: true,
          tecnicoSolicitadoId: true,
          setorDestinoId: true,
          setorDestino: { select: { id: true, nome: true, ativo: true, isBase: true } },
          tecnico: { select: { role: true, status: true } },
        },
      });

      if (!chamado) throw new ErroConclusaoChamado("NAO_ENCONTRADO");
      if (chamado.tecnicoId !== dados.tecnicoId || chamado.tecnico?.status !== "ATIVO" || chamado.tecnico.role !== ator.role) {
        throw new ErroConclusaoChamado("SEM_PERMISSAO");
      }
      if (chamado.status !== "EM_ATENDIMENTO") {
        throw new ErroConclusaoChamado("STATUS_INVALIDO");
      }

      if (!podeConcluirChamado(ator, chamado)) throw new ErroConclusaoChamado("SEM_PERMISSAO");

      const alteracao = await tx.chamados.updateMany({
        where: {
          id: chamado.id,
          tecnicoId: dados.tecnicoId,
          setorDestinoId: chamado.setorDestinoId,
          status: "EM_ATENDIMENTO",
        },
        data: {
          status: "CONCLUIDO",
          closedAt: dados.concluidoEm,
          updatedAt: dados.concluidoEm,
          ...(dados.solucao !== undefined ? { solucao: dados.solucao } : {}),
          ...(dados.causa !== undefined ? { causa: dados.causa } : {}),
          ...(dados.mensagemFinal !== undefined ? { mensagemFinal: dados.mensagemFinal } : {}),
          ...(dados.templateId !== undefined ? { templateId: dados.templateId } : {}),
        },
      });

      if (alteracao.count !== 1) throw new ErroConclusaoChamado("CONCORRENCIA");

      if (chamado.usuarioId !== dados.tecnicoId) await tx.chamadoFeedback.create({
        data: {
          chamadoId: chamado.id,
          status: "PENDENTE",
        },
        select: { chamadoId: true },
      });

      return {
        id: chamado.id,
        titulo: chamado.titulo,
        usuarioId: chamado.usuarioId,
        tecnicoId: chamado.tecnicoId,
        tecnicoRole: chamado.tecnico?.role ?? null,
        destinoEhTI: chamadoDestinoEhTI(chamado),
        solucao: dados.solucao ?? null,
        closedAt: dados.concluidoEm,
        updatedAt: dados.concluidoEm,
      };
    }, { isolationLevel: "Serializable" }));
  } catch (error) {
    if (!erroSqliteBusy(error)) throw error;
    console.error("[chamados] Contenção persistente ao finalizar chamado", {
      chamadoId: dados.chamadoId,
      tecnicoId: dados.tecnicoId,
      code: "BANCO_OCUPADO",
    });
    throw new ErroConclusaoChamado("BANCO_OCUPADO", { cause: error });
  }
}
