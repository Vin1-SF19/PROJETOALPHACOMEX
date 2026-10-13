import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ spawn: vi.fn(), mkdir: vi.fn(), rm: vi.fn(), iniciarHistorico: vi.fn(), diagnostico: vi.fn(), coletadas: vi.fn(), terminarHistorico: vi.fn(), temErro: vi.fn() }));
vi.mock('@/lib/alpha-catcher/historico', () => ({ historicoCatcher: { iniciar: mocks.iniciarHistorico, diagnostico: mocks.diagnostico, coletadas: mocks.coletadas, terminarColeta: mocks.terminarHistorico, temErro: mocks.temErro } }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('node:fs/promises', () => ({ mkdir: mocks.mkdir, rm: mocks.rm }));
import { iniciarColeta, lerColeta, cancelarColeta, confirmarCaptcha } from '@/lib/alpha-catcher/logcomex-job';
let worker: EventEmitter & { send: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn>; connected: boolean };
const input = { data: '2026-10-05', limite: 5 };
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  worker = Object.assign(new EventEmitter(), { send: vi.fn(), kill: vi.fn(), connected: true });
  mocks.iniciarHistorico.mockResolvedValue(undefined); mocks.diagnostico.mockResolvedValue(undefined); mocks.terminarHistorico.mockResolvedValue(undefined); mocks.temErro.mockReturnValue(false);
  mocks.spawn.mockReturnValue(worker); mocks.mkdir.mockResolvedValue(undefined); mocks.rm.mockResolvedValue(undefined);
});
afterEach(async () => { worker.emit('close'); await Promise.resolve(); await Promise.resolve(); vi.clearAllTimers(); vi.useRealTimers(); });
describe('worker Shipment Intel', () => {
  it('envia só data/limite por IPC e restringe leitura ao dono', async () => {
    const job = await iniciarColeta(42, input);
    expect(worker.send).toHaveBeenCalledWith(input); expect(lerColeta(job.id, 99)).toBeNull();
    expect(lerColeta(job.id, 42)?.estado).toBe('executando');
    expect(mocks.spawn.mock.calls[0][1]).not.toContain('--password');
  });
  it('disponibiliza pares e progresso durante a coleta sem expor campos extras', async () => {
    const job = await iniciarColeta(42, input);
    worker.emit('message', { type: 'empresa', empresa: { cnpj: '33000167000101', consignatario: 'Banco', token: 'secret' } });
    worker.emit('message', { type: 'empresa', empresa: { cnpj: '33000167000101', consignatario: 'Banco' } });
    worker.emit('message', { type: 'progresso', progresso: { fase: 'perfis', totalLista: 150, total: 150, coletadas: 1, cnpjs: 1, paginas: 2, paginasTotal: 2, token: 'secret' } });
    const atual = lerColeta(job.id, 42);
    expect(atual?.estado).toBe('executando');
    expect(atual?.empresas?.empresas).toHaveLength(1);
    expect(atual?.progresso?.totalLista).toBe(150);
    expect(mocks.coletadas).toHaveBeenCalledWith(job.id, 42, [{ cnpj: '33000167000101', consignatario: 'Banco' }]);
    expect(JSON.stringify(atual)).not.toContain('secret');
  });
  it('aceita snapshots automáticos acima de 10 mil entradas no modo ilimitado', async () => {
    const job = await iniciarColeta(42, { ...input, limite: 0 });
    const resultado = { empresas: Array.from({ length: 10001 }, () => ({ cnpj: '33000167000101', consignatario: 'Banco' })) };
    worker.emit('message', { type: 'parcial', resultado });
    expect(lerColeta(job.id, 42)?.empresas?.duplicados).toBe(10000);
    worker.emit('message', { type: 'resultado', completo: true, resultado });
    expect(lerColeta(job.id, 42)?.estado).toBe('concluido');
    expect(lerColeta(job.id, 42)?.empresas?.duplicados).toBe(10000);
  });
  it('mantém a coleta além de 30 minutos e encerra no limite absoluto configurado', async () => {
    const job = await iniciarColeta(42, input);
    for (let i = 0; i < 23; i++) {
      await vi.advanceTimersByTimeAsync(20 * 60000);
      worker.emit('message', { type: 'etapa', etapa: 'coleta' });
      if (i === 1) expect(lerColeta(job.id, 42)?.estado).toBe('executando');
    }
    await vi.advanceTimersByTimeAsync(20 * 60000);
    expect(lerColeta(job.id, 42)?.estado).toBe('erro');
    expect(lerColeta(job.id, 42)?.mensagem).toContain('8 horas');
  });
  it('não retransmite campos secretos da coleta', async () => {
    const job = await iniciarColeta(42, input);
    worker.emit('message', { type: 'resultado', completo: true, resultado: { token: 'secret', empresas: [{ cnpj: '33000167000101', consignatario: 'Banco', authorization: 'secret' }] } });
    const result = lerColeta(job.id, 42);
    expect(result?.estado).toBe('concluido'); expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('preserva dados parciais no cancelamento e não permite cancelar job de outro usuário', async () => {
    const job = await iniciarColeta(42, input);
    worker.emit('message', { type: 'parcial', resultado: { empresas: [{ cnpj: '33000167000101', consignatario: 'Banco' }] } });
    expect(cancelarColeta(job.id, 99)).toBe(false); expect(worker.kill).not.toHaveBeenCalled();
    expect(cancelarColeta(job.id, 42)).toBe(true); expect(worker.kill).toHaveBeenCalledWith('SIGTERM');
    expect(lerColeta(job.id, 42)?.empresas?.empresas).toHaveLength(1);
  });
  it('resultado sem empresas mostra a falha observada no ranking', async () => {
    const job = await iniciarColeta(42, input);
    worker.emit('message', { type: 'resultado', completo: false, resultado: { empresas: [] }, diagnostico: { status: 'interrompido', recebidas: 0, semCnpj: 0, paginas: 0, falhas: ['http_429'] } });
    expect(lerColeta(job.id, 42)?.estado).toBe('erro');
    expect(lerColeta(job.id, 42)?.mensagem).toContain('HTTP 429');
    expect(lerColeta(job.id, 42)?.mensagem).toContain('Nenhuma empresa válida');
  });
  it('lock ocupado impede iniciar outro login', async () => {
    mocks.mkdir.mockRejectedValue({ code: 'EEXIST' }); await expect(iniciarColeta(42, input)).rejects.toThrow();
    expect(mocks.spawn).not.toHaveBeenCalled(); expect(mocks.rm).not.toHaveBeenCalled();
  });
  it('encerramento inesperado marca erro e libera lock', async () => {
    const job = await iniciarColeta(42, input); worker.emit('close');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(lerColeta(job.id, 42)?.estado).toBe('erro'); expect(mocks.rm).toHaveBeenCalled();
  });
  it('confirmação solicita checagem uma vez e nunca declara liberação por clique', async () => {
    const job = await iniciarColeta(42, input);
    worker.emit('message', { type: 'captcha', estado: 'necessario' });
    expect(confirmarCaptcha(job.id, 99, 'confirmar_captcha')).toBe(false);
    expect(confirmarCaptcha(job.id, 42, 'confirmar_captcha')).toBe(true);
    expect(worker.send).toHaveBeenLastCalledWith({ acao: 'confirmar_captcha' }, expect.any(Function));
    expect(lerColeta(job.id, 42)?.captcha).toBe('verificando');
    expect(confirmarCaptcha(job.id, 42, 'tentar_captcha')).toBe(false);
    worker.emit('message', { type: 'captcha', estado: 'nao_confirmado' });
    expect(confirmarCaptcha(job.id, 42, 'tentar_captcha')).toBe(true);
  });
  it('ignora estados de CAPTCHA arbitrários', async () => {
    const job = await iniciarColeta(42, input); worker.emit('message', { type: 'captcha', estado: 'secret' });
    expect(lerColeta(job.id, 42)?.captcha).toBeUndefined();
  });
});
