export type OpcaoUsuarioCampoBpm = { id: number; nome: string; ativo: boolean };

export function idUsuarioCampoBpm(valor: string | null | undefined): number | null {
  const texto = valor?.trim() ?? "";
  if (!/^\d+$/.test(texto)) return null;
  const id = Number(texto);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** O nome é apresentação; o valor enviado ao servidor continua sendo a referência. */
export function nomeUsuarioCampoBpm(
  valor: string | null | undefined,
  usuarios: readonly Pick<OpcaoUsuarioCampoBpm, "id" | "nome">[],
): string {
  if (!valor?.trim()) return "";
  if (!/^\d+$/.test(valor.trim())) return valor.trim();
  const id = idUsuarioCampoBpm(valor);
  return usuarios.find((usuario) => usuario.id === id)?.nome || "Usuário indisponível";
}
