import db from "@/lib/prisma";

export class ErroConclusaoChamado extends Error {
  constructor(public readonly code: "NAO_ENCONTRADO" | "STATUS_INVALIDO" | "SEM_PERMISSAO" | "CONCORRENCIA") {
    const mensagens = {
      NAO_ENCONTRADO: "Chamado não encontrado.",
      STATUS_INVALIDO: "Somente chamados em atendimento podem ser finalizados.",
      SEM_PERMISSAO: "Somente o técnico que assumiu o chamado pode finalizá-lo.",
      CONCORRENCIA: "O chamado foi alterado por outro usuário. Atualize a página e tente novamente.",
    } satisfies Record<ErroConclusaoChamado["code"], string>;
    super(mensagens[code]);
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
  return db.$transaction(async (tx) => {
    const chamado = await tx.chamados.findUnique({
      where: { id: dados.chamadoId },
      select: {
        id: true,
        titulo: true,
        usuarioId: true,
        tecnicoId: true,
        status: true,
        tecnico: { select: { role: true } },
      },
    });

    if (!chamado) throw new ErroConclusaoChamado("NAO_ENCONTRADO");
    if (chamado.tecnicoId !== dados.tecnicoId) {
      throw new ErroConclusaoChamado("SEM_PERMISSAO");
    }
    if (chamado.status !== "EM_ATENDIMENTO") {
      throw new ErroConclusaoChamado("STATUS_INVALIDO");
    }

    const alteracao = await tx.chamados.updateMany({
      where: {
        id: chamado.id,
        tecnicoId: dados.tecnicoId,
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

    await tx.chamadoFeedback.create({
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
      solucao: dados.solucao ?? null,
      closedAt: dados.concluidoEm,
      updatedAt: dados.concluidoEm,
    };
  }, { isolationLevel: "Serializable" });
}
