import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  clientes: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  historicoAlteracaoCliente: {
    createMany: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { ORIGENS_LEAD_PADRAO } from "@/app/PainelAlpha/CadastroClientes/ModalCadastro/origens-lead";
import { CadastrarCliente, salvarAlteracoesGeral } from "@/actions/Clientes";

const NOVAS_ORIGENS = [
  "Discadora",
  "Prospecção ativa (Log Comex)",
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    user: { id: "7", nome: "Ana Responsável" },
  });
  prismaMock.clientes.create.mockResolvedValue({ id: 10 });
  prismaMock.clientes.findUnique.mockResolvedValue({
    id: 10,
    origemLead: "Evento",
  });
  prismaMock.clientes.update.mockResolvedValue({ id: 10 });
  prismaMock.historicoAlteracaoCliente.createMany.mockResolvedValue({ count: 1 });
});

describe("origens padrão do lead no CS & NPS", () => {
  it("disponibiliza as novas origens com a grafia exata", () => {
    expect(ORIGENS_LEAD_PADRAO).toEqual(expect.arrayContaining([...NOVAS_ORIGENS]));
  });

  it("preserva as origens existentes sem duplicidades", () => {
    expect(ORIGENS_LEAD_PADRAO).toEqual(expect.arrayContaining([
      "Tráfego Pago (Meta - Instagram)",
      "Tráfego Pago (Google)",
      "Indicação Parceiro",
      "Indicação Cliente",
      "Evento",
      "China",
    ]));
    expect(new Set(ORIGENS_LEAD_PADRAO).size).toBe(ORIGENS_LEAD_PADRAO.length);
  });

  it("permite criar uma cópia mutável para origens personalizadas no cadastro", () => {
    const listaDoCadastro: string[] = [...ORIGENS_LEAD_PADRAO];

    listaDoCadastro.push("Origem personalizada");

    expect(listaDoCadastro).toContain("Origem personalizada");
    expect(ORIGENS_LEAD_PADRAO).not.toContain("Origem personalizada");
  });
});

describe("persistência das novas origens", () => {
  it.each(NOVAS_ORIGENS)("salva %s integralmente no cadastro", async (origemLead) => {
    const resultado = await CadastrarCliente({
      cnpj: "12.345.678/0001-90",
      razaoSocial: "Empresa Teste",
      servicos: "Consultoria",
      origemLead,
    }, []);

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.clientes.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ origemLead }),
    });
  });

  it.each(NOVAS_ORIGENS)("salva %s integralmente na edição", async (origemLead) => {
    const resultado = await salvarAlteracoesGeral(10, { origemLead });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.clientes.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({ origemLead }),
    });
  });
});
