import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  card: vi.fn(), campos: vi.fn(), usuarios: vi.fn(), execucao: vi.fn(), canonicos: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCard: { findFirst: m.card }, bpmCampo: { findMany: m.campos },
  usuarios: { findMany: m.usuarios }, bpmAutomacaoExecucao: { findFirst: m.execucao },
} }));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({ carregarValoresCanonicosCampos: m.canonicos }));
import { carregarResumoContratacao } from "@/lib/bpm/resumo-contratacao-server";

beforeEach(() => {
  vi.clearAllMocks();
  m.card.mockResolvedValue({
    id: "financeiro", etapa: { nome: "Concluídos" }, empresa: { cnpj: null, razaoSocial: "Cliente" }, concluidoEm: null,
    campoValores: [{ campoId: "vendedor", valor: "42" }], anexos: [], historico: [], vinculosOrigem: [], vinculosDestino: [],
  });
  m.campos.mockResolvedValue([{ id: "vendedor", chave: "alpha.vendedor.a", escopo: "CARD", fonteEntidade: null, fonteAtributo: null }]);
  m.canonicos.mockResolvedValue({});
  m.usuarios.mockResolvedValue([{ id: 42, nome: "Closer original", status: "INATIVO" }]);
  m.execucao.mockResolvedValue(null);
});

it("resumo mostra nome do closer referenciado mesmo inativo", async () => {
  const resumo = await carregarResumoContratacao("financeiro");
  expect(resumo?.campos.find((campo) => campo.nome === "Vendedor responsável")?.valor).toBe("Closer original");
  expect(m.usuarios).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [42] } } }));
});

it("preserva nome já gravado como texto em registros legados", async () => {
  const card = await m.card();
  m.card.mockResolvedValue({ ...card, campoValores: [{ campoId: "vendedor", valor: "Closer legado" }] });
  const resumo = await carregarResumoContratacao("financeiro");
  expect(resumo?.campos.find((campo) => campo.nome === "Vendedor responsável")?.valor).toBe("Closer legado");
  expect(m.usuarios).not.toHaveBeenCalled();
});

it("não mostra um ID sem usuário correspondente", async () => {
  m.usuarios.mockResolvedValue([]);
  const resumo = await carregarResumoContratacao("financeiro");
  expect(resumo?.campos.find((campo) => campo.nome === "Vendedor responsável")?.valor).toBe("Usuário indisponível");
});
