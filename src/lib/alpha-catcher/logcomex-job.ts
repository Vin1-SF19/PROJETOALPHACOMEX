import 'server-only';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { importarEmpresas } from './core';
import type { ColetaInput } from './logcomex-input';

type Job = { id: string; userId: number; estado: 'executando' | 'concluido' | 'erro' | 'cancelado'; etapa: string;
  captcha?: 'necessario' | 'verificando' | 'nao_confirmado' | 'erro' | 'liberado';
  empresas?: ReturnType<typeof importarEmpresas>; mensagem?: string; atualizado: number };
const globals = globalThis as typeof globalThis & { catcherJobs?: Map<string, Job>; catcherCancel?: Map<string, () => void>; catcherCaptcha?: Map<string, (acao: string) => void> };
globals.catcherJobs ??= new Map(); globals.catcherCancel ??= new Map();
globals.catcherCaptcha ??= new Map();
const jobs = globals.catcherJobs, cancelar = globals.catcherCancel;
const lock = resolve(tmpdir(), 'painel-alpha-logcomex-login.lock');

export function confirmarCaptcha(id: string, userId: number, acao: 'confirmar_captcha' | 'tentar_captcha') {
  const job = lerColeta(id, userId);
  if (!job || job.estado !== 'executando' || !job.captcha || ['liberado', 'verificando'].includes(job.captcha)) return false;
  const enviar = globals.catcherCaptcha!.get(id);
  if (!enviar) return false;
  job.captcha = 'verificando'; job.atualizado = Date.now(); enviar(acao); return true;
}

export function lerColeta(id: string, userId: number) {
  const job = jobs.get(id);
  if (!job || job.userId !== userId) return null;
  return job;
}
export function cancelarColeta(id: string, userId: number) {
  const job = lerColeta(id, userId);
  if (!job || job.estado !== 'executando') return false;
  cancelar.get(id)?.(); return true;
}

export async function iniciarColeta(userId: number, input: ColetaInput) {
  // Lock entre processos do mesmo host; não apagar automaticamente lock de outro worker.
  try { await mkdir(lock); } catch { throw new Error('Outra coleta está em execução ou existe um lock pendente. Aguarde a conclusão.'); }
  const id = randomUUID();
  const job: Job = { id, userId, estado: 'executando', etapa: 'Preparando acesso à Logcomex', atualizado: Date.now() };
  for (const [key, value] of jobs) if (value.estado !== 'executando' && Date.now() - value.atualizado > 3600000) jobs.delete(key);
  jobs.set(id, job);
  try {
    const worker = spawn(process.execPath, ['--import', 'tsx', resolve(process.cwd(), 'scripts/alpha-catcher-logcomex.mjs')], {
      cwd: process.cwd(), env: { ...process.env, LOGCOMEX_HEADLESS: 'true' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let encerrando = false;
    const timeout = setTimeout(() => {
      if (job.estado === 'executando') parar('erro', 'A coleta excedeu 30 minutos. Os resultados já recebidos foram preservados.');
      else worker.kill('SIGKILL');
    }, 30 * 60 * 1000);
    const parar = (estado: 'erro' | 'cancelado', mensagem: string) => {
      if (job.estado !== 'executando') return;
      job.estado = estado; job.mensagem = mensagem;
      worker.kill('SIGTERM');
      const killTimer = setTimeout(() => { if (!encerrando) worker.kill('SIGKILL'); }, 5000); killTimer.unref();
    };
    const fechar = async () => {
      if (encerrando) return; encerrando = true;
      clearTimeout(timeout); cancelar.delete(id); globals.catcherCaptcha!.delete(id);
      if (job.estado === 'executando') { job.estado = 'erro'; job.mensagem = 'A automação encerrou sem concluir. Confira a configuração e autorização do Gmail.'; }
      job.atualizado = Date.now(); await rm(lock, { recursive: true, force: true });
    };
    cancelar.set(id, () => parar('cancelado', 'Coleta interrompida.'));
    globals.catcherCaptcha!.set(id, acao => {
      if (!worker.connected) { job.captcha = 'erro'; return; }
      worker.send({ acao }, error => { if (error) job.captcha = 'erro'; });
    });
    worker.on('message', (message: unknown) => {
      if (!message || typeof message !== 'object' || job.estado !== 'executando') return;
      const data = message as Record<string, unknown>;
      // Não retransmitir logs ou mensagens das bibliotecas: podem conter credenciais.
      const etapas: Record<string, string> = { gmail: 'Conectando ao Gmail autorizado', captcha_check: 'Verificando requisito de CAPTCHA', login: 'Entrando na Logcomex', otp: 'Aguardando código recebido pelo Gmail', shipment: 'Abrindo Shipment Intel', coleta: 'Coletando consignatários e CNPJs' };
      if (data.type === 'etapa' && typeof data.etapa === 'string' && etapas[data.etapa]) job.etapa = etapas[data.etapa];
      const captchaEstados = ['necessario', 'verificando', 'nao_confirmado', 'erro', 'liberado'] as const;
      if (data.type === 'captcha' && captchaEstados.some(estado => estado === data.estado)) {
        job.captcha = data.estado as typeof captchaEstados[number];
        job.etapa = job.captcha === 'liberado' ? 'CAPTCHA liberado. Continuando login…' : 'Aguardando resolução do CAPTCHA na Logcomex';
      }
      if (data.type === 'parcial') {
        try { job.empresas = importarEmpresas(data.resultado); } catch { /* Não substituir snapshot válido. */ }
      }
      if (data.type === 'resultado') {
        try {
          job.empresas = importarEmpresas(data.resultado);
          job.estado = data.completo === true ? 'concluido' : 'erro';
          job.mensagem = data.completo === true ? 'Coleta concluída.' : 'Coleta parcial. Confira os resultados antes de processar.';
        } catch { job.estado = 'erro'; job.mensagem = 'Resultado inválido da coleta.'; }
      }
      if (data.type === 'erro') { job.estado = 'erro'; job.mensagem = 'Não foi possível concluir o acesso ou a coleta. Confira credenciais, Gmail, Chromium e eventual CAPTCHA.'; }
      job.atualizado = Date.now();
    });
    worker.on('error', () => { void fechar(); }); worker.on('close', () => { void fechar(); });
    worker.send(input);
    return job;
  } catch {
    jobs.delete(id); await rm(lock, { recursive: true, force: true });
    throw new Error('Não foi possível iniciar o processo da automação.');
  }
}
