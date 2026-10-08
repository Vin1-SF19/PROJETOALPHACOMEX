import { describe, expect, it } from 'vitest';
import { complementarCampos, janelaDiaCadastro, planoCadastroSchema } from '@/lib/alpha-catcher/completar-cadastro';

describe('complementação ReceitaWS de cadastros', () => {
  it('preenche somente campos vazios sem alterar nomes existentes ou capital zero', () => {
    expect(complementarCampos({ nome_fantasia: null, capital_social: '0' }, { fantasia: ' FANTASIA ', capital_social: '999' })).toEqual({ nome_fantasia: 'FANTASIA' });
    expect(complementarCampos({ nome_fantasia: 'ORIGINAL', capital_social: null }, { fantasia: 'OUTRA', capital_social: '0' })).toEqual({ capital_social: '0' });
  });
  it('não inventa nomes nem grava valores inválidos', () => {
    expect(complementarCampos({ nome_fantasia: '', capital_social: null }, { fantasia: ' ', capital_social: 'inválido' })).toEqual({});
    expect(complementarCampos({ nome_fantasia: null, capital_social: null }, {})).toEqual({});
  });
  it('delimita o dia em Brasília e rejeita datas inexistentes', () => {
    const janela = janelaDiaCadastro('2026-10-06');
    expect(janela.gte.toISOString()).toBe('2026-10-06T03:00:00.000Z');
    expect(janela.lt.toISOString()).toBe('2026-10-07T03:00:00.000Z');
    expect(() => janelaDiaCadastro('2026-02-30')).toThrow();
  });
  it('rejeita planos duplicados e CNPJs inválidos', () => {
    const empresa = { id: 1, cnpj: '33000167000101', data_consulta: '2026-10-06T12:00:00.000Z', nome_fantasia: null, capital_social: '100' };
    const plano = { versao: 1, criadoEm: '2026-10-06T12:00:00.000Z', data: '2026-10-06', banco: 'a'.repeat(64), empresas: [empresa] };
    expect(planoCadastroSchema.safeParse(plano).success).toBe(true);
    expect(planoCadastroSchema.safeParse({ ...plano, empresas: [empresa, empresa] }).success).toBe(false);
    expect(planoCadastroSchema.safeParse({ ...plano, empresas: [{ ...empresa, cnpj: '00000000000000' }] }).success).toBe(false);
  });
});
