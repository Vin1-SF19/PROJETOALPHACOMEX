import "server-only";

type CallixResposta = {
  click_to_call_id?: unknown;
  message?: unknown;
  errors?: Array<{ title?: unknown }>;
};

type CallixUsuariosResposta = {
  data?: Array<{
    id?: unknown;
    attributes?: { login?: unknown };
  }>;
};

type InicioLigacaoCallix =
  | { success: true; data: { id: string; message: string } }
  | { success: false; error: string };

export function normalizarTelefoneCallix(telefone: string): string | null {
  const normalizado = telefone.replace(/\D/g, "");
  return normalizado.length >= 8 && normalizado.length <= 15 ? normalizado : null;
}

function obterConfiguracaoCallix():
  | { success: true; endpoint: string; usuariosEndpoint: string; token: string }
  | { success: false; error: string } {
  const baseUrl = process.env.CALLIX_BASE_URL?.trim();
  const token = process.env.TOKEN_CALLIX?.trim();

  if (!baseUrl || !token) {
    return { success: false, error: "Integração Callix não configurada." };
  }

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:") throw new Error("URL não segura");
    url.pathname = `${url.pathname.replace(/\/$/, "")}/api/v1/click_to_call`;
    const endpoint = url.toString();
    url.pathname = `${url.pathname.replace(/\/click_to_call$/, "")}/users`;
    return { success: true, endpoint, usuariosEndpoint: url.toString(), token };
  } catch {
    return { success: false, error: "Configuração da Callix inválida." };
  }
}

async function obterLoginDoAgenteCallix(
  configuracao: Extract<ReturnType<typeof obterConfiguracaoCallix>, { success: true }>,
  userId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const resposta = await fetch(configuracao.usuariosEndpoint, {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${configuracao.token}`,
    },
    signal,
  });
  const corpo = (await resposta.json().catch(() => null)) as CallixUsuariosResposta | null;
  if (!resposta.ok || !Array.isArray(corpo?.data)) return null;

  const agente = corpo.data.find((item) => String(item.id) === userId);
  return typeof agente?.attributes?.login === "string" && agente.attributes.login.trim()
    ? agente.attributes.login.trim()
    : null;
}

/** Dispara uma chamada pela API da Callix sem expor o token ao navegador. */
export async function iniciarLigacaoCallix(telefone: string, userId: string): Promise<InicioLigacaoCallix> {
  const phone = normalizarTelefoneCallix(telefone);
  if (!phone) return { success: false, error: "Telefone inválido para ligação." };
  if (!userId.trim()) return { success: false, error: "Usuário não habilitado para o Callix." };

  const configuracao = obterConfiguracaoCallix();
  if (!configuracao.success) return configuracao;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const username = await obterLoginDoAgenteCallix(configuracao, userId.trim(), controller.signal);
    if (!username) {
      return { success: false, error: "Não foi possível localizar o login do agente no Callix." };
    }

    const resposta = await fetch(configuracao.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${configuracao.token}`,
      },
      body: JSON.stringify({
        data: {
          type: "click_to_call",
          attributes: { username, phone },
        },
      }),
      signal: controller.signal,
    });
    const corpo = (await resposta.json().catch(() => null)) as CallixResposta | null;

    if (resposta.status !== 200 || typeof corpo?.click_to_call_id !== "string") {
      console.error("[Callix click-to-call] resposta inválida", { status: resposta.status });
      const erroDisponibilidade = corpo?.errors?.find(
        (erro) => erro?.title === "User not available to receive this call.",
      );
      if (erroDisponibilidade) {
        return {
          success: false,
          error: "O agente configurado não está disponível para receber a ligação no Callix.",
        };
      }
      const erroPorStatus: Record<number, string> = {
        400: "O Callix recusou a ligação. Verifique o ID do agente e o telefone de destino.",
        401: "A autenticação com o Callix falhou. Verifique a configuração da integração.",
        404: "O agente configurado não foi encontrado no Callix.",
      };
      return { success: false, error: erroPorStatus[resposta.status] ?? "Não foi possível iniciar a ligação no Callix." };
    }

    return {
      success: true,
      data: {
        id: corpo.click_to_call_id,
        message: typeof corpo.message === "string" ? corpo.message : "Chamada enviada.",
      },
    };
  } catch (error) {
    console.error("[Callix click-to-call] falha de comunicação", error);
    return { success: false, error: "Não foi possível conectar à Callix." };
  } finally {
    clearTimeout(timeout);
  }
}
