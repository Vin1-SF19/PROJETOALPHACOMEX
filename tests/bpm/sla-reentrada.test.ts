import { describe, expect, it, vi } from 'vitest';
import { criarSlaInstancia, sincronizarSlaMovimentoBpm } from '@/lib/bpm/sla';

type Client = Parameters<typeof criarSlaInstancia>[2];
type Existing = { id: string; status: string; concluidoEm: Date | null; slaConfig: { pausaCondicaoJson: null } };
function fixture(status = 'DENTRO_PRAZO', concluidoEm: Date | null = null) {
  const existing: Existing = { id: 'ciclo-anterior', status, concluidoEm, slaConfig: { pausaCondicaoJson: null } };
  const config = { id: 'config', pipelineId: 'pipeline', etapaId: 'etapa', quantidade: 1, unidade: 'DIAS', prioridade: 0, condicaoRegraJson: null };
  const findFirst = vi.fn(async ({ where }: { where: { concluidoEm?: null; status?: { notIn: string[] } } }) => {
    if (where.concluidoEm === null && existing.concluidoEm !== null) return null;
    if (where.status?.notIn.includes(existing.status)) return null;
    return existing;
  });
  const create = vi.fn(async ({ data }) => ({ id: 'novo-ciclo', ...data }));
  const findMany = vi.fn(async () => existing.concluidoEm ? [] : [existing]);
  const updateMany = vi.fn(async ({ data }) => { Object.assign(existing, data); return { count: 1 }; });
  const configs = vi.fn(async () => [config]);
  const client = {
    bpmCard: { findUnique: vi.fn(async () => ({ id: 'card', pipelineId: 'pipeline', etapaId: 'etapa', servico: null, pipeline: { nome: 'Pipeline' }, etapa: { nome: 'Etapa' } })) },
    bpmSlaConfig: { findMany: configs },
    bpmSlaInstancia: { findFirst, create, findMany, updateMany },
    bpmSlaEventoLog: { create: vi.fn(async () => ({})) },
  } as unknown as Client;
  return { client, existing, create, findFirst, config, configs };
}

describe('novo ciclo do SLA ao retornar à etapa', () => {
  it('inicia SLA da etapa inicial na data de criação de um card novo', async () => {
    const f = fixture();
    f.findFirst.mockResolvedValueOnce(null);
    const criadoEm = new Date('2026-10-14T15:00:00Z');
    await criarSlaInstancia({ cardId: 'card' }, 'ENTRADA_ETAPA', f.client, criadoEm);
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      inicioContagem: criadoEm, deadline: new Date('2026-10-15T15:00:00Z'),
      eventos: { create: { statusNovo: 'DENTRO_PRAZO', motivo: 'ENTRADA_ETAPA', origem: 'SISTEMA' } },
    }) }));
  });

  it('encerra o ciclo de saída e inicia outro com o prazo contado da reentrada', async () => {
    const f = fixture();
    const agora = new Date('2026-10-14T12:00:00Z');
    f.configs.mockResolvedValueOnce([]);
    await sincronizarSlaMovimentoBpm({ cardId: 'card', etapaOrigemId: 'etapa', etapaOrigemNome: 'Etapa', etapaDestinoNome: 'Outra etapa', client: f.client, agora });
    expect(f.existing.status).toBe('CONCLUIDO');
    expect(f.existing.concluidoEm).toEqual(agora);
    expect(f.create).not.toHaveBeenCalled();
    const retorno = new Date('2026-10-16T12:00:00Z');
    await sincronizarSlaMovimentoBpm({ cardId: 'card', etapaOrigemId: 'outra', etapaOrigemNome: 'Outra etapa', etapaDestinoNome: 'Etapa', client: f.client, agora: retorno });
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ inicioContagem: retorno, prazoFinal: new Date('2026-10-17T12:00:00Z'), status: 'DENTRO_PRAZO' }) }));
  });

  it.each(['DENTRO_PRAZO', 'ATRASADO', 'PAUSADO', 'AGUARDANDO_INICIO'])('reutiliza ciclo aberto %s sem redefinir prazo', async status => {
    const f = fixture(status);
    expect(await criarSlaInstancia({ cardId: 'card' }, 'ENTRADA_ETAPA', f.client)).toBe(f.existing);
    expect(f.create).not.toHaveBeenCalled();
  });

  it.each(['CONCLUIDO', 'CANCELADO'])('não reutiliza ciclo encerrado %s mesmo sem data de conclusão', async status => {
    const f = fixture(status);
    expect((await criarSlaInstancia({ cardId: 'card' }, 'ENTRADA_ETAPA', f.client))?.id).toBe('novo-ciclo');
  });

  it('não reutiliza ciclo com data de conclusão mesmo que o status esteja inconsistente', async () => {
    const f = fixture('DENTRO_PRAZO', new Date('2026-10-13T12:00:00Z'));
    await criarSlaInstancia({ cardId: 'card' }, 'ENTRADA_ETAPA', f.client);
    expect(f.create).toHaveBeenCalledOnce();
  });

  it.each(['MANUAL', 'CRIACAO_CARD', 'TAREFA_CONCLUIDA'] as const)('preserva idempotência anterior do gatilho %s', async gatilho => {
    const f = fixture('CONCLUIDO', new Date());
    expect(await criarSlaInstancia({ cardId: 'card' }, gatilho, f.client)).toBe(f.existing);
    expect(f.create).not.toHaveBeenCalled();
  });

  it('usa o mesmo filtro de ciclo aberto ao recuperar conflito de unicidade', async () => {
    const f = fixture('CONCLUIDO');
    f.create.mockRejectedValueOnce({ code: 'P2002' });
    await criarSlaInstancia({ cardId: 'card' }, 'ENTRADA_ETAPA', f.client);
    expect(f.findFirst).toHaveBeenCalledTimes(2);
    expect(f.findFirst.mock.calls[1][0]).toEqual(f.findFirst.mock.calls[0][0]);
  });
});
