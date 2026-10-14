import { describe, expect, it } from "vitest";
import { selecionarPaginaQuadro, mesclarResumosQuadro, type EntradaManifestoQuadro } from "@/lib/bpm/quadro-paginado";
import { filtroVinculoCardBpm } from "@/lib/bpm/visibilidade-card";
const cards: EntradaManifestoQuadro[] = Array.from({ length: 381 }, (_, i) => ({ id: `c${i}`, etapaId: "standby", revision: "v1", nome: i === 380 ? "Empréstimo especial" : `Empresa ${i}`, cnpj: null, servico: "Revisão RADAR", responsaveis: [{ id: i % 2 + 1, nome: "Pessoa" }] }));
describe("quadro paginado", () => {
  it("limita por coluna sem truncar contagens", () => {
    const other = { ...cards[0], id: "outro", etapaId: "nova" };
    const page = selecionarPaginaQuadro([...cards, other]);
    expect(page.ids).toHaveLength(31); expect(page.totais).toEqual({ standby: 381, nova: 1 });
    expect(selecionarPaginaQuadro(cards, { limites: { standby: 60 } }).ids).toHaveLength(60);
  });
  it("encontra card ainda não carregado e ignora acentos", () => {
    expect(selecionarPaginaQuadro(cards, { busca: "emprestimo" }).ids).toEqual(["c380"]);
    expect(selecionarPaginaQuadro(cards, { responsavelId: 2 }).totais.standby).toBe(190);
  });
  it("remove revogados e conserva identidade dos cards que não mudaram", () => {
    const current = [{ id: "a", texto: "igual" }, { id: "b", texto: "revogado" }];
    const merged = mesclarResumosQuadro(current, [{ id: "a", texto: "igual" }], ["a"]);
    expect(merged).toEqual([current[0]]); expect(merged[0]).toBe(current[0]);
    expect(mesclarResumosQuadro(merged, [{ id: "a", texto: "igual" }], ["a"])).toBe(merged);
  });
  it("filtra por responsável ou participante, nunca confunde membros vazios com lead livre", () => {
    expect(filtroVinculoCardBpm(9, false)).toEqual({ AND: [{ OR: [{ responsavelId: 9 }, { membros: { some: { userId: 9 } } }] }] });
    expect(filtroVinculoCardBpm(9, true)).toEqual({});
  });
});
