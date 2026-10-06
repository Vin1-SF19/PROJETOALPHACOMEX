import { describe, expect, it } from 'vitest';
import { criarAdmissao, importarEmpresas, normalizarEmpresa, MAX_EMPRESAS } from '@/lib/alpha-catcher/core';

const empresa = { cnpj: '33.000.167/0001-01', consignatario: ' Banco ' };
describe('entrada Alpha Catcher', () => {
  it('normaliza e remove inválidos e duplicados', () => {
    expect(importarEmpresas({ empresas: [empresa, empresa, { ...empresa, cnpj: '33000167000102' }] })).toEqual({
      empresas: [{ cnpj: '33000167000101', consignatario: 'Banco' }], invalidos: 1, duplicados: 1,
    });
  });
  it('rejeita estrutura incorreta, excesso e caracteres não suportados', () => {
    expect(() => importarEmpresas([])).toThrow();
    expect(() => importarEmpresas({ empresas: Array(MAX_EMPRESAS + 1) })).toThrow();
    expect(normalizarEmpresa({ ...empresa, cnpj: '33000167000101<script>' })).toBeNull();
    expect(normalizarEmpresa({ ...empresa, consignatario: '' })).toBeNull();
  });
  it('reserva intervalo global entre novos pedidos', () => {
    let agora = 1000;
    const admitir = criarAdmissao(() => agora);
    expect(admitir()).toBe(0);
    expect(admitir()).toBe(30);
    agora += 21000; expect(admitir()).toBe(9);
    agora += 9000; expect(admitir()).toBe(0);
  });
});
