import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validarNovaSenha,
} from "@/lib/auth/password-policy";

describe("política de senha do Painel Alpha", () => {
  it("aceita passphrases dentro do intervalo comum", () => {
    const password = "uma frase longa e segura";
    expect(validarNovaSenha(password)).toEqual({ success: true, password });
  });

  it.each([
    ["curta", "a".repeat(PASSWORD_MIN_LENGTH - 1)],
    ["longa", "a".repeat(PASSWORD_MAX_LENGTH + 1)],
    ["somente espaços", " ".repeat(PASSWORD_MIN_LENGTH)],
    ["não textual", null],
  ])("rejeita senha %s", (_scenario, password) => {
    expect(validarNovaSenha(password)).toMatchObject({ success: false });
  });
});
