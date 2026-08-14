import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  cliente: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  clienteServico: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  clienteServicoHistorico: {
    createMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { ORIGENS_LEAD_PADRAO } from "@/app/PainelAlpha/CadastroClientes/ModalCadastro/origens-lead";
import { CadastrarCliente, salvarAlteracoesServico } from "@/actions/Clientes";

const NOVAS_ORIGENS = [
  "Discadora",
  "Prospecção ativa (Log Comex)",
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    user: { id: "7", nome: "Ana Responsável" },
  });
  prismaMock.cliente.findUnique.mockResolvedValue(null);
  prismaMock.cliente.create.mockResolvedValue({ id: 501 });
  prismaMock.$transaction.mockImplementation(async (fn) => fn({
    clienteServico: { create: prismaMock.clienteServico.create },
    pessoa: { upsert: vi.fn() },
    pessoaClienteVinculo: { upsert: vi.fn() },
  }));
  prismaMock.clienteServico.create.mockResolvedValue({ id: 10 });
  prismaMock.clienteServico.findUnique.mockResolvedValue({
    id: 10,
    origemLead: "Evento",
  });
  prismaMock.clienteServico.update.mockResolvedValue({ id: 10 });
  prismaMock.clienteServicoHistorico.createMany.mockResolvedValue({ count: 1 });
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

describe("persistência das novas origens (Fase 3.6 do Cliente Master)", () => {
  it.each(NOVAS_ORIGENS)("salva %s integralmente no cadastro", async (origemLead) => {
    const resultado = await CadastrarCliente({
      cnpj: "12.345.678/0001-90",
      razaoSocial: "Empresa Teste",
      servico: "Consultoria",
      origemLead,
    }, []);

    expect(resultado).toEqual({ success: true, clienteServicoId: 10 });
    expect(prismaMock.clienteServico.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ origemLead }),
    });
  });

  it.each(NOVAS_ORIGENS)("salva %s integralmente na edição", async (origemLead) => {
    const resultado = await salvarAlteracoesServico(10, {
      analistaResponsavel: null,
      dataContratacao: null,
      status: "Em Andamento",
      nps: null,
      feedbackGoogle: false,
      nomeGoogle: null,
      embasamento: null,
      origemLead,
      dataExito: null,
      formaPagamento: null,
      valorContrato: null,
      closerNome: null,
    });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.clienteServico.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({ origemLead }),
    });
  });
});
