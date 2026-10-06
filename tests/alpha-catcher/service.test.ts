import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma', () => ({ default: { consultas_radar: { findUnique: vi.fn(), create: vi.fn() } } }));
import { processarEmpresa, EsperaCatcher } from '@/lib/alpha-catcher/service';
import { ErroConsultaRadar } from '@/lib/radar/consulta';

const empresa = { cnpj: '33000167000101', consignatario: 'Banco' };
const row = { razao_social: 'BANCO', situacao_radar: 'DEFERIDA', submodalidade: 'ILIMITADA', municipio: 'Brasília', uf: 'DF' };
function dependencias() {
  return {
    buscar: vi.fn().mockResolvedValue(null), salvar: vi.fn().mockResolvedValue(row), admitir: vi.fn().mockReturnValue(0),
    receita: vi.fn().mockResolvedValue({ status: 'OK', cnpj: empresa.cnpj, nome: 'Banco', simples: { optante: false } }),
    radar: vi.fn().mockResolvedValue({ situacao: 'DEFERIDA', submodalidade: 'ILIMITADA' }),
  };
}
describe('processamento Alpha Catcher', () => {
  it('reaproveita qualquer registro existente sem API ou gravação', async () => {
    const deps = dependencias(); deps.buscar.mockResolvedValue(row);
    expect((await processarEmpresa(empresa, deps)).estado).toBe('existente');
    expect(deps.receita).not.toHaveBeenCalled(); expect(deps.radar).not.toHaveBeenCalled();
    expect(deps.salvar).not.toHaveBeenCalled(); expect(deps.admitir).not.toHaveBeenCalled();
  });
  it('salva a combinação das APIs com a origem', async () => {
    const deps = dependencias();
    expect((await processarEmpresa(empresa, deps)).estado).toBe('salvo');
    expect(deps.salvar).toHaveBeenCalledWith(expect.objectContaining({ cnpj: empresa.cnpj, regime_tributario: 'Regime Normal', optante_simples: false, fonte: expect.stringContaining('ALPHA_CATCHER') }));
  });
  it('não grava Receita inválida nem CNPJ divergente', async () => {
    const deps = dependencias(); deps.receita.mockResolvedValue({ status: 'OK', cnpj: '00000000000000', nome: 'Outra' });
    expect((await processarEmpresa(empresa, deps)).estado).toBe('pendente');
    expect(deps.salvar).not.toHaveBeenCalled();
  });
  it('resposta nula da Receita não desaparece nem grava placeholder', async () => {
    const deps = dependencias(); deps.receita.mockResolvedValue(null);
    expect((await processarEmpresa(empresa, deps)).estado).toBe('pendente');
    expect(deps.salvar).not.toHaveBeenCalled();
  });
  it('404 salva sem inventar situação Radar', async () => {
    const deps = dependencias(); deps.radar.mockRejectedValue(new ErroConsultaRadar(404, 'NOT_FOUND', 'Não encontrado'));
    expect((await processarEmpresa(empresa, deps)).estado).toBe('salvo');
    expect(deps.salvar).toHaveBeenCalledWith(expect.objectContaining({ situacao_radar: null, submodalidade: null }));
  });
  it('captcha permanece pendente sem gravação', async () => {
    const deps = dependencias(); deps.radar.mockRejectedValue(new ErroConsultaRadar(502, 'BLOCKED_BY_CAPTCHA', 'Captcha'));
    expect(await processarEmpresa(empresa, deps)).toMatchObject({ estado: 'pendente', codigo: 'BLOCKED_BY_CAPTCHA' });
    expect(deps.salvar).not.toHaveBeenCalled();
  });
  it('limite impede novas chamadas', async () => {
    const deps = dependencias(); deps.admitir.mockReturnValue(15);
    await expect(processarEmpresa(empresa, deps)).rejects.toBeInstanceOf(EsperaCatcher);
    expect(deps.receita).not.toHaveBeenCalled();
  });
  it('concorrência preserva o registro de outra sessão', async () => {
    const deps = dependencias(); deps.buscar.mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    deps.salvar.mockRejectedValue({ code: 'P2002' });
    expect((await processarEmpresa(empresa, deps)).estado).toBe('existente');
    expect(deps.salvar).toHaveBeenCalledTimes(1);
  });
  it('falha de persistência é pendente', async () => {
    const deps = dependencias(); deps.salvar.mockRejectedValue(new Error('secret database details'));
    expect(await processarEmpresa(empresa, deps)).toMatchObject({ estado: 'pendente', codigo: 'SAVE_FAILED' });
  });
});
