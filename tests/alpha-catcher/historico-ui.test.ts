// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import HistoricoConsultas from '@/app/PainelAlpha/AlphaCatcher/HistoricoConsultas';
import { getTema } from '@/lib/temas';
let root: Root;
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
it('carrega resumo persistido com horários, coletadas incluindo existentes, novas e filtros', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const item = { versao: 1, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', inicio: '2026-10-06T15:00:00Z', fim: '2026-10-06T15:20:00Z', fimColeta: '2026-10-06T15:15:00Z', estado: 'concluido', dataInicio: '2026-03-29', dataFinal: '2026-09-29', embarquesMin: 1, embarquesMax: 2, limite: 0, totalColetadas: 100, novasSalvas: 20, processadas: 100, pendentes: 0 };
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ importacoes: [item], proximoCursor: null }) }));
  vi.stubGlobal('fetch', fetcher);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(HistoricoConsultas, { visual: getTema('blue'), emAndamento: false, aviso: '' })));
  expect(fetcher).toHaveBeenCalledWith('/api/alpha-catcher/historico', expect.objectContaining({ cache: 'no-store' }));
  expect(host.textContent).toContain('06/10/2026, 12:00'); expect(host.textContent).toContain('06/10/2026, 12:20');
  expect(host.textContent).toContain('Empresas coletadas (inclui já salvas)100');
  expect(host.textContent).toContain('Novas adicionadas ao banco20');
  expect(host.textContent).toContain('29/03/2026 a 29/09/2026');
  expect(host.textContent).toContain('Embarques mínimos1'); expect(host.textContent).toContain('Embarques máximos2');
});
it('exibe JSON recuperado sem inventar horários, contagem de novas ou filtros Logcomex', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const item = { versao: 1, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', origem: 'JSON', arquivo: 'empresas.json', recuperadoEm: '2026-10-08T17:00:00Z', inicio: null, fim: null, fimColeta: null,
    estado: 'concluido', dataInicio: '2026-09-28', dataFinal: '2026-09-28', dataConsultaJson: '2026-09-28', embarquesMin: 0, embarquesMax: 0, limite: 0, totalColetadas: 2491, novasSalvas: null, processadas: 2491, pendentes: 0, listaDisponivel: true };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ importacoes: [item], proximoCursor: null }) })));
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(HistoricoConsultas, { visual: getTema('blue'), emAndamento: false, aviso: '' })));
  expect(host.textContent).toContain('JSON · empresas.json');
  expect(host.textContent).toContain('2491');
  expect(host.textContent).toContain('Novas adicionadas ao bancoNão registrado');
  expect(host.textContent).toContain('Histórico recuperado');
  expect(host.textContent).not.toContain('Embarques mínimos');
});
