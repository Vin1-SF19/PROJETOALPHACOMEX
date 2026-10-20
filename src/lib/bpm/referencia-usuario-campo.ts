type DescritorReferenciaUsuario = {
  tipo: string;
  escopo?: string;
  fonteEntidade?: string | null;
  fonteAtributo?: string | null;
};

/** Somente fontes que representam uma referência de usuário podem receber nome. */
export function campoEhReferenciaAutomaticaUsuarioBpm(campo: DescritorReferenciaUsuario): boolean {
  return campo.tipo === "usuario"
    && campo.escopo === "GLOBAL"
    && campo.fonteEntidade === "CARD"
    && campo.fonteAtributo === "responsavelId";
}

export function idUsuarioReferenciaCampoBpm(valor: string | null): number | null {
  if (!valor || !/^\d+$/.test(valor.trim())) return null;
  const id = Number(valor.trim());
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
