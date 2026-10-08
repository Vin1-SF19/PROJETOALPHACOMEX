import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    effects: [] as Array<() => void | (() => void)>,
    setters: [] as Array<ReturnType<typeof vi.fn>>,
    states: [] as unknown[],
    cursor: 0,
    memos: [] as unknown[],
    session: { user: { id: "42", nome: "Alexandra", role: "Serviços Gerais" } },
    tarefas: vi.fn(), reservas: vi.fn(), diretrizes: vi.fn(),
    produtos: vi.fn(), compras: vi.fn(), erro: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
    const original = await importOriginal<typeof import("react")>();
    return {
        ...original,
        useEffect: (effect: () => void | (() => void)) => { mocks.effects.push(effect); },
        useState: (initial: unknown) => {
            const index = mocks.cursor++;
            if (index >= mocks.states.length) {
                mocks.states[index] = initial;
                mocks.setters[index] = vi.fn((next: unknown) => {
                    mocks.states[index] = typeof next === "function" ? next(mocks.states[index]) : next;
                });
            }
            return [mocks.states[index], mocks.setters[index]];
        },
        useMemo: (calculate: () => unknown) => {
            const value = calculate();
            mocks.memos.push(value);
            return value;
        },
    };
});
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: mocks.session }) }));
vi.mock("@/actions/Tarefas", () => ({ BuscarTarefasPorEmail: mocks.tarefas, AlternarStatusTarefa: vi.fn() }));
vi.mock("@/actions/Reservas", () => ({ buscarReservasAtivas: mocks.reservas, BuscarTodasDiretrizes: mocks.diretrizes }));
vi.mock("@/actions/Estoque", () => ({ buscarProdutos: mocks.produtos, buscarListaCompra: mocks.compras }));
vi.mock("sonner", () => ({ toast: { error: mocks.erro } }));
vi.mock("@/app/PainelAlpha/PainelTarefas/painelTarefaSG/ListaCompras", () => ({ default: () => null }));

import PainelTarefas from "@/app/PainelAlpha/PainelTarefas/painelTarefaSG/page";

const reserva = {
    id: 7, sala: "Sala de Reuniões", usuario: "Edvan Alexandre de Oliveira Brasil",
    inicio: new Date("2026-10-07T15:00:00-03:00"), fim: new Date("2026-10-07T17:00:00-03:00"),
    tipo: "Cliente", paoDeQueijo: true, status: "Agendado",
};
const cleanups: Array<() => void> = [];

function montarPainel() {
    PainelTarefas();
    for (const effect of mocks.effects) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
    }
}

async function finalizarConsultas() {
    // Flush das consultas iniciadas pelos efeitos, incluindo Promise.all.
    for (let index = 0; index < 12; index++) await Promise.resolve();
}

describe("agenda de copa independente da gestão de estoque", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
        mocks.effects.length = 0;
        mocks.setters.length = 0;
        mocks.states.length = 0;
        mocks.memos.length = 0;
        mocks.cursor = 0;
        mocks.tarefas.mockResolvedValue([{ id: "tarefa-1", texto: "Preparar sala" }]);
        mocks.reservas.mockResolvedValue([reserva]);
        mocks.diretrizes.mockResolvedValue([]);
        mocks.produtos.mockResolvedValue([{ id: "produto-1" }]);
        mocks.compras.mockResolvedValue([{ id: "compra-1" }]);
    });
    afterEach(() => {
        cleanups.splice(0).forEach(cleanup => cleanup());
        vi.useRealTimers();
    });

    it.each(["compras", "produtos"] as const)("carrega copa quando %s nega acesso", async (consulta) => {
        mocks[consulta].mockRejectedValue(new Error("A gestão do Estoque Alpha é restrita aos setores autorizados."));
        montarPainel();
        await finalizarConsultas();
        expect(mocks.setters[3]).toHaveBeenCalledWith([reserva]);
        expect(mocks.setters[2]).toHaveBeenCalledWith([{ id: "tarefa-1", texto: "Preparar sala" }]);
        expect(mocks.setters[4]).toHaveBeenLastCalledWith(false);
        expect(mocks.setters[12]).toHaveBeenLastCalledWith(false);
        expect(mocks.erro).not.toHaveBeenCalled();
        // Recalcular a agenda com os dados carregados verifica também o card de copa.
        mocks.cursor = 0;
        mocks.states[1] = new Date("2026-10-07T12:00:00-03:00");
        mocks.memos.length = 0;
        PainelTarefas();
        expect(mocks.memos).toContainEqual(expect.arrayContaining([
            expect.objectContaining({
                id: "reserva-7", texto: "OCUPAÇÃO: SALA DE REUNIÕES",
                responsavel: reserva.usuario, temCopa: true,
                descricao: expect.stringContaining("COM PÃO DE QUEIJO"),
                horario: reserva.inicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            }),
        ]));
    });

    it("falha genérica do estoque não impede sincronizações posteriores", async () => {
        mocks.compras.mockRejectedValue(new Error("Estoque indisponível"));
        montarPainel();
        await finalizarConsultas();
        mocks.reservas.mockClear();
        await vi.advanceTimersByTimeAsync(40000);
        expect(mocks.reservas).toHaveBeenCalled();
        expect(mocks.setters[3]).toHaveBeenLastCalledWith([reserva]);
        expect(mocks.setters[4]).toHaveBeenLastCalledWith(false);
    });

    it("carrega a mesma reserva e compras quando o estoque autoriza", async () => {
        montarPainel();
        await finalizarConsultas();
        expect(mocks.setters[3]).toHaveBeenCalledWith([reserva]);
        expect(mocks.setters[11]).toHaveBeenCalledWith([{ id: "compra-1" }]);
        expect(mocks.setters[10]).toHaveBeenCalledWith([{ id: "produto-1" }]);
        expect(mocks.setters[12]).toHaveBeenLastCalledWith(true);
        expect(mocks.setters[4]).toHaveBeenLastCalledWith(false);
    });

    it("não aguarda uma consulta lenta de estoque para carregar a copa", async () => {
        mocks.compras.mockReturnValue(new Promise(() => {}));
        montarPainel();
        await finalizarConsultas();
        expect(mocks.setters[3]).toHaveBeenCalledWith([reserva]);
        expect(mocks.setters[4]).toHaveBeenLastCalledWith(false);
    });

    it.each(["reservas", "tarefas"] as const)("trata falha de %s e recupera na próxima sincronização", async (consulta) => {
        const valor = consulta === "reservas" ? [reserva] : [{ id: "tarefa-1", texto: "Preparar sala" }];
        mocks[consulta].mockRejectedValue(new Error("Consulta indisponível"));
        montarPainel();
        await finalizarConsultas();
        expect(mocks.erro).toHaveBeenCalled();
        expect(mocks.setters[4]).toHaveBeenLastCalledWith(false);
        mocks[consulta].mockResolvedValue(valor);
        await vi.advanceTimersByTimeAsync(40000);
        expect(mocks.setters[3]).toHaveBeenLastCalledWith([reserva]);
        expect(mocks.setters[4]).toHaveBeenLastCalledWith(false);
    });
});
