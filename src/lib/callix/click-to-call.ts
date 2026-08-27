import "server-only";

type CallixResposta = {
  click_to_call_id?: unknown;
  message?: unknown;
};

type InicioLigacaoCallix =
  | { success: true; data: { id: string; message: string } }
  | { success: false; error: string };

export function normalizarTelefoneCallix(telefone: string): string | null {
  const normalizado = telefone.replace(/\D/g, "");
  return normalizado.length >= 8 && normalizado.length <= 15 ? normalizado : null;
}

function obterConfiguracaoCallix():
  | { success: true; endpoint: string; token: string }
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
    return { success: true, endpoint: url.toString(), token };
  } catch {
    return { success: false, error: "Configuração da Callix inválida." };
  }
}

/** Dispara uma chamada pela API da Callix sem expor o token ao navegador. */
export async function iniciarLigacaoCallix(telefone: string, userId: string): Promise<InicioLigacaoCallix> {
  const phone = normalizarTelefoneCallix(telefone);
  if (!phone) return { success: false, error: "Telefone inválido para ligação." };
  if (!userId.trim()) return { success: false, error: "Usuário não habilitado para a Callix." };

  const configuracao = obterConfiguracaoCallix();
  if (!configuracao.success) return configuracao;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const resposta = await fetch(configuracao.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configuracao.token}`,
      },
      body: JSON.stringify({ user_id: userId.trim(), phone }),
      signal: controller.signal,
    });
    const corpo = (await resposta.json().catch(() => null)) as CallixResposta | null;

    if (resposta.status !== 200 || typeof corpo?.click_to_call_id !== "string") {
      console.error("[Callix click-to-call] resposta inválida", { status: resposta.status });
      return { success: false, error: "Não foi possível iniciar a ligação na Callix." };
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
