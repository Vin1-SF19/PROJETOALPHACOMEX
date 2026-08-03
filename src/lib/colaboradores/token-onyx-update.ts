export function getTokenOnyxUpdate(
  isAdmin: boolean,
  editandoToken: boolean,
  valor: string,
): { token_onyx?: string } {
  const token = valor.trim();

  if (!isAdmin || !editandoToken || !token) return {};

  return { token_onyx: token };
}
