import { describe, expect, it } from "vitest";
import {
  criarChaveTutorialModulo,
  filtrarPassosTutorialDisponiveis,
  marcarTutorialModuloComoVisto,
  tutorialModuloFoiVisto,
  type ArmazenamentoTutorial,
  type ConfigTutorialModulo,
} from "@/lib/guias/tutorial-modulo";

const CONFIG: ConfigTutorialModulo = {
  modulo: "Parceiros",
  versao: 1,
  titulo: "Tutoriais de Parceiros",
  passos: [
    { id: "a", seletor: '[data-guia="a"]', titulo: "A", descricao: "A" },
    { id: "b", seletor: '[data-guia="b"]', titulo: "B", descricao: "B" },
  ],
};

function criarArmazenamento(): ArmazenamentoTutorial {
  const dados = new Map<string, string>();
  return {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => void dados.set(chave, valor),
  };
}

describe("persistência do Guia Inteligente de Módulo", () => {
  it("isola a preferência por usuário, módulo e versão", () => {
    expect(criarChaveTutorialModulo(CONFIG, 10)).toBe(
      "painelalpha:guia-modulo:parceiros:v1:usuario:10",
    );
    expect(criarChaveTutorialModulo({ modulo: "Parceiros", versao: 2 }, 10)).not.toBe(
      criarChaveTutorialModulo(CONFIG, 10),
    );
    expect(criarChaveTutorialModulo(CONFIG, 11)).not.toBe(criarChaveTutorialModulo(CONFIG, 10));
  });

  it("marca conclusão/pulo sem afetar outro usuário", () => {
    const armazenamento = criarArmazenamento();
    expect(tutorialModuloFoiVisto(armazenamento, CONFIG, 10)).toBe(false);
    marcarTutorialModuloComoVisto(armazenamento, CONFIG, 10);
    expect(tutorialModuloFoiVisto(armazenamento, CONFIG, 10)).toBe(true);
    expect(tutorialModuloFoiVisto(armazenamento, CONFIG, 11)).toBe(false);
  });

  it("remove passos cujos alvos não existem para o perfil atual", () => {
    const raiz = {
      querySelector: (seletor: string) => (seletor.includes('"a"') ? { id: "a" } : null),
    } as Pick<Document, "querySelector">;
    expect(filtrarPassosTutorialDisponiveis(CONFIG.passos, raiz).map((passo) => passo.id)).toEqual(["a"]);
  });
});
