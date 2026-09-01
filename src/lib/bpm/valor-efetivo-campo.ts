export type DadosMestresCampoBpm = {
  empresa: {
    cnpj: string | null;
    razaoSocial: string;
    nomeFantasia: string | null;
  };
  contatoPrincipal: {
    nome: string;
    celular: string;
    email: string | null;
    telefoneExtra: string | null;
  } | null;
};

function normalizarSemanticaCampo(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

type FonteMestre =
  | "CNPJ"
  | "RAZAO_SOCIAL"
  | "NOME_FANTASIA"
  | "CONTATO_NOME"
  | "CONTATO_TELEFONE"
  | "CONTATO_EMAIL";

const FONTE_POR_NOME = new Map<string, FonteMestre>([
  ["cnpj", "CNPJ"],
  ["empresa", "RAZAO_SOCIAL"],
  ["cliente", "RAZAO_SOCIAL"],
  ["nome da empresa", "RAZAO_SOCIAL"],
  ["razao social", "RAZAO_SOCIAL"],
  ["nome fantasia", "NOME_FANTASIA"],
  ["nome do responsavel", "CONTATO_NOME"],
  ["contato", "CONTATO_NOME"],
  ["contato/nome do responsavel", "CONTATO_NOME"],
  ["telefone", "CONTATO_TELEFONE"],
  ["celular", "CONTATO_TELEFONE"],
  ["telefone do responsavel", "CONTATO_TELEFONE"],
  ["e-mail", "CONTATO_EMAIL"],
  ["email", "CONTATO_EMAIL"],
  ["e-mail do responsavel", "CONTATO_EMAIL"],
  ["email do responsavel", "CONTATO_EMAIL"],
]);

function fonteMestreDoCampo(nome: string): FonteMestre | null {
  return FONTE_POR_NOME.get(normalizarSemanticaCampo(nome)) ?? null;
}

export function campoBpmPossuiFonteMestre(nome: string): boolean {
  return fonteMestreDoCampo(nome) !== null;
}

function valorNaoVazio(valor: string | null | undefined): string | null {
  return valor?.trim() ? valor : null;
}

/**
 * Resolve o valor efetivo sem criar sincronização bidirecional: o valor local
 * válido sempre vence; a fonte mestre apenas preenche uma lacuna.
 */
export function resolverValorEfetivoCampoBpm(params: {
  nomeCampo: string;
  valorPersistido: string | null;
  dadosMestres: DadosMestresCampoBpm | null;
}): string | null {
  const persistido = valorNaoVazio(params.valorPersistido);
  if (persistido) return params.valorPersistido;
  if (!params.dadosMestres) return params.valorPersistido;

  const { empresa, contatoPrincipal } = params.dadosMestres;
  switch (fonteMestreDoCampo(params.nomeCampo)) {
    case "CNPJ":
      return valorNaoVazio(empresa.cnpj) ?? params.valorPersistido;
    case "RAZAO_SOCIAL":
      return valorNaoVazio(empresa.razaoSocial) ?? params.valorPersistido;
    case "NOME_FANTASIA":
      return valorNaoVazio(empresa.nomeFantasia) ?? params.valorPersistido;
    case "CONTATO_NOME":
      return valorNaoVazio(contatoPrincipal?.nome) ?? params.valorPersistido;
    case "CONTATO_TELEFONE":
      return valorNaoVazio(contatoPrincipal?.celular)
        ?? valorNaoVazio(contatoPrincipal?.telefoneExtra)
        ?? params.valorPersistido;
    case "CONTATO_EMAIL":
      return valorNaoVazio(contatoPrincipal?.email) ?? params.valorPersistido;
    default:
      return params.valorPersistido;
  }
}
