import { describe, expect, it } from "vitest";
import { CANAIS_ORIGEM_PADRAO } from "@/lib/comercial/canais-origem";
import { ORIGENS_LEAD_PADRAO } from "@/app/PainelAlpha/CadastroClientes/ModalCadastro/origens-lead";

describe("canais de origem compartilhados", () => {
  it("mantém a mesma fonte do cadastro de clientes e não repete opções", () => {
    expect(ORIGENS_LEAD_PADRAO).toBe(CANAIS_ORIGEM_PADRAO);
    expect(new Set(CANAIS_ORIGEM_PADRAO).size).toBe(CANAIS_ORIGEM_PADRAO.length);
  });
  it("preserva todos os canais que já existiam em Metas e Cadastro de Clientes", () => {
    expect(CANAIS_ORIGEM_PADRAO).toEqual(expect.arrayContaining([
      "Tráfego Pago (Meta - Instagram)", "Tráfego Pago (Google)", "Indicação Parceiro", "Indicação Cliente",
      "WhatsApp", "Instagram", "Orgânico", "Evento", "China", "Discadora", "Prospecção ativa (Log Comex)", "Prospecção ativa", "Outro",
    ]));
  });
});
