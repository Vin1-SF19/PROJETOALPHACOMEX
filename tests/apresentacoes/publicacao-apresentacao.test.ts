import { describe, expect, it } from "vitest";
import { apresentacaoPublicaDisponivel, gerarSlugPublico, slugPublicoEhValido } from "@/lib/apresentacoes/publicacao";

describe("publicação por link do Alpha Motion", () => {
  it("gera um slug aleatório não enumerável no formato público", () => {
    const primeiro = gerarSlugPublico();
    const segundo = gerarSlugPublico();
    expect(slugPublicoEhValido(primeiro)).toBe(true);
    expect(primeiro).not.toBe(segundo);
  });

  it("libera somente apresentações publicadas e não expiradas", () => {
    const agora = new Date("2026-08-10T12:00:00.000Z");
    expect(apresentacaoPublicaDisponivel({ status: "PUBLICADA", expiraEm: null }, agora)).toBe(true);
    expect(apresentacaoPublicaDisponivel({ status: "DRAFT", expiraEm: null }, agora)).toBe(false);
    expect(apresentacaoPublicaDisponivel({ status: "PUBLICADA", expiraEm: "2026-08-10T11:59:59.000Z" }, agora)).toBe(false);
    expect(apresentacaoPublicaDisponivel({ status: "PUBLICADA", expiraEm: "2026-08-10T12:00:01.000Z" }, agora)).toBe(true);
  });

  it("rejeita slugs manipulados antes da consulta pública", () => {
    expect(slugPublicoEhValido("../../admin")).toBe(false);
    expect(slugPublicoEhValido("curto")).toBe(false);
  });
});
