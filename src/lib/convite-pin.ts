import db from "@/lib/prisma";

const MAX_TENTATIVAS = 5;
const SUSPENSAO_MS = 60_000; // 1 minuto

type ResultadoValidacao = { ok: true } | { ok: false; error: string; status: number };

/**
 * Valida o PIN de um convite com rate-limit compartilhado entre todas as
 * superfícies que usam PIN (entrada no wizard via StepPin, busca automática
 * de CPF). 5 tentativas erradas suspendem o convite por 1 minuto — depois
 * disso, novas tentativas são liberadas automaticamente sem precisar gerar
 * um novo link.
 *
 * `permitirSemPin` controla o comportamento quando o convite não tem PIN
 * cadastrado (gerado antes desta feature): `true` (default, usado no StepPin)
 * deixa passar — não há o que conferir e não bloqueia convite legado; `false`
 * (usado na consulta de CPF, que tem custo por chamada) bloqueia, mantendo a
 * regra original de não gastar chamada paga sem essa camada de proteção.
 */
export async function validarPinComRateLimit(
  token: string,
  pin: string,
  permitirSemPin: boolean = true
): Promise<ResultadoValidacao> {
  const convite = await db.conviteParceiro.findUnique({
    where: { token },
    select: { id: true, status: true, expiraEm: true, pin: true, tentativasPin: true, suspensoAte: true },
  });

  if (!convite) return { ok: false, error: "Convite inválido", status: 404 };
  if (convite.status !== "PENDENTE") {
    return { ok: false, error: "Este convite não está mais disponível", status: 403 };
  }
  if (convite.expiraEm.getTime() < Date.now()) {
    return { ok: false, error: "Este convite expirou", status: 403 };
  }

  if (convite.suspensoAte && convite.suspensoAte.getTime() > Date.now()) {
    const segundosRestantes = Math.ceil((convite.suspensoAte.getTime() - Date.now()) / 1000);
    return {
      ok: false,
      error: `Muitas tentativas incorretas. Tente novamente em ${segundosRestantes} segundo${segundosRestantes === 1 ? "" : "s"}.`,
      status: 429,
    };
  }

  if (!convite.pin) {
    if (permitirSemPin) return { ok: true };
    return {
      ok: false,
      error: "Este link de convite não suporta busca automática — preencha manualmente",
      status: 403,
    };
  }

  if (convite.pin !== pin) {
    const novasTentativas = convite.tentativasPin + 1;
    if (novasTentativas >= MAX_TENTATIVAS) {
      await db.conviteParceiro.update({
        where: { id: convite.id },
        data: { tentativasPin: 0, suspensoAte: new Date(Date.now() + SUSPENSAO_MS) },
      });
      return {
        ok: false,
        error: "PIN incorreto. Última tentativa antes da suspensão temporária — convite suspenso por 1 minuto.",
        status: 401,
      };
    }
    await db.conviteParceiro.update({ where: { id: convite.id }, data: { tentativasPin: novasTentativas } });
    return { ok: false, error: "PIN incorreto", status: 401 };
  }

  if (convite.tentativasPin > 0) {
    await db.conviteParceiro.update({ where: { id: convite.id }, data: { tentativasPin: 0 } });
  }
  return { ok: true };
}
