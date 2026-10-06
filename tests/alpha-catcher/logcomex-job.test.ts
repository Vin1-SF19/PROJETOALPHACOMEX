import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ spawn: vi.fn(), mkdir: vi.fn(), rm: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('node:fs/promises', () => ({ mkdir: mocks.mkdir, rm: mocks.rm }));
import { iniciarColeta, lerColeta, cancelarColeta, confirmarCaptcha } from '@/lib/alpha-catcher/logcomex-job';
let worker: EventEmitter & { send: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn>; connected: boolean };
const input = { data: '2026-10-05', limite: 5 };
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  worker = Object.assign(new EventEmitter(), { send: vi.fn(), kill: vi.fn(), connected: true });
  mocks.spawn.mockReturnValue(worker); mocks.mkdir.mockResolvedValue(undefined); mocks.rm.mockResolvedValue(undefined);
});
afterEach(async () => { worker.emit('close'); await Promise.resolve(); vi.clearAllTimers(); vi.useRealTimers(); });
describe('worker Shipment Intel', () => {
  it('envia só data/limite por IPC e restringe leitura ao dono', async () => {
    const job = await iniciarColeta(42, input);
    expect(worker.send).toHaveBeenCalledWith(input); expect(lerColeta(job.id, 99)).toBeNull();
    expect(lerColeta(job.id, 42)?.estado).toBe('executando');
    expect(mocks.spawn.mock.calls[0][1]).not.toContain('--password');
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
  it('lock ocupado impede iniciar outro login', async () => {
    mocks.mkdir.mockRejectedValue({ code: 'EEXIST' }); await expect(iniciarColeta(42, input)).rejects.toThrow();
    expect(mocks.spawn).not.toHaveBeenCalled(); expect(mocks.rm).not.toHaveBeenCalled();
  });
  it('encerramento inesperado marca erro e libera lock', async () => {
    const job = await iniciarColeta(42, input); worker.emit('close'); await Promise.resolve();
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
