import { timingSafeEqual } from "node:crypto";

export function autorizarCron(
  authorizationHeader: string | null,
  segredoEsperado: string | undefined,
): boolean {
  if (!segredoEsperado || !authorizationHeader?.startsWith("Bearer ")) return false;

  const recebido = Buffer.from(authorizationHeader.slice("Bearer ".length), "utf8");
  const esperado = Buffer.from(segredoEsperado, "utf8");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

