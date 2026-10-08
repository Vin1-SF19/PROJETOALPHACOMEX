import { describe, expect, it } from 'vitest';
import { diagnosticoColeta } from '../../scripts/alpha-catcher-diagnostic.mjs';
import { resumirFalhaColeta } from '@/lib/alpha-catcher/logcomex-diagnostic';
describe('diagnóstico seguro da coleta parcial', () => {
  it('explica HTTP no ranking mesmo sem empresas', () => {
    const diagnostico = diagnosticoColeta({ status: 'interrompido', paginasConsultadas: 0, empresas: [], erros: [{ statusHttp: 429, erro: 'Bearer segredo', empresa: 'Nome privado' }] });
    const mensagem = resumirFalhaColeta(diagnostico, 0, 0);
    expect(mensagem).toContain('HTTP 429'); expect(mensagem).toContain('0 empresas recebidas');
    expect(JSON.stringify(diagnostico)).not.toContain('segredo'); expect(mensagem).not.toContain('Nome privado');
  });
  it('explica formato inesperado dos perfis e preserva os válidos', () => {
    const diagnostico = diagnosticoColeta({ status: 'concluido_com_erros', paginasConsultadas: 1, empresas: [{ cnpj: null }, { cnpj: '33000167000101' }], erros: [{ erro: 'Resposta do perfil sem os campos cnpj/address esperados.' }] });
    const mensagem = resumirFalhaColeta(diagnostico, 1, 1);
    expect(mensagem).toContain('perfis retornaram um formato diferente'); expect(mensagem).toContain('1 sem CNPJ'); expect(mensagem).toContain('preservados');
  });
  it('perfis sem CNPJ explicam coleta parcial sem erro HTTP', () => {
    const mensagem = resumirFalhaColeta(diagnosticoColeta({ status: 'concluido', empresas: [{ cnpj: null }], erros: [] }), 0, 1);
    expect(mensagem).toContain('Há perfis sem CNPJ'); expect(mensagem).toContain('Nenhuma empresa válida');
  });
  it('recusa diagnósticos adulterados ou mensagens livres', () => {
    const mensagem = resumirFalhaColeta({ status: 'interrompido', recebidas: 0, semCnpj: 0, paginas: 0, falhas: ['Bearer segredo'] }, 0, 0);
    expect(mensagem).not.toContain('segredo'); expect(mensagem).toContain('Não foi possível obter o diagnóstico');
  });
  it('classifica timeout e descarta conteúdo bruto desconhecido', () => {
    expect(diagnosticoColeta({ empresas: [], erros: [{ tipo: 'timeout', erro: 'token' }, { erro: 'password' }] }).falhas).toEqual(['timeout', 'falha_coleta']);
  });
});
