import { describe, expect, it } from "vitest";
import {
    filtrarParceiros,
    normalizarBuscaParceiro,
    type ParceiroOpcao,
} from "@/components/comercial/SeletorParceiroPesquisavel";

const parceiros: ParceiroOpcao[] = [
    {
        id: 1,
        nome: "João da Silva",
        nomeFantasia: "Conexão Fiscal",
        nivel: "PRATA",
        representantes: ["Márcia Souza"],
    },
    {
        id: 2,
        nome: "Ana Ferreira",
        nomeFantasia: "Alpha Contábil",
        nivel: "OURO",
        representantes: ["Carlos Lima"],
    },
    {
        id: 3,
        nome: "Marcos Oliveira",
        nomeFantasia: null,
        nivel: "BRONZE",
        representantes: [],
    },
];

describe("seletor pesquisável de parceiros", () => {
    it("normaliza acentos, caixa e espaços da pesquisa", () => {
        expect(normalizarBuscaParceiro("  CONEXÃO  ")).toBe("conexao");
    });

    it("filtra pelo nome do parceiro sem diferenciar acentos ou caixa", () => {
        expect(filtrarParceiros(parceiros, "joao").map((parceiro) => parceiro.id)).toEqual([1]);
        expect(filtrarParceiros(parceiros, "FERREIRA").map((parceiro) => parceiro.id)).toEqual([2]);
    });

    it("também encontra por nome fantasia e representante", () => {
        expect(filtrarParceiros(parceiros, "alpha contabil").map((parceiro) => parceiro.id)).toEqual([2]);
        expect(filtrarParceiros(parceiros, "marcia souza").map((parceiro) => parceiro.id)).toEqual([1]);
    });

    it("mantém a lista original quando a pesquisa está vazia", () => {
        expect(filtrarParceiros(parceiros, "   ")).toEqual(parceiros);
    });

    it("retorna lista vazia quando nenhum parceiro corresponde", () => {
        expect(filtrarParceiros(parceiros, "parceiro inexistente")).toEqual([]);
    });
});
