import { beforeEach, expect, it, vi } from "vitest";
import { carregarCamposAplicaveisCardEtapa, type CampoAplicavelEtapaBpm } from "@/lib/bpm/requisitos-etapa-server";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import { CHAVE_CONDICAO_NEGOCIADA, CHAVE_TARIFARIO_PADRAO } from "@/lib/bpm/card-modal-ui";

const m = vi.hoisted(() => ({ persistidos: {} as Record<string, string>, canonicos: {} as Record<string, string> }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/regras/contexto", () => ({ montarContextoAvaliacaoDoCard: vi.fn(async () => ({ card: {}, camposDinamicos: m.persistidos })) }));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({ carregarValoresCanonicosCampos: vi.fn(async () => m.canonicos) }));

const condicao = JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: "cmutesttarifario0000000001" }, operador: "igual", valor: "Não" }] });
function campo(id: string, chave: string, extra: Partial<CampoAplicavelEtapaBpm> = {}): Omit<CampoAplicavelEtapaBpm, "valor"> {
  return { id, chave, nome: id, pipelineId: "pipeline", etapaId: "etapa", tipo: "texto", opcoesJson: null,
    obrigatorio: false, ordem: 0, visivel: true, editavel: true, escopo: "CARD", ...extra };
}
function catalogo() {
  return [campo("cmutesttarifario0000000001", CHAVE_TARIFARIO_PADRAO, { tipo: "selecao", opcoesJson: '["Sim","Não"]' }),
    campo("condicao", CHAVE_CONDICAO_NEGOCIADA, { condicaoVisibilidadeJson: condicao })];
}
function client() {
  return { bpmCard: { findUnique: vi.fn(async () => ({ id: "card" })) },
    bpmCardCampoValor: { findMany: vi.fn(async () => Object.entries(m.persistidos).map(([campoId, valor]) => ({ campoId, valor }))) },
    bpmCampoMapeamento: { findMany: vi.fn(async () => []) } } as never;
}
const carregar = (campos = catalogo(), opcoes: Parameters<typeof carregarCamposAplicaveisCardEtapa>[6] = {}) =>
  carregarCamposAplicaveisCardEtapa("card", "pipeline", "etapa", client(), undefined, campos, opcoes);
beforeEach(() => { m.persistidos = {}; m.canonicos = {}; });

it("mantém oculto por padrão e permite catálogo de edição somente para a dependência publicada", async () => {
  expect((await carregar()).map(c => c.id)).toEqual(["cmutesttarifario0000000001"]);
  const outro = campo("outro", "campo.privado", { condicaoVisibilidadeJson: condicao });
  expect((await carregar([...catalogo(), outro], { incluirCondicionaisEdicao: true })).map(c => c.id)).toEqual(["cmutesttarifario0000000001", "condicao"]);
});
it("a opção de edição não revela campo oculto por ACL ou dependência diferente", async () => {
  const campos = catalogo(); campos[1].visivel = false;
  expect((await carregar(campos, { incluirCondicionaisEdicao: true })).map(c => c.id)).toEqual(["cmutesttarifario0000000001"]);
  campos[1].visivel = true; campos[1].condicaoVisibilidadeJson = condicao.replace('"Não"', '"Sim"');
  expect((await carregar(campos, { incluirCondicionaisEdicao: true })).map(c => c.id)).toEqual(["cmutesttarifario0000000001"]);
});
it("valida o novo tarifário antes de aceitar condição negociada no mesmo payload", async () => {
  m.persistidos = { cmutesttarifario0000000001: "Sim" };
  const payload = { cmutesttarifario0000000001: "Não", condicao: "Condição livre" };
  const campos = await carregar(catalogo(), { valoresSubmetidos: payload });
  expect(validarValoresCamposBpm(campos, payload)).toMatchObject({ success: true, valores: payload });
  expect(m.persistidos).toEqual({ cmutesttarifario0000000001: "Sim" });
});
it("rejeita seleção inválida antes de avaliar a dependência", async () => {
  await expect(carregar(catalogo(), { valoresSubmetidos: { cmutesttarifario0000000001: "talvez", condicao: "não autorizado" } })).rejects.toThrow("CAMPO_INVALIDO");
  const campos = catalogo(); campos[0].somenteLeitura = true;
  await expect(carregar(campos, { valoresSubmetidos: { cmutesttarifario0000000001: "Não" } })).rejects.toThrow("somente leitura");
});
it.each(["Sim", ""])("não aceita escrita no campo condicionado ao mudar para %j", async (tarifario) => {
  m.persistidos = { cmutesttarifario0000000001: "Não", condicao: "Condição anterior" };
  const payload = { cmutesttarifario0000000001: tarifario, condicao: "injetada" };
  const campos = await carregar(catalogo(), { valoresSubmetidos: payload });
  expect(validarValoresCamposBpm(campos, payload).success).toBe(false);
  expect(m.persistidos.condicao).toBe("Condição anterior");
});
it("projeta cadastro CARD sem linha local e preserva limpeza e texto manual", async () => {
  m.canonicos = { rua: "Rua atualizada" };
  const campos = [campo("rua", "alpha.rua")];
  expect((await carregar(campos))[0].valor).toBe("Rua atualizada");
  m.persistidos.rua = "";
  expect((await carregar(campos))[0].valor).toBe("");
  m.persistidos.rua = "Rua manual";
  expect((await carregar(campos))[0].valor).toBe("Rua manual");
});
it("preserva limpeza manual de fonte global editável", async () => {
  m.canonicos = { nome: "Nome cadastral" }; m.persistidos.nome = "";
  expect((await carregar([campo("nome", "alpha.razao.social", { escopo: "GLOBAL", fonteEntidade: "CLIENTE", fonteAtributo: "razaoSocial" })]))[0].valor).toBe("");
});
