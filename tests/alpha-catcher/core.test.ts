import { describe, expect, it } from 'vitest';
import { importarEmpresas, normalizarEmpresa, normalizarDiasReceita } from '@/lib/alpha-catcher/core';

const empresa = { cnpj: '33.000.167/0001-01', consignatario: ' Banco ' };
describe('entrada Alpha Catcher', () => {
  it('idade máxima aceita zero/personalizado e rejeita dias inválidos', () => {
    expect(normalizarDiasReceita(undefined)).toBe(30);
    for (const days of [0, 7, 15, 30, 365, 1000]) expect(normalizarDiasReceita(days)).toBe(days);
    for (const value of [null, '30', -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(normalizarDiasReceita(value)).toBeNull();
  });
  it('normaliza e remove inválidos e duplicados', () => {
    expect(importarEmpresas({ empresas: [empresa, empresa, { ...empresa, cnpj: '33000167000102' }] })).toEqual({
      empresas: [{ cnpj: '33000167000101', consignatario: 'Banco' }], invalidos: 1, duplicados: 1,
    });
  });
  it('aceita JSON acima de 5 MB e 10 mil entradas mantendo validação e deduplicação', () => {
    const texto = JSON.stringify({ empresas: Array.from({ length: 12000 }, () => ({ ...empresa, consignatario: 'Empresa '.repeat(60) })) });
    expect(new TextEncoder().encode(texto).byteLength).toBeGreaterThan(5 * 1024 * 1024);
    const resultado = importarEmpresas(JSON.parse(texto));
    expect(resultado.empresas).toHaveLength(1); expect(resultado.duplicados).toBe(11999); expect(resultado.invalidos).toBe(0);
  });
  it('rejeita estrutura incorreta e caracteres não suportados', () => {
    expect(() => importarEmpresas([])).toThrow();
    expect(normalizarEmpresa({ ...empresa, cnpj: '33000167000101<script>' })).toBeNull();
    expect(normalizarEmpresa({ ...empresa, consignatario: '' })).toBeNull();
  });
});
