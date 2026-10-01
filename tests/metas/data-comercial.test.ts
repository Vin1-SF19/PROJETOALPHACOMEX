import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataComercialHoje, formatarDataComercial, parseDataComercial, periodoComercialMensal } from '@/lib/comercial/data-comercial';
const db = vi.hoisted(() => ({ usuarios: { findUnique: vi.fn(), findMany: vi.fn() }, contratoComercial: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() }, metaUsuario: { findMany: vi.fn() }, metaEquipe: { findFirst: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ default: db }));
vi.mock('../../auth', () => ({ auth: vi.fn(async () => ({ user: { id: '1', role: 'Admin' } })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/actions/Clientes', () => ({ criarRegistroClienteAPartirDeContrato: vi.fn(async () => ({ criado: false })) }));
vi.mock('@/lib/pusher-server.ts', () => ({ pusherServer: { trigger: vi.fn(async () => undefined) } }));
vi.mock('@/lib/bpm/financeiro-metas', () => ({ buscarAnexosAssinadosFinanceiroPorContrato: vi.fn(async () => []) }));
import { confirmarFechamento, getContratos } from '@/actions/ContratoComercial';
import { getDadosMetas } from '@/actions/Metas';
const id = 'cmuh4n69p00000agm844kax9s';
beforeEach(() => {
    vi.clearAllMocks();
    db.usuarios.findUnique.mockResolvedValue({ role: 'Admin' });
    db.usuarios.findMany.mockResolvedValue([]);
    db.contratoComercial.findUnique.mockResolvedValue({ usuarioId: 1, servico: 'Revisão RADAR 150K' });
    db.contratoComercial.update.mockImplementation(async ({ data }) => ({ ...data, usuarioId: 1, clienteId: 'cliente', cliente: { indicacoes: [] } }));
    db.contratoComercial.findMany.mockResolvedValue([]);
    db.contratoComercial.groupBy.mockResolvedValue([]);
    db.metaUsuario.findMany.mockResolvedValue([]);
    db.metaEquipe.findFirst.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());
describe('data comercial em todo o fluxo', () => {
    it.each([
        ['2026-10-01T10:00:00Z', '2026-09-30', 2026, 9],
        ['2026-09-30T10:00:00Z', '2026-09-30', 2026, 9],
        ['2027-01-01T10:00:00Z', '2026-12-31', 2026, 12],
    ] as const)('ignora o instante de registro %s para a data escolhida %s', async (registro, escolhida, ano, mes) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(registro));
        const result = await confirmarFechamento({ id, pagamentoConfirmado: true, pagamentoConfirmadoEm: escolhida, contratoAssinado: false });
        expect(result.success).toBe(true);
        const persistida = db.contratoComercial.update.mock.calls[0][0].data.pagamentoConfirmadoEm;
        const { gte, lt } = periodoComercialMensal(ano, mes);
        expect(persistida.toISOString()).toBe(`${escolhida}T00:00:00.000Z`);
        expect(persistida >= gte && persistida < lt).toBe(true);
        const seguinte = periodoComercialMensal(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1);
        expect(persistida >= seguinte.gte && persistida < seguinte.lt).toBe(false);
    });
    it.each(['2026-09-30', '2026-10-01', '2026-12-31', '2027-01-01'])('persiste %s escolhida independentemente da data do lançamento', async (data) => {
        const result = await confirmarFechamento({ id, pagamentoConfirmado: true, pagamentoConfirmadoEm: data, contratoAssinado: false });
        expect(result.success).toBe(true);
        expect(db.contratoComercial.update.mock.calls[0][0].data.pagamentoConfirmadoEm.toISOString()).toBe(`${data}T00:00:00.000Z`);
    });
    it.each([undefined, '', '2026-02-30', '2026-9-30', '2026-09-30T10:00:00Z'])('rejeita data ausente/impossível ou instante: %s', async (data) => {
        expect((await confirmarFechamento({ id, pagamentoConfirmado: true, pagamentoConfirmadoEm: data, contratoAssinado: false })).success).toBe(false);
        expect(db.contratoComercial.update).not.toHaveBeenCalled();
    });
    it.each([[2026, 9], [2026, 10], [2026, 12], [2027, 1]])('ambas as actions usam somente pagamentoConfirmadoEm: %s/%s', async (ano, mes) => {
        await getDadosMetas(mes, ano);
        await getContratos({ mes, ano, adminView: true });
        const where = db.contratoComercial.groupBy.mock.calls[0][0].where;
        const fechado = db.contratoComercial.findMany.mock.calls.find(([args]) => args.where.status === 'FECHADO')![0].where;
        expect(where.pagamentoConfirmadoEm).toEqual(periodoComercialMensal(ano, mes));
        expect(fechado.pagamentoConfirmadoEm).toEqual(where.pagamentoConfirmadoEm);
        for (const filtro of [where, fechado]) {
            expect(filtro).not.toHaveProperty('createdAt');
            expect(filtro).not.toHaveProperty('updatedAt');
            expect(filtro).not.toHaveProperty('mes');
            expect(filtro).not.toHaveProperty('ano');
        }
    });
    it('inclui 30/09 somente em setembro e 01/10 somente em outubro', () => {
        for (const [data, mes] of [['2026-09-30', 9], ['2026-10-01', 10]] as const) {
            const valor = parseDataComercial(data)!;
            for (const periodo of [9, 10]) {
                const { gte, lt } = periodoComercialMensal(2026, periodo);
                expect(valor >= gte && valor < lt).toBe(periodo === mes);
            }
        }
        expect(formatarDataComercial(parseDataComercial('2026-09-30')!)).toBe('30/09/2026');
    });
    it('inicializa o modal no calendário do navegador', () => {
        expect(dataComercialHoje(new Date(2026, 8, 30, 23, 59))).toBe('2026-09-30');
    });
});
