// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
vi.mock('@/components/ComponentesRadar/RadarBackground', () => ({ default: () => null }));
vi.mock('@/components/ComponentesRadar/CardComScan', () => ({ CardComScan: ({ children }: { children: unknown }) => children }));
vi.mock('@/app/PainelAlpha/AlphaCatcher/CalendarioColeta', () => ({ default: () => null }));
import CatcherClient from '@/app/PainelAlpha/AlphaCatcher/CatcherClient';
let root: Root;
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
describe('fila durante download da Logcomex', () => {
  it('exibe diagnóstico sob demanda sem iniciar uma consulta de empresa', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const resultado = {
      verificadoEm: '2026-10-13T20:00:00.000Z',
      worker: { estado: 'disponivel', mensagem: 'Worker respondeu à verificação autenticada.' },
      receitaWS: { estado: 'inconclusivo', mensagem: 'Configuração válida; disponibilidade externa não confirmada.' },
      radar: { estado: 'problema', mensagem: 'Credencial não configurada.' },
    };
    const fetcher = vi.fn(async (url: string) => {
      if (url === '/api/alpha-catcher/historico') return { ok: true, json: async () => ({ importacoes: [], proximoCursor: null }) };
      if (url === '/api/alpha-catcher/diagnostico') return { ok: true, status: 200, json: async () => resultado };
      throw new Error(`Requisição inesperada: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(createElement(CatcherClient, { temaInicial: 'blue' })));
    const botao = [...host.querySelectorAll('button')].find(element => element.textContent?.includes('Verificar APIs'))!;
    await act(async () => botao.click());
    expect(fetcher.mock.calls.filter(call => call[0] === '/api/alpha-catcher/diagnostico')).toHaveLength(1);
    expect(fetcher.mock.calls.some(call => call[0] === '/api/alpha-catcher')).toBe(false);
    expect(host.textContent).toContain('Worker · Disponível');
    expect(host.textContent).toContain('ReceitaWS · Não foi possível verificar');
    expect(host.textContent).toContain('Radar · Com problema');
  });

  it.each([false, true])('consulta durante a coleta, preserva resultados e respeita pausa=%s', async pausar => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    let terminou = false;
    const empresa = { cnpj: '33000167000101', consignatario: 'Banco' };
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/alpha-catcher') {
        expect(terminou).toBe(false);
        return { ok: true, status: 200, json: async () => ({ ...empresa, estado: 'salvo', razaoSocial: 'BANCO', nomeFantasia: 'FANTASIA BANCO', dataConsulta: '2025-04-10T14:30:00.000Z', uf: 'DF', municipio: 'Brasília', regimeTributario: pausar ? 'Simples Nacional' : 'Regime Normal', optanteSimples: pausar, dataOpcao: '2020-01-01T00:00:00.000Z' }) };
      }
      if (init?.method === 'POST') return { ok: true, json: async () => ({ id: 'job' }) };
      return { ok: true, json: async () => ({ estado: terminou ? 'concluido' : 'executando', etapa: 'Coletando', empresas: { empresas: [empresa], invalidos: 0, duplicados: 0 }, progresso: { fase: 'perfis', totalLista: 200, total: 200, coletadas: 1, cnpjs: 1, paginas: 2, paginasTotal: 2 } }) };
    });
    vi.stubGlobal('fetch', fetcher);
    const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(createElement(CatcherClient, { temaInicial: 'blue' })));
    const cabecalhoData = host.querySelector('thead th')!;
    expect(cabecalhoData.textContent).toBe('Data da consulta');
    expect([...host.querySelectorAll('thead th')].map(e => e.textContent)).toEqual(['Data da consulta', 'CNPJ', 'Razão social', 'Nome fantasia', 'Processamento', 'Situação Radar', 'Modalidade', 'UF', 'Município', 'Regime tributário', 'Data da opção', 'Capital social']);
    expect(host.textContent).not.toContain('Ordenar por');
    await act(async () => (cabecalhoData.querySelector('button')!).click());
    expect(cabecalhoData.getAttribute('aria-sort')).toBe('ascending');
    await act(async () => (cabecalhoData.querySelector('button')!).click());
    expect(cabecalhoData.getAttribute('aria-sort')).toBe('descending');
    const botao = [...host.querySelectorAll('button')].find(e => e.textContent?.includes('Importar automaticamente'))!;
    await act(async () => botao.click());
    if (pausar) await act(async () => [...host.querySelectorAll('button')].find(e => e.textContent === 'Pausar')!.click());
    await act(async () => { await vi.advanceTimersByTimeAsync(2250); });
    if (pausar) {
      expect(fetcher.mock.calls.filter(c => c[0] === '/api/alpha-catcher')).toHaveLength(0);
      expect(host.textContent).toContain('Lista Logcomex: 200 empresas');
      await act(async () => [...host.querySelectorAll('button')].find(e => e.textContent === 'Retomar')!.click());
      await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    }
    expect(fetcher.mock.calls.filter(c => c[0] === '/api/alpha-catcher')).toHaveLength(1);
    expect(host.textContent).toContain('Lista Logcomex: 200 empresas');
    expect(host.querySelector('tbody')?.textContent).toContain('Salva');
    terminou = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(2250); });
    expect(fetcher.mock.calls.filter(c => c[0] === '/api/alpha-catcher')).toHaveLength(1);
    expect(host.querySelector('tbody')?.textContent).toContain('Salva');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host.querySelector('time')?.getAttribute('datetime')).toBe('2025-04-10T14:30:00.000Z');
    expect(host.querySelector('time')?.textContent).toBe('10/04/2025, 11:30');
    expect(host.querySelector('tbody tr td:first-child time')).not.toBeNull();
    const celulas = [...host.querySelectorAll('tbody tr td')];
    expect(celulas[2].textContent).toBe('BANCO');
    expect(celulas[3].textContent).toBe('FANTASIA BANCO');
    expect(celulas[7].textContent).toBe('DF');
    expect(celulas[8].textContent).toBe('Brasília');
    expect(celulas[9].textContent).toBe(pausar ? 'Simples Nacional' : 'Regime Normal');
    expect(celulas[10].textContent).toBe(pausar ? '01/01/2020' : '—');
  });
  it('continua uma importação parcial sem reconsultar empresa já salva', async () => {
    vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const anterior = { cnpj: '33000167000101', consignatario: 'Banco', estado: 'salvo', razaoSocial: 'BANCO' };
    const nova = { cnpj: '11222333000181', consignatario: 'Nova' };
    const importacao = { versao: 1, id, inicio: '2026-10-13T12:26:00Z', fim: null, fimColeta: '2026-10-13T12:56:00Z', estado: 'erro', origem: 'LOGCOMEX', listaDisponivel: true, podeRetomar: true,
      dataInicio: '2026-07-06', dataFinal: '2026-10-06', embarquesMin: 1, embarquesMax: 2, limite: 0, totalColetadas: 1, novasSalvas: 1, processadas: 1, pendentes: 0 };
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/alpha-catcher/historico') return { ok: true, json: async () => ({ importacoes: [importacao], proximoCursor: null }) };
      if (url.endsWith(`/historico/${id}`)) return { ok: true, json: async () => ({ importacao, linhas: [anterior] }) };
      if (url === '/api/alpha-catcher/logcomex' && init?.method === 'POST') return { ok: true, json: async () => ({ id }) };
      if (url.startsWith('/api/alpha-catcher/logcomex?id=')) return { ok: true, json: async () => ({ estado: 'concluido', etapa: 'Coleta concluída.', totalEmpresas: 2,
        empresas: { empresas: [nova], invalidos: 0, duplicados: 0 } }) };
      if (url === '/api/alpha-catcher') return { ok: true, status: 200, json: async () => ({ ...nova, estado: 'salvo' }) };
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(createElement(CatcherClient, { temaInicial: 'blue' })));
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Continuar coleta')!.click());
    const inicio = fetcher.mock.calls.find(call => call[0] === '/api/alpha-catcher/logcomex' && call[1]?.method === 'POST');
    expect(JSON.parse(String(inicio?.[1]?.body))).toEqual({ acao: 'retomar', id });
    await act(async () => { await vi.advanceTimersByTimeAsync(2250); });
    const consultas = fetcher.mock.calls.filter(call => call[0] === '/api/alpha-catcher');
    expect(consultas).toHaveLength(1);
    expect(JSON.parse(String(consultas[0][1]?.body)).cnpj).toBe(nova.cnpj);
    expect(fetcher.mock.calls.some(call => String(call[0]).includes(`desde=1`))).toBe(true);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('restaura pendências do histórico para habilitar Iniciar e salvar sem iniciar outra coleta Logcomex', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const empresa = { cnpj: '08429993000123', consignatario: 'Aguardando', estado: 'aguardando' };
    const importacao = { versao: 1, id, inicio: '2026-10-13T12:26:00Z', fim: null, fimColeta: '2026-10-13T12:56:00Z', estado: 'interrompido', origem: 'LOGCOMEX', listaDisponivel: true,
      dataInicio: '2026-07-06', dataFinal: '2026-10-06', embarquesMin: 1, embarquesMax: 2, limite: 0, totalColetadas: 1, novasSalvas: 0, processadas: 0, pendentes: 1 };
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/alpha-catcher/historico') return { ok: true, json: async () => ({ importacoes: [importacao], proximoCursor: null }) };
      if (url.endsWith(`/historico/${id}`)) return { ok: true, json: async () => ({ importacao, linhas: [empresa] }) };
      if (url === '/api/alpha-catcher' && init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ ...empresa, estado: 'salvo' }) };
      throw new Error(`Requisição inesperada: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(createElement(CatcherClient, { temaInicial: 'blue' })));
    await act(async () => (host.querySelector('[aria-label^="Abrir lista"]') as HTMLElement).click());
    await act(async () => [...document.body.querySelectorAll('button')].find(button => button.textContent?.includes('Carregar pendentes no monitor'))!.click());
    const iniciar = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Iniciar e salvar'))! as HTMLButtonElement;
    expect(iniciar.disabled).toBe(false);
    await act(async () => iniciar.click());
    const processar = fetcher.mock.calls.find(call => call[0] === '/api/alpha-catcher' && call[1]?.method === 'POST');
    expect(JSON.parse(String(processar?.[1]?.body))).toMatchObject({ cnpj: empresa.cnpj, historicoId: id });
    expect(fetcher.mock.calls.some(call => call[0] === '/api/alpha-catcher/logcomex')).toBe(false);
  });
});
