import { describe, expect, it } from "vitest";
import {
  combinarParticipantesReuniao,
  emailClienteReuniaoSchema,
  selecionarEmailClienteReuniao,
  selecionarEmailReuniaoDoCard,
  selecionarEmailConvidadoUnico,
} from "@/lib/bpm/email-reuniao";

const vinculo = (email: string | null, principal = false, ativo = true) => ({
  ativo,
  principal,
  pessoa: { email },
});

describe("e-mail do cliente na reunião", () => {
  it("normaliza endereço válido e rejeita ausente ou inválido", () => {
    expect(emailClienteReuniaoSchema.parse("  CLIENTE@EXEMPLO.COM ")).toBe("cliente@exemplo.com");
    expect(emailClienteReuniaoSchema.safeParse("").success).toBe(false);
    expect(emailClienteReuniaoSchema.safeParse("cliente@exemplo").success).toBe(false);
  });

  it("prefere o único contato principal ativo com e-mail válido", () => {
    expect(selecionarEmailClienteReuniao([
      vinculo("principal@exemplo.com", true),
      vinculo("outro@exemplo.com"),
      vinculo("inativo@exemplo.com", true, false),
    ])).toBe("principal@exemplo.com");
  });

  it("usa o único contato ativo quando não existe principal válido", () => {
    expect(selecionarEmailClienteReuniao([
      vinculo(null, true),
      vinculo(" UNICO@EXEMPLO.COM "),
    ])).toBe("unico@exemplo.com");
  });

  it("não escolhe automaticamente entre destinatários ambíguos", () => {
    expect(selecionarEmailClienteReuniao([
      vinculo("um@exemplo.com", true),
      vinculo("dois@exemplo.com", true),
    ])).toBeNull();
    expect(selecionarEmailClienteReuniao([
      vinculo("um@exemplo.com"),
      vinculo("dois@exemplo.com"),
    ])).toBeNull();
  });

  it("preserva participantes válidos e inclui o cliente sem duplicar", () => {
    expect(combinarParticipantesReuniao([
      { email: "convidado@exemplo.com" },
      { email: "CLIENTE@EXEMPLO.COM" },
      { email: "invalido" },
    ], " cliente@exemplo.com ")).toEqual([
      "convidado@exemplo.com",
      "cliente@exemplo.com",
    ]);
  });

  it("reabre a reunião com o e-mail usado no evento, mesmo com contato diferente ou ambíguo", () => {
    const contatos = [vinculo("contato@exemplo.com"), vinculo("outro@exemplo.com")];
    expect(selecionarEmailReuniaoDoCard("evento-1", {
      googleEventId: "evento-1", emailCliente: " CLIENTE@EXEMPLO.COM ",
    }, contatos)).toBe("cliente@exemplo.com");
    expect(selecionarEmailReuniaoDoCard("evento-1", {
      googleEventId: "evento-1", emailCliente: "NOVO@EXEMPLO.COM",
    }, contatos)).toBe("novo@exemplo.com");
  });

  it("usa o contato apenas antes do agendamento ou em registro legado sem e-mail", () => {
    const contatos = [vinculo("contato@exemplo.com")];
    expect(selecionarEmailReuniaoDoCard(null, null, contatos)).toBe("contato@exemplo.com");
    expect(selecionarEmailReuniaoDoCard("evento-1", {
      googleEventId: "evento-1", emailCliente: null,
    }, contatos)).toBe("contato@exemplo.com");
    expect(selecionarEmailReuniaoDoCard("evento-2", {
      googleEventId: "evento-1", emailCliente: "antigo@exemplo.com",
    }, contatos)).toBe("contato@exemplo.com");
  });

  it("recupera um convidado inequívoco de reunião antiga sem escolher entre vários", () => {
    expect(selecionarEmailConvidadoUnico([
      { email: "organizador@exemplo.com", organizador: true },
      { email: " CLIENTE@EXEMPLO.COM ", organizador: false },
    ])).toBe("cliente@exemplo.com");
    expect(selecionarEmailConvidadoUnico([
      { email: "um@exemplo.com", organizador: false },
      { email: "dois@exemplo.com", organizador: false },
    ])).toBeNull();
  });
});
