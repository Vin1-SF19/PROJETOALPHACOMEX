import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { coletaSchema, janelaMeses, dataMaximaColeta } from '@/lib/alpha-catcher/logcomex-input';
import { fetchComPeriodo } from '../../scripts/alpha-catcher-filters.mjs';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T15:00:00Z')); });
afterEach(() => vi.useRealTimers());
const base = { data: '2026-10-06', limite: 5 };
describe('filtros Shipment Intel', () => {
  it('calcula sete dias pelo dia local de São Paulo', () => {
    expect(dataMaximaColeta(new Date('2026-10-06T02:59:00Z'))).toBe('2026-09-28');
    expect(dataMaximaColeta(new Date('2026-10-06T03:00:00Z'))).toBe('2026-09-29');
  });
  it('valida o limite inclusivo e os dois extremos do intervalo', () => {
    expect(coletaSchema.safeParse({ ...base, data: '2026-10-25', dataInicio: '2026-10-01', dataFinal: '2026-10-25' }).success).toBe(true);
    expect(coletaSchema.safeParse({ ...base, dataInicio: '2026-10-01', dataFinal: '2026-10-26' }).success).toBe(false);
    expect(coletaSchema.safeParse({ ...base, data: '2026-11-02' }).success).toBe(false);
  });
  it('omitir o limite assume coleta sem limite', () => {
    expect(coletaSchema.parse({ data: base.data, limite: 0 }).limite).toBe(0);
    expect(coletaSchema.parse({ data: base.data }).limite).toBe(0);
  });
  it('preserva os defaults da faixa antiga', () => {
    expect(coletaSchema.parse(base)).toMatchObject({ embarquesMin: 1, embarquesMax: 2 });
  });
  it.each([
    { embarquesMin: -1 }, { embarquesMax: 1.5 }, { embarquesMin: 10, embarquesMax: 2 },
    { embarquesMin: '1' }, { dataInicio: '2026-10-07', dataFinal: '2026-10-06' },
    { dataInicio: '2026-10-06' }, { dataInicio: '2026-02-30', dataFinal: '2026-10-06' },
  ])('rejeita filtros inválidos %j', filtros => expect(coletaSchema.safeParse({ ...base, ...filtros }).success).toBe(false));
  it('aceita um único dia e faixa personalizada', () => {
    expect(coletaSchema.safeParse({ ...base, dataInicio: base.data, dataFinal: base.data, embarquesMin: 5, embarquesMax: 30 }).success).toBe(true);
  });
  it('ajusta o último dia de fevereiro', () => {
    expect(janelaMeses('2026-05-31', 3)).toEqual({ dataInicio: '2026-02-28', dataFinal: '2026-05-31' });
    expect(janelaMeses('2024-08-31', 6)).toEqual({ dataInicio: '2024-02-29', dataFinal: '2024-08-31' });
  });
  it('atravessa o ano incluindo o dia selecionado', () => {
    expect(janelaMeses('2026-01-15', 6)).toEqual({ dataInicio: '2025-07-15', dataFinal: '2026-01-15' });
  });
  it.each(['dataset/ranking', 'profile/empresa'])('envia o intervalo exato para %s sem alterar demais filtros ou autenticação', async endpoint => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    const periodo = { dataInicio: '2026-10-06', dataFinal: '2026-10-06' };
    const options = { headers: { authorization: 'Bearer teste' }, body: JSON.stringify({ filters: [{ field: 'data_operacao', value: ['antigo', 'antigo'] }, { field: 'embarque', value: ['DIRETO', 'HOUSE'] }], summaryFilters: [{ value: ['5', '30'] }] }) };
    await fetchComPeriodo(periodo, fetcher)(endpoint, options);
    const enviado = fetcher.mock.calls[0][1];
    expect(enviado.headers).toEqual(options.headers);
    expect(JSON.parse(enviado.body)).toEqual({ filters: [{ field: 'data_operacao', value: [periodo.dataInicio, periodo.dataFinal] }, { field: 'embarque', value: ['DIRETO', 'HOUSE'] }], summaryFilters: [{ value: ['5', '30'] }] });
  });
  it('falha antes de consultar quando o coletor omite o filtro esperado', () => {
    const fetcher = vi.fn();
    expect(() => fetchComPeriodo({}, fetcher)('url', { body: '{}' })).toThrow(); expect(fetcher).not.toHaveBeenCalled();
  });
});
