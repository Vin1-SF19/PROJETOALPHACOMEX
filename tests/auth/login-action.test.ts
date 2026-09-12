import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
}));

vi.mock("../../auth", () => ({ signIn: mocks.signIn }));

import loginAction from "@/lib/loginAction";

function credenciais(email = " colaborador@alpha.com ", senha = "senha segura"): FormData {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("senha", senha);
  return formData;
}

describe("loginAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signIn.mockResolvedValue("/PainelAlpha");
  });

  it("valida, normaliza o e-mail e aguarda a emissão da sessão antes do sucesso", async () => {
    let concluirSignIn: ((url: string) => void) | undefined;
    mocks.signIn.mockReturnValueOnce(new Promise<string>((resolve) => {
      concluirSignIn = resolve;
    }));
    let actionConcluida = false;

    const resultadoPendente = loginAction(null, credenciais(" COLABORADOR@ALPHA.COM "))
      .then((resultado) => {
        actionConcluida = true;
        return resultado;
      });

    await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
    expect(actionConcluida).toBe(false);
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "colaborador@alpha.com",
      senha: "senha segura",
      redirect: false,
      redirectTo: "/PainelAlpha",
    });

    concluirSignIn?.("/PainelAlpha");
    await expect(resultadoPendente).resolves.toEqual({ success: true });
  });

  it.each([
    ["e-mail ausente", "", "senha segura"],
    ["e-mail inválido", "nao-e-email", "senha segura"],
    ["senha ausente", "colaborador@alpha.com", ""],
    ["e-mail acima do limite", `${"a".repeat(245)}@alpha.com`, "senha segura"],
    ["senha acima do limite", "colaborador@alpha.com", "s".repeat(257)],
  ])("rejeita %s antes de chamar o provedor", async (_cenario, email, senha) => {
    await expect(loginAction(null, credenciais(email, senha))).resolves.toEqual({
      success: false,
      message: "Dados de Login Incorretos",
    });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("rejeita campos ausentes sem lançar exceção", async () => {
    await expect(loginAction(null, new FormData())).resolves.toEqual({
      success: false,
      message: "Dados de Login Incorretos",
    });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("retorna a mensagem pública exata para CredentialsSignin", async () => {
    mocks.signIn.mockRejectedValueOnce(
      Object.assign(new Error("credenciais rejeitadas"), { type: "CredentialsSignin" }),
    );

    await expect(loginAction(null, credenciais())).resolves.toEqual({
      success: false,
      message: "Dados de Login Incorretos",
    });
  });

  it("não vaza detalhes de erros internos", async () => {
    mocks.signIn.mockRejectedValueOnce(new Error("AUTH_SECRET=valor-sensivel"));

    const resultado = await loginAction(null, credenciais());

    expect(resultado).toEqual({
      success: false,
      message: "Não foi possível realizar o login. Tente novamente.",
    });
    expect("message" in resultado ? resultado.message : "").not.toContain("valor-sensivel");
  });
});
