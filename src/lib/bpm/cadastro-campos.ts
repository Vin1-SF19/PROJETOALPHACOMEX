/** Somente seleções cadastrais editáveis aceitam escrita livre; referências de equipe permanecem protegidas. */
export function campoCadastralTextoLivre(campo: {
  tipo: string; fonteEntidade?: string | null; editavel?: boolean; somenteLeitura?: boolean;
}) {
  return campo.tipo === "selecao" && ["CLIENTE", "CONTATO"].includes(campo.fonteEntidade ?? "")
    && campo.editavel !== false && campo.somenteLeitura !== true;
}

/** Aliases publicados de endereço: não deduzir semântica por rótulos editáveis. */
export const ENDERECOS_CADASTRAIS: Readonly<Record<string, "logradouro" | "numero" | "complemento" | "bairro" | "cep" | "municipio" | "uf">> = {
  "alpha.radar.contrato.rua": "logradouro", "alpha.rua": "logradouro",
  "alpha.radar.contrato.numero": "numero", "alpha.numero": "numero",
  "alpha.radar.contrato.complemento": "complemento", "alpha.complemento": "complemento",
  "alpha.radar.contrato.bairro": "bairro", "alpha.bairro": "bairro",
  "alpha.radar.contrato.cep": "cep", "alpha.cep": "cep",
  "alpha.municipio": "municipio", "alpha.estado": "uf",
};
