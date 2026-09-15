import type { CampoMapeamento } from "./tipos";

export function normalizarCabecalho(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const ALIASES_DESTINO: Record<string, string[]> = {
  "data opcao simples": [
    "data opcao", "data da opcao", "data opcao simples nacional", "data de opcao pelo simples",
  ].map(normalizarCabecalho),
  "razao social": ["razao", "razao da empresa", "nome empresa"].map(normalizarCabecalho),
  "nome fantasia": ["fantasia", "nome comercial"].map(normalizarCabecalho),
  "capital social": ["capital", "valor capital social"].map(normalizarCabecalho),
  "cnpj": ["cnpj empresa", "cnpj cliente", "cnpj da empresa"].map(normalizarCabecalho),
  "situacao da habilitacao": [
    "situacao", "situacao habilitacao", "status habilitacao", "status da habilitacao",
  ].map(normalizarCabecalho),
  "data da situacao": ["data situacao", "data status", "data do status"].map(normalizarCabecalho),
  "data de constituicao": [
    "data constituicao", "data const", "data abertura", "data de abertura",
  ].map(normalizarCabecalho),
  "regime tributario": [
    "regime", "regime fiscal", "regime de tributacao", "regime tributacao",
  ].map(normalizarCabecalho),
  "cpf socio": ["cpf do socio", "cpf sócio", "documento socio", "cpf"].map(normalizarCabecalho),
  "nome socio": ["nome do socio", "socio nome", "nome sócio", "socio"].map(normalizarCabecalho),
  "email socio": ["email do socio", "e mail socio", "e-mail socio", "email"].map(normalizarCabecalho),
};

for (let indice = 1; indice <= 5; indice += 1) {
  ALIASES_DESTINO[`ddd${indice}`] = [
    `ddd ${indice}`, `ddd telefone ${indice}`, `ddd fone ${indice}`,
  ].map(normalizarCabecalho);
  ALIASES_DESTINO[`fone${indice}`] = [
    `fone ${indice}`, `telefone ${indice}`, `celular ${indice}`, `telefone${indice}`,
  ].map(normalizarCabecalho);
  ALIASES_DESTINO[`fg whatsapp${indice}`] = [
    `fg whatsapp ${indice}`, `whatsapp ${indice}`, `flag whatsapp ${indice}`,
  ].map(normalizarCabecalho);
}

export function mapearCamposAutomaticos(mapeamento: CampoMapeamento[], colunas: { numero: number; nomeNormalizado: string; nome?: string }[]): CampoMapeamento[] {
  return mapeamento.map((campo) => {
    if (campo.origem !== null || campo.manual) return campo;
    const alvoNormalizado = normalizarCabecalho(campo.destino);
    const aliases = ALIASES_DESTINO[alvoNormalizado] ?? [];
    const candidatos = colunas.filter((coluna) => {
      const nome = normalizarCabecalho(coluna.nomeNormalizado);
      return nome === alvoNormalizado || aliases.includes(nome);
    });
    const unicos = candidatos.filter((coluna, indice) => candidatos.findIndex((item) => item.numero === coluna.numero) === indice);
    if (unicos.length !== 1) return campo;
    const correspondente = unicos[0];
    return { ...campo, origem: correspondente.numero, origemNome: correspondente.nome ?? campo.origemNome, automatico: true };
  });
}
