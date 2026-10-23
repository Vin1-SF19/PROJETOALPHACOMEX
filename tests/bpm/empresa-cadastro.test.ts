import { describe, expect, it } from "vitest";
import { normalizarDadosEmpresaBpm } from "@/lib/bpm/dados-empresa";
import { aplicarPerfilCadastral, cadastroDosDadosEmpresa, cadastroEmpresaSchema, diferencasCadastroEmpresa,
  editarValorCadastro, preencherCadastroComConsulta } from "@/lib/bpm/dados-empresa-edicao";
import { ehAnotacaoTecnicaInstagram } from "@/lib/bpm/instagram-anotacao-tecnica";
import { anotacaoLeadInstagram, prepararLeadInstagram } from "@/lib/bpm/instagram-leads";
import { montarFeedTimelineCard } from "@/lib/bpm/timeline";
import { descreverEventoHistorico } from "@/lib/bpm/historico-descricao";

export function cadastroVazio() {
  return cadastroDosDadosEmpresa(normalizarDadosEmpresaBpm({
    empresaPrincipal: { id: 1, cnpj: "", razaoSocial: "Empresa teste", status: "ATIVO", socios: [] },
    registrosCs: [], pessoasVinculadas: [], preAnalise: null, radarFiscal: null, responsaveisBpm: [],
  }));
}
describe("cadastro empresarial estruturado", () => {
  it.each(["01.001-000", "01001-000", "01001000"])("normaliza CEP válido %s para oito dígitos no DTO salvo", (cep) => {
    const cadastro = editarValorCadastro(cadastroVazio(), "empresa.endereco.cep", cep);
    expect(cadastroEmpresaSchema.parse(cadastro).empresa.endereco.cep).toBe("01001000");
  });
  it.each(["abc01001000", "01001abc000", "0100100", "010010000"])("não transforma CEP inválido %s em um CEP aceito", (cep) => {
    const resultado = cadastroEmpresaSchema.safeParse(editarValorCadastro(cadastroVazio(), "empresa.endereco.cep", cep));
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.error.issues).toContainEqual(expect.objectContaining({ message: "CEP inválido." }));
  });
  it("aceita empresa sem CNPJ, rejeita chave não permitida e não permite alterar a data comprovada de consulta", () => {
    const c = cadastroVazio(); expect(cadastroEmpresaSchema.safeParse(c).success).toBe(true);
    expect(cadastroEmpresaSchema.safeParse({ ...c, responsavelId: 99 }).success).toBe(false);
    expect(cadastroEmpresaSchema.safeParse({ ...c, radar: { ...c.radar, consultadoEm: "inventado" } }).success).toBe(false);
  });
  it.each([
    ["empresa.cnpj", "12345678901234"], ["empresa.endereco.uf", "11"], ["empresa.endereco.cep", "123"],
    ["empresa.dataConstituicao", "31/02/2026"], ["regimeTributario.dataOpcaoSimples", "amanhã"], ["radar.dataSituacao", "2026-02-29"],
    ["empresa.capitalSocial", -1], ["empresa.capitalSocial", NaN],
    ["contatos", [{ tipo: "Telefone", valor: "abc", titular: "Empresa" }]],
    ["contatos", [{ tipo: "E-mail", valor: "inválido", titular: "Empresa" }]],
  ])("rejeita valor inválido em %s", (path, value) => {
    expect(cadastroEmpresaSchema.safeParse(editarValorCadastro(cadastroVazio(), path, value)).success).toBe(false);
  });
  it("documenta diferenças escalares e de QSA por campo, incluindo remoção e valores vazios", () => {
    const antes = cadastroVazio(); const depois = structuredClone(antes);
    depois.empresa.capitalSocial = 0;
    depois.pessoas = [{ nome: "Sócia teste", funcao: "Sócia", telefone: null, email: null, observacoes: null, dataNascimento: null }];
    const diff = diferencasCadastroEmpresa(antes, depois);
    expect(diff).toContainEqual({ campo: "empresa.capitalSocial", rotulo: "Capital social", antes: null, depois: "0" });
    expect(diff).toContainEqual(expect.objectContaining({ campo: "pessoas.0.nome", antes: null, depois: "Sócia teste" }));
    expect(diferencasCadastroEmpresa(depois, antes)).toContainEqual(expect.objectContaining({ campo: "pessoas.0.nome", antes: "Sócia teste", depois: null }));
    expect(diferencasCadastroEmpresa(antes, antes)).toEqual([]);
  });
  it("consulta parcial preserva campos ausentes, listas vazias e alterações manuais", () => {
    const atual = cadastroVazio(); atual.empresa.nomeFantasia = "Nome deliberado";
    atual.pessoas = [{ nome: "Sócia manual", funcao: null, telefone: null, email: null, dataNascimento: null, observacoes: null }];
    atual.radar.modalidade = "Limitada"; atual.analiseFiscal.site = "exemplo.invalid";
    const consulta = cadastroVazio(); consulta.empresa.nomeFantasia = "Nome consultado"; consulta.empresa.capitalSocial = 50000;
    const r = preencherCadastroComConsulta(atual, consulta, { receita: true, fiscal: false, radar: false }, "", ["empresa.nomeFantasia", "pessoas.0.nome"]);
    expect(r.empresa.nomeFantasia).toBe("Nome deliberado"); expect(r.empresa.capitalSocial).toBe(50000);
    expect(r.pessoas).toEqual(atual.pessoas); expect(r.radar).toEqual(atual.radar); expect(r.analiseFiscal).toEqual(atual.analiseFiscal);
  });
  it("perfil cadastral não aceita nem sobrescreve contratos, equipe ou data de consulta", () => {
    const dados = normalizarDadosEmpresaBpm({ empresaPrincipal: { id: 9, cnpj: "", razaoSocial: "Empresa", status: "ATIVO", socios: [] }, registrosCs: [], pessoasVinculadas: [], preAnalise: null, radarFiscal: null, responsaveisBpm: [] });
    const c = cadastroDosDadosEmpresa(dados); c.empresa.nomeFantasia = "Novo nome";
    const aplicado = aplicarPerfilCadastral(dados, { versao: 1, cadastro: c });
    expect(aplicado.relacionamento).toEqual(dados.relacionamento); expect(aplicado.responsaveis).toEqual(dados.responsaveis);
    expect(aplicado.empresa.nomeFantasia).toBe("Novo nome"); expect(aplicado.empresa.id).toBe(9);
    expect(aplicarPerfilCadastral(dados, { versao: 1, cadastro: { ...c, relacionamento: {} } })).toBe(dados);
  });
  it("consulta não vazia acrescenta contatos e sócios sem apagar WhatsApp ou detalhes anteriores", () => {
    const atual = cadastroVazio(); atual.contatos = [{ tipo: "Telefone", valor: "11999998888", titular: "Contato do lead" }];
    atual.pessoas = [{ nome: "Ana", funcao: null, telefone: "11999998888", email: "ana@example.invalid", dataNascimento: null, observacoes: null },
      { nome: "Bruno", funcao: "Sócio", telefone: null, email: null, dataNascimento: null, observacoes: null }];
    const consulta = cadastroVazio(); consulta.contatos = [{ tipo: "E-mail", valor: "empresa@example.invalid", titular: "Empresa" }];
    consulta.pessoas = [{ nome: "ANA", funcao: "Sócia administradora", telefone: null, email: null, dataNascimento: null, observacoes: null }];
    const r = preencherCadastroComConsulta(atual, consulta, { receita: true, fiscal: false, radar: false }, "");
    expect(r.contatos).toHaveLength(2); expect(r.contatos[0].valor).toBe("11999998888"); expect(r.pessoas).toHaveLength(2);
    expect(r.pessoas[0]).toMatchObject({ telefone: "11999998888", email: "ana@example.invalid", funcao: "Sócia administradora" });
  });
});

describe("anotação técnica Instagram", () => {
  const observacoes = anotacaoLeadInstagram(prepararLeadInstagram({ id: "l:teste", full_name: "Teste", created_time: "2026-10-22T12:00:00Z" }));
  const tecnica = { tipo: "ANOTACAO", resumo: "Dados recebidos do Instagram", observacoes };
  it("oculta os templates atual e legado inteiros sem confundir anotações humanas", () => {
    expect(ehAnotacaoTecnicaInstagram(tecnica)).toBe(true);
    expect(ehAnotacaoTecnicaInstagram({ ...tecnica, observacoes: observacoes.replace("Orgânico:", "Campanha: teste\nAnúncio: teste\nConjunto de anúncios: teste\nFormulário: teste\nOrgânico:") })).toBe(true);
    for (const item of [{ ...tecnica, tipo: "LIGACAO" }, { ...tecnica, resumo: "Outra anotação" }, { ...tecnica, observacoes: "Conversei com o lead do Instagram." }, { ...tecnica, observacoes: "Nota humana\n" + observacoes }]) expect(ehAnotacaoTecnicaInstagram(item)).toBe(false);
  });
  it("preserva criação do card e notas humanas no feed", () => {
    const events = montarFeedTimelineCard([{ id: "criação", acao: "CARD_CRIADO", createdAt: new Date() }], [
      { ...tecnica, id: "técnica", createdAt: new Date(), registradoPor: { nome: "Usuário" } },
      { tipo: "ANOTACAO", resumo: null, observacoes: "Contato útil", id: "humana", createdAt: new Date(), registradoPor: { nome: "Usuário" } },
    ]);
    expect(events.map((e) => e.id)).toEqual(expect.arrayContaining(["criação", "humana"]));
    expect(events).toHaveLength(2);
  });
  it("apresenta antes/depois e preserva o nome do autor no momento da edição", () => {
    const evento = { id: "audit", acao: "DADOS_EMPRESA_ATUALIZADOS", createdAt: "2026-10-22T12:00:00Z", usuario: { nome: "Nome atual" },
      valorAnteriorJson: JSON.stringify({ rotulo: "Capital social", valor: "25000" }), valorNovoJson: JSON.stringify({ rotulo: "Capital social", valor: "80000", autor: "Nome no momento da edição" }) };
    const [item] = montarFeedTimelineCard([evento], []); expect(item.autor).toBe("Nome no momento da edição");
    expect(descreverEventoHistorico({ ...evento, contexto: { etapas: [], usuarios: [], campos: [] } })).toBe("Capital social: antes 25000 → depois 80000");
  });
});
