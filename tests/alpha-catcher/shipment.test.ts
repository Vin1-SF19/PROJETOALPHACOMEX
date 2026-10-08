// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrirShipment, diagnosticoShipment } from '../../scripts/alpha-catcher-shipment.mjs';
afterEach(() => { document.body.innerHTML = ''; });
function pagina(html: string) {
  document.body.innerHTML = html;
  const buttons = Array.from(document.querySelectorAll('button'));
  const clicks = vi.fn();
  const item = (i: number) => ({ waitFor: vi.fn(), evaluate: async (fn: (button: HTMLButtonElement) => boolean) => fn(buttons[i]), click: async () => clicks(i) });
  return { clicks, page: { getByRole: () => ({ first: () => item(0), count: async () => buttons.length, nth: item, click: async () => clicks(0) }) } };
}
describe('abertura específica do Shipment Intel', () => {
  it('seleciona somente o card Shipment quando vários produtos têm Acessar', async () => {
    const { page, clicks } = pagina('<section><h2>Outro produto</h2><button>Acessar</button></section><section><h2>Shipment Intel</h2><div><button>Acessar</button></div></section>');
    await abrirShipment(page, 1000); expect(clicks).toHaveBeenCalledExactlyOnceWith(1);
  });
  it('não escolhe um produto arbitrário se os cards forem ambíguos', async () => {
    const { page, clicks } = pagina('<div><button>Acessar</button><button>Acessar</button></div>');
    await expect(abrirShipment(page, 1000)).rejects.toMatchObject({ code: 'SHIPMENT_ACCESS_AMBIGUOUS' }); expect(clicks).not.toHaveBeenCalled();
  });
  it('mantém acesso único e remove dados livres do diagnóstico', async () => {
    const { page, clicks } = pagina('<button>Acessar</button>'); await abrirShipment(page, 1000); expect(clicks).toHaveBeenCalledExactlyOnceWith(0);
    const d = diagnosticoShipment({ diagnostics: { responses: 2, statuses: { 406: 1 }, token: 'secret' } }, { message: 'secret' });
    expect(d.statuses).toEqual({ 406: 1 }); expect(JSON.stringify(d)).not.toContain('secret');
  });
});
