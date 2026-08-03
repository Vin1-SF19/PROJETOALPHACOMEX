import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { AUTOFILL_PROTECTION_ATTRS } from '../../src/components/ui/autofill-protection';
import { getTokenOnyxUpdate } from '../../src/lib/colaboradores/token-onyx-update';

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), 'utf8');
}

describe('proteção contra autofill na Gestão da Equipe', () => {
  it('publica hints para os gerenciadores de senha suportados', () => {
    expect(AUTOFILL_PROTECTION_ATTRS).toEqual({
      'data-1p-ignore': 'true',
      'data-lpignore': 'true',
      'data-bwignore': 'true',
      'data-form-type': 'other',
    });
  });

  it('protege todos os campos sensíveis da criação de usuário', () => {
    const cadastro = source('src', 'components', 'FormCadastro.tsx');

    for (const field of ['nome', 'usuario', 'senha', 'email', 'token_onyx']) {
      expect(cadastro).toMatch(
        new RegExp(`name=["']${field}["'][\\s\\S]{0,180}AUTOFILL_PROTECTION_ATTRS`),
      );
    }

    expect(cadastro).toContain('autoComplete="new-password"');
    expect(cadastro).toContain('autoComplete="one-time-code"');
  });

  it('nunca envia token sem ativação explícita da edição', () => {
    expect(getTokenOnyxUpdate(true, false, 'onyx_pat_injetado')).toEqual({});
    expect(getTokenOnyxUpdate(false, true, 'onyx_pat_injetado')).toEqual({});
    expect(getTokenOnyxUpdate(true, true, '   ')).toEqual({});
    expect(getTokenOnyxUpdate(true, true, '  onyx_pat_novo  ')).toEqual({
      token_onyx: 'onyx_pat_novo',
    });
  });

  it('mantém o token bloqueado até a ação explícita do administrador', () => {
    const modal = source(
      'src',
      'components',
      'Colaboradores',
      'ModalPerfilColaborador.tsx',
    );

    expect(modal).toContain('disabled={!editandoTokenOnyx}');
    expect(modal).toContain("setEditandoTokenOnyx(true)");
    expect(modal).toContain("setEditandoTokenOnyx(false)");
    expect(modal).toContain('getTokenOnyxUpdate(isAdmin, editandoTokenOnyx, tokenOnyx)');
  });
});
