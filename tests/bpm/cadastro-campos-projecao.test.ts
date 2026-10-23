import { describe, expect, it, vi } from "vitest";
import { normalizarDadosEmpresaBpm } from "@/lib/bpm/dados-empresa";
import { cadastroDosDadosEmpresa } from "@/lib/bpm/dados-empresa-edicao";
import { ENDERECOS_CADASTRAIS, campoCadastralTextoLivre } from "@/lib/bpm/cadastro-campos";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import { carregarValoresCanonicosCampos, type CampoFonteCanonica } from "@/lib/bpm/campos-configuraveis-server";

vi.mock("@/lib/prisma", () => ({ default: {} }));

function fixture() {
  const cadastro = cadastroDosDadosEmpresa(normalizarDadosEmpresaBpm({
    empresaPrincipal: { id: 42, razaoSocial: "Empresa fictícia", cnpj: "", status: "ATIVO", socios: [] },
    registrosCs: [], pessoasVinculadas: [], preAnalise: null, radarFiscal: null, responsaveisBpm: [],
  }));
  cadastro.empresa.endereco = { logradouro: "Rua salva", numero: "123", complemento: "Sala 4", bairro: "Centro", cep: "01001000", municipio: "São Paulo", uf: "SP" };
  cadastro.contatos = [{ tipo: "E-mail", valor: "salvo@example.invalid", titular: "Empresa" }, { tipo: "Telefone", valor: "11999998888", titular: "Empresa" }];
  const catalogo = Object.keys(ENDERECOS_CADASTRAIS).map((chave, indice) => ({ id: `endereco-${indice}`, chave }));
  const card = { id: "card", empresaId: 42, servico: null, pipeline: { id: "comercial", chave: "comercial" },
    responsavelId: 7, responsavel: { id: 7, nome: "Responsável atual", cpf: "52998224725" }, indicacaoOrigem: null,
    empresa: { id: 42, regimeTributario: "Lucro Presumido", pessoas: [], perfilCadastralJson: { versao: 1, cadastro } as unknown } };
  const client = {
    bpmCampo: { findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; chave: { in: string[] } } }) =>
      catalogo.filter((campo) => where.id.in.includes(campo.id) && where.chave.in.includes(campo.chave))) },
    bpmCard: { findUnique: vi.fn().mockResolvedValue(card) },
    bpmCardCampoValor: { upsert: vi.fn(), updateMany: vi.fn() },
    cliente: { updateMany: vi.fn() },
  };
  return { cadastro, catalogo, card, client, ler: (campos: CampoFonteCanonica[]) => carregarValoresCanonicosCampos("card", campos, client as never) };
}
const global = (id: string, fonteEntidade: string, fonteAtributo: string): CampoFonteCanonica => ({ id, escopo: "GLOBAL", fonteEntidade, fonteAtributo });

describe("projeção do cadastro salvo para campos dos formulários", () => {
  it("resolve os aliases CARD de endereço pelo catálogo e lê o perfil salvo sem criar cópias", async () => {
    const f = fixture();
    const valores = await f.ler(f.catalogo.map((campo) => ({ ...campo, escopo: "CARD", fonteEntidade: null, fonteAtributo: null })));
    for (const campo of f.catalogo) expect(valores[campo.id]).toBe(f.cadastro.empresa.endereco[ENDERECOS_CADASTRAIS[campo.chave]]);
    expect(Object.keys(valores)).toHaveLength(f.catalogo.length);
    expect(f.client.bpmCampo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: { in: f.catalogo.map((campo) => campo.id) }, chave: { in: Object.keys(ENDERECOS_CADASTRAIS) },
    } }));
    expect(f.client.bpmCardCampoValor.upsert).not.toHaveBeenCalled(); expect(f.client.cliente.updateMany).not.toHaveBeenCalled();
  });
  it("não aceita uma chave de endereço inventada pelo chamador para campo fora do catálogo", async () => {
    const f = fixture();
    expect(await f.ler([{ id: "outro-campo", chave: "alpha.radar.contrato.rua", escopo: "CARD", fonteEntidade: null, fonteAtributo: null }])).toEqual({});
    expect(f.client.bpmCard.findUnique).not.toHaveBeenCalled();
  });
  it("perfil ausente ou inválido não inventa valores de endereço", async () => {
    const f = fixture(); f.card.empresa.perfilCadastralJson = { versao: 99 };
    expect(await f.ler([{ ...f.catalogo[0], escopo: "CARD", fonteEntidade: null, fonteAtributo: null }])).toEqual({});
  });
  it("valores vazios deliberados no perfil continuam vazios na projeção", async () => {
    const f = fixture(); f.cadastro.empresa.endereco.logradouro = null; f.cadastro.contatos = [];
    expect(await f.ler([
      { ...f.catalogo[0], escopo: "CARD", fonteEntidade: null, fonteAtributo: null },
      global("email", "CONTATO", "email"), global("telefone", "CONTATO", "celular"),
    ])).toEqual({ [f.catalogo[0].id]: "", email: "", telefone: "" });
  });
  it("projeta contato único salvo e mantém regime canônico e responsável atual separados", async () => {
    const f = fixture();
    expect(await f.ler([global("email", "CONTATO", "email"), global("telefone", "CONTATO", "celular"),
      global("regime", "CLIENTE", "regimeTributario"), global("responsavel", "CARD", "responsavelNome")]))
      .toEqual({ email: "salvo@example.invalid", telefone: "11999998888", regime: "Lucro Presumido", responsavel: "Responsável atual" });
  });
  it("não escolhe arbitrariamente um entre vários e-mails do perfil", async () => {
    const f = fixture(); f.cadastro.contatos.push({ tipo: "E-mail", valor: "outro@example.invalid", titular: "Outro contato" });
    expect(await f.ler([global("email", "CONTATO", "email")])).toEqual({ email: "" });
  });
});

describe("escrita manual livre somente nas seleções cadastrais editáveis", () => {
  const selecao = { id: "campo", nome: "Regime tributário", tipo: "selecao", opcoesJson: JSON.stringify(["Opção antiga"]), editavel: true };
  it.each(["CLIENTE", "CONTATO"])("%s aceita escrita fora das opções antigas sem transformar o campo em somente leitura", (fonteEntidade) => {
    const campo = { ...selecao, fonteEntidade };
    expect(campoCadastralTextoLivre(campo)).toBe(true);
    expect(validarValoresCamposBpm([campo], { campo: "  Valor cadastral manual  " })).toEqual({ success: true, valores: { campo: "Valor cadastral manual" } });
  });
  it.each([{ editavel: false }, { somenteLeitura: true }])("preserva o bloqueio cadastral explícito %j", (bloqueio) => {
    const campo = { ...selecao, fonteEntidade: "CLIENTE", ...bloqueio };
    expect(campoCadastralTextoLivre(campo)).toBe(false);
    expect(validarValoresCamposBpm([campo], { campo: "Valor manual" })).toMatchObject({ success: false, error: expect.stringContaining("somente leitura") });
  });
  it("referência CARD de equipe mantém enum e proteção de somente leitura", () => {
    const campo = { ...selecao, nome: "Responsável", fonteEntidade: "CARD" };
    expect(campoCadastralTextoLivre(campo)).toBe(false);
    expect(validarValoresCamposBpm([campo], { campo: "Pessoa fora do catálogo" })).toMatchObject({ success: false, error: expect.stringContaining("opção inválida") });
    expect(validarValoresCamposBpm([{ ...campo, somenteLeitura: true }], { campo: "Opção antiga" })).toMatchObject({ success: false, error: expect.stringContaining("somente leitura") });
  });
  it("liberdade cadastral não elimina validação de tipos ou limite de tamanho", () => {
    expect(validarValoresCamposBpm([{ ...selecao, fonteEntidade: "CLIENTE", tipo: "numero" }], { campo: "não numérico" }).success).toBe(false);
    expect(validarValoresCamposBpm([{ ...selecao, fonteEntidade: "CLIENTE" }], { campo: "x".repeat(2001) }).success).toBe(false);
  });
});
