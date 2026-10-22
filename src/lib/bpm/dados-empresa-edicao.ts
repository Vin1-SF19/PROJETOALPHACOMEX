import { z } from "zod";
import { cnpjEhValido, normalizarCNPJ } from "@/lib/format-cnpj";
import type { DadosEmpresaConsolidado } from "@/lib/bpm/dados-empresa";

const texto = z.string().trim().max(2000).nullable().transform((v) => v || null);
const nome = z.string().trim().min(1).max(200);
const dinheiro = z.number().finite().nonnegative().max(1e15).nullable();
const data = texto.refine((v) => {
  if (!v) return true;
  if (z.iso.datetime({ offset: true }).safeParse(v).success) return true;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!br && !iso) return false;
  const [ano, mes, dia] = br ? [Number(br[3]), Number(br[2]), Number(br[1])] : [Number(iso![1]), Number(iso![2]), Number(iso![3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return ano >= 1000 && d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}, "Informe uma data válida no formato dd/mm/aaaa.");
const telefone = texto.refine((v) => !v || /^[+\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 8 && v.replace(/\D/g, "").length <= 15, "Confira o número de telefone.");
const contato = z.object({ tipo: z.enum(["Telefone", "E-mail"]), valor: nome, titular: z.string().trim().max(200) }).strict()
  .refine((v) => v.tipo === "E-mail" ? z.email().safeParse(v.valor).success : telefone.safeParse(v.valor).success, "Confira o e-mail ou telefone do contato.");
const pessoa = z.object({ nome, funcao: texto, telefone, email: texto, dataNascimento: data, observacoes: texto }).strict()
  .refine((v) => !v.email || z.email().safeParse(v.email).success, "Confira o e-mail do sócio.");

export const cadastroEmpresaSchema = z.object({
  empresa: z.object({
    cnpj: z.string().max(30).transform(normalizarCNPJ).refine((v) => !v || cnpjEhValido(v), "CNPJ inválido."),
    razaoSocial: nome, nomeFantasia: texto, situacao: texto, dataConstituicao: data, porte: texto,
    naturezaJuridica: texto, capitalSocial: dinheiro,
    endereco: z.object({ logradouro: texto, numero: texto, bairro: texto, municipio: texto,
      uf: z.string().trim().max(2).nullable().transform((v) => v?.toUpperCase() || null)
        .refine((v) => !v || ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].includes(v), "UF inválida."),
      cep: z.string().trim().max(10).nullable().refine((v) => !v || /^\d{5}-?\d{3}$/.test(v), "CEP inválido.") }).strict(),
  }).strict(),
  contatos: z.array(contato).max(100),
  pessoas: z.array(pessoa).max(100),
  cnaes: z.array(z.object({ codigo: nome, descricao: nome, tipo: z.enum(["Principal", "Secundário"]) }).strict()).max(200),
  regimeTributario: z.object({ atual: texto, receita: texto, simplesNacional: z.boolean().nullable(), mei: z.boolean().nullable(),
    dataOpcaoSimples: data, dataExclusaoSimples: data,
    historico: z.array(z.object({ periodo: nome, regime: nome }).strict()).max(100) }).strict(),
  radar: z.object({ situacao: texto, modalidade: texto, submodalidade: texto, dataSituacao: data, baseLegal: texto,
    tipoDesabilitacao: texto, operacoesAutorizadas: texto, qualificacao: texto, perse: texto, anexoPerse: texto,
    dividaTributaria: dinheiro }).strict(),
  analiseFiscal: z.object({ faturamento: texto, quadroFuncionarios: texto, programasEspeciais: texto, site: texto }).strict(),
}).strict();

export type CadastroEmpresa = z.infer<typeof cadastroEmpresaSchema>;
export const perfilCadastralSchema = z.object({ versao: z.literal(1), cadastro: cadastroEmpresaSchema }).strict();
export const salvarCadastroEmpresaSchema = z.object({
  cardId: z.string().min(1).max(150), empresaId: z.number().int().positive(),
  versaoEsperada: z.iso.datetime({ offset: true }), snapshotEsperado: z.string().regex(/^[a-f0-9]{64}$/),
  cadastro: cadastroEmpresaSchema,
}).strict();

export function cadastroDosDadosEmpresa(dados: DadosEmpresaConsolidado): CadastroEmpresa {
  const e = dados.empresa;
  const empresa = { cnpj: e.cnpj, razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia, situacao: e.situacao,
    dataConstituicao: e.dataConstituicao, porte: e.porte, naturezaJuridica: e.naturezaJuridica, capitalSocial: e.capitalSocial, endereco: e.endereco };
  return {
    empresa,
    contatos: dados.contatos.map(({ tipo, valor, titular }) => ({ tipo, valor, titular })),
    pessoas: dados.pessoas.map(({ nome, funcao, telefone, email, dataNascimento, observacoes }) => ({ nome, funcao, telefone, email, dataNascimento, observacoes })),
    cnaes: dados.cnaes, regimeTributario: dados.regimeTributario,
    radar: { situacao: dados.radar.situacao, modalidade: dados.radar.modalidade, submodalidade: dados.radar.submodalidade,
      dataSituacao: dados.radar.dataSituacao, baseLegal: dados.radar.baseLegal, tipoDesabilitacao: dados.radar.tipoDesabilitacao,
      operacoesAutorizadas: dados.radar.operacoesAutorizadas, qualificacao: dados.radar.qualificacao, perse: dados.radar.perse,
      anexoPerse: dados.radar.anexoPerse, dividaTributaria: dados.radar.dividaTributaria }, analiseFiscal: dados.analiseFiscal,
  };
}

/** Perfil manual é cadastral: nunca altera contratos nem identidades globais de pessoas/equipe. */
export function aplicarPerfilCadastral(dados: DadosEmpresaConsolidado, perfil: unknown): DadosEmpresaConsolidado {
  const parsed = perfilCadastralSchema.safeParse(perfil);
  if (!parsed.success) return dados;
  const c = parsed.data.cadastro;
  return { ...dados, ...c, empresa: { ...c.empresa, id: dados.empresa.id }, radar: { ...c.radar, consultadoEm: dados.radar.consultadoEm },
    contatos: c.contatos.map((v) => ({ ...v, fonte: "Cadastro da empresa" })),
    pessoas: c.pessoas.map((v) => ({ ...v, fontes: ["Cadastro da empresa"] })),
  };
}

export const SECOES_CADASTRO_EMPRESA = [
  { titulo: "Cadastro da empresa", campos: [
    ["empresa.cnpj", "CNPJ"], ["empresa.razaoSocial", "Razão social"], ["empresa.nomeFantasia", "Nome fantasia"],
    ["empresa.situacao", "Situação cadastral"], ["empresa.capitalSocial", "Capital social", "numero"],
    ["empresa.dataConstituicao", "Data de abertura"], ["empresa.porte", "Porte"], ["empresa.naturezaJuridica", "Natureza jurídica"],
    ["empresa.endereco.cep", "CEP"], ["empresa.endereco.logradouro", "Logradouro"], ["empresa.endereco.numero", "Número"],
    ["empresa.endereco.bairro", "Bairro"], ["empresa.endereco.municipio", "Município"], ["empresa.endereco.uf", "UF"],
  ] },
  { titulo: "Regime tributário", campos: [
    ["regimeTributario.atual", "Regime atual"], ["regimeTributario.receita", "Regime Receita"],
    ["regimeTributario.simplesNacional", "Simples Nacional", "booleano"], ["regimeTributario.mei", "MEI", "booleano"],
    ["regimeTributario.dataOpcaoSimples", "Opção pelo Simples"], ["regimeTributario.dataExclusaoSimples", "Exclusão do Simples"],
  ] },
  { titulo: "Análise fiscal", campos: [
    ["analiseFiscal.faturamento", "Faturamento informado"], ["analiseFiscal.quadroFuncionarios", "Quadro de funcionários"],
    ["analiseFiscal.programasEspeciais", "Programas especiais"], ["analiseFiscal.site", "Site"],
  ] },
  { titulo: "Dados do RADAR", campos: [
    ["radar.situacao", "Situação do RADAR"], ["radar.modalidade", "Modalidade"], ["radar.submodalidade", "Submodalidade"],
    ["radar.dataSituacao", "Data da situação"], ["radar.baseLegal", "Base legal"], ["radar.tipoDesabilitacao", "Tipo de desabilitação"],
    ["radar.operacoesAutorizadas", "Operações autorizadas"], ["radar.qualificacao", "Qualificação"], ["radar.perse", "PERSE"],
    ["radar.anexoPerse", "Anexo PERSE"], ["radar.dividaTributaria", "Dívida tributária", "numero"],
  ] },
] as const;

export const LISTAS_CADASTRO_EMPRESA = [
  { path: "contatos", titulo: "Telefones e e-mails", campos: [["tipo", "Tipo", "contato"], ["valor", "Contato"], ["titular", "Titular"]], novo: { tipo: "Telefone", valor: "", titular: "" } },
  { path: "pessoas", titulo: "Sócios e pessoas vinculadas", campos: [["nome", "Nome"], ["funcao", "Função"], ["telefone", "Telefone"], ["email", "E-mail"], ["dataNascimento", "Data de nascimento"], ["observacoes", "Observações"]], novo: { nome: "", funcao: null, telefone: null, email: null, dataNascimento: null, observacoes: null } },
  { path: "cnaes", titulo: "CNAEs", campos: [["codigo", "Código"], ["descricao", "Descrição"], ["tipo", "Atividade", "cnae"]], novo: { codigo: "", descricao: "", tipo: "Secundário" } },
  { path: "regimeTributario.historico", titulo: "Histórico tributário", campos: [["periodo", "Período"], ["regime", "Regime"]], novo: { periodo: "", regime: "" } },
] as const;

export function valorCadastro(cadastro: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((v, key) => v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined, cadastro);
}

export function editarValorCadastro(cadastro: CadastroEmpresa, path: string, valor: unknown): CadastroEmpresa {
  const copia = structuredClone(cadastro);
  const partes = path.split(".");
  let destino = copia as unknown as Record<string, unknown>;
  for (const parte of partes.slice(0, -1)) destino = destino[parte] as Record<string, unknown>;
  destino[partes.at(-1)!] = valor;
  return copia;
}

export type AlteracaoCadastroEmpresa = { campo: string; rotulo: string; antes: string | null; depois: string | null };
export function diferencasCadastroEmpresa(antes: CadastroEmpresa, depois: CadastroEmpresa): AlteracaoCadastroEmpresa[] {
  const campos: { path: string; rotulo: string }[] = SECOES_CADASTRO_EMPRESA.flatMap((s) => s.campos.map(([path, rotulo]) => ({ path, rotulo })));
  for (const lista of LISTAS_CADASTRO_EMPRESA) {
    const a = valorCadastro(antes, lista.path) as unknown[]; const b = valorCadastro(depois, lista.path) as unknown[];
    for (let i = 0; i < Math.max(a.length, b.length); i++) for (const [key, rotulo] of lista.campos) {
      campos.push({ path: `${lista.path}.${i}.${key}`, rotulo: `${lista.titulo} · ${i + 1} · ${rotulo}` });
    }
  }
  const apresentar = (v: unknown) => v === null || v === undefined || v === "" ? null : typeof v === "boolean" ? v ? "Sim" : "Não" : String(v);
  return campos.flatMap(({ path, rotulo }) => {
    const a = apresentar(valorCadastro(antes, path)); const b = apresentar(valorCadastro(depois, path));
    return a === b ? [] : [{ campo: path, rotulo, antes: a, depois: b }];
  });
}

export function preencherCadastroComConsulta(atual: CadastroEmpresa, consulta: CadastroEmpresa,
  fontes: { receita: boolean; fiscal: boolean; radar: boolean }, _cnpjAnterior: string, tocados: readonly string[] = []): CadastroEmpresa {
  let novo = structuredClone(atual);
  const protegido = (path: string) => tocados.some((t) => path === t || path.startsWith(t + ".") || t.startsWith(path + "."));
  for (const secao of SECOES_CADASTRO_EMPRESA) for (const [path] of secao.campos) {
    const disponivel = path.startsWith("empresa.") ? fontes.receita
      : path.startsWith("regimeTributario.") ? fontes.receita || fontes.fiscal
        : path.startsWith("analiseFiscal.") ? fontes.fiscal
          : ["radar.qualificacao", "radar.perse", "radar.anexoPerse", "radar.dividaTributaria"].includes(path) ? fontes.fiscal : fontes.radar;
    const valor = valorCadastro(consulta, path);
    if (disponivel && !protegido(path) && valor !== null && valor !== "" && valor !== undefined)
      novo = editarValorCadastro(novo, path, valor);
  }
  for (const lista of LISTAS_CADASTRO_EMPRESA) {
    const valores = valorCadastro(consulta, lista.path) as unknown[];
    if (!protegido(lista.path) && valores.length && (lista.path === "regimeTributario.historico" ? fontes.fiscal : fontes.receita)) {
      const anteriores = structuredClone(valorCadastro(novo, lista.path) as Record<string, unknown>[]);
      const normalizar = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
      const identidade = (v: Record<string, unknown>) => lista.path === "contatos"
        ? `${v.tipo}:${v.tipo === "Telefone" ? String(v.valor).replace(/\D/g, "") : normalizar(v.valor)}`
        : normalizar(v[lista.path === "pessoas" ? "nome" : lista.path === "cnaes" ? "codigo" : "periodo"]);
      for (const valor of valores as Record<string, unknown>[]) {
        const i = anteriores.findIndex((anterior) => identidade(anterior) === identidade(valor));
        const presentes = Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== null && v !== "" && v !== undefined));
        if (i < 0) anteriores.push(valor); else anteriores[i] = { ...anteriores[i], ...presentes };
      }
      novo = editarValorCadastro(novo, lista.path, anteriores);
    }
  }
  return novo;
}
