/**
 * Substitui placeholders numa mensagem de template de onboarding.
 * Suporta dois formatos por compatibilidade retroativa:
 * - `[CHAVE]` (formato atual, usado nos botões de inserção da UI de templates)
 * - `{chave}` (formato legado, aceito em templates cadastrados antes do [CHAVE])
 *
 * `valores` deve usar as chaves em maiúsculas (ex: `{ LOGIN: "...", SENHA: "..." }`);
 * a busca por `{chave}` minúscula é derivada automaticamente.
 */
export function substituirPlaceholders(mensagem: string, valores: Record<string, string>): string {
  return Object.entries(valores).reduce((texto, [chave, valor]) => {
    const colchetes = new RegExp(`\\[${chave}\\]`, "g");
    const chaves = new RegExp(`\\{${chave.toLowerCase()}\\}`, "g");
    return texto.replace(colchetes, valor).replace(chaves, valor);
  }, mensagem);
}
