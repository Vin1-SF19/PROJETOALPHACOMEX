// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CardAbertoLayout, type CardAbertoLayoutProps } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout";
import { ExcluirCardBpm } from "@/actions/bpm/Cards";
import { toast } from "sonner";
vi.mock("@/actions/bpm/Cards", () => ({ ExcluirCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/Pipelines", () => ({ ListarPipelinesBpm: vi.fn().mockResolvedValue({ success: true, data: [] }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/PerfilEmpresaGlobal", () => ({ usePerfilEmpresa: () => ({ openPerfilEmpresa: vi.fn() }) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaDrawer", () => ({ DadosEmpresaDrawer: () => null, DadosEmpresaToggle: () => null, useDadosEmpresaDrawer: () => ({ aberto: false }) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoPipeline", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/TelefonesCardButton", () => ({ TelefonesCardButton: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard", () => ({ SeletorMembrosCard: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelSlaCard", () => ({ PainelSlaCard: () => null }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement("div");
let root: ReturnType<typeof createRoot>;
afterEach(async () => { if (root) await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });
async function montar(role = "RESPONSAVEL", podeAgir = true) {
 document.body.append(container); root = createRoot(container);
 const onClose = vi.fn(), onAtualizado = vi.fn();
 // Fixture parcial: os painéis dependentes estão isolados por mocks acima.
 const card = { id: "card", pipelineId: "pipeline", pipeline: { id: "pipeline", nome: "CRM" }, etapa: { id: "etapa", transicoesEtapaOrigem: [] }, empresa: { id: 1, razaoSocial: "Empresa", cnpj: "" }, membros: [{ userId: 1, role }], permissaoEtapa: { podeAgir } } as unknown as CardAbertoLayoutProps["card"];
 await act(async () => root.render(h(CardAbertoLayout, { card, etapas: [], interacoes: [], accent: "1,2,3", currentUserId: 1, currentUserRole: "COMERCIAL", realtimeRevision: 0, onClose, onAtualizado, onAbrirCard: vi.fn(), onInteracaoCriada: vi.fn(), children: null })));
 return { onClose, onAtualizado };
}
it.each([["PARTICIPANTE", true], ["RESPONSAVEL", false]])("oculta remoção para %s/podeAgir=%s", async (role, podeAgir) => {
 await montar(role, podeAgir); expect(container.querySelector('[aria-label="Excluir card"]')).toBeNull();
});
it.each(["sucesso", "negado", "rejeitado"])("confirmação real, loading e resultado %s", async (caso) => {
 let concluir!: (value: Awaited<ReturnType<typeof ExcluirCardBpm>>) => void;
 let rejeitar!: (error: Error) => void;
 vi.mocked(ExcluirCardBpm).mockImplementation(() => new Promise((resolve, reject) => { concluir = resolve; rejeitar = reject; }));
 const callbacks = await montar();
 await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Excluir card"]')!.click());
 const dialog = document.querySelector('[role="alertdialog"]')!;
 expect(dialog.textContent).toContain("arquivado");
 const confirmar = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === "Excluir")!;
 await act(async () => confirmar.click());
 expect(ExcluirCardBpm).toHaveBeenCalledExactlyOnceWith("card");
 expect(container.querySelector<HTMLButtonElement>('[aria-label="Excluir card"]')!.disabled).toBe(true);
 expect(callbacks.onClose).not.toHaveBeenCalled();
 await act(async () => { if (caso === "rejeitado") rejeitar(new Error("offline")); else concluir(caso === "sucesso" ? { success: true } : { success: false, error: "Não autorizado" }); });
 expect(container.querySelector<HTMLButtonElement>('[aria-label="Excluir card"]')!.disabled).toBe(false);
 if (caso === "sucesso") { expect(callbacks.onAtualizado).toHaveBeenCalledOnce(); expect(callbacks.onClose).toHaveBeenCalledOnce(); expect(toast.success).toHaveBeenCalled(); }
 else { expect(callbacks.onAtualizado).not.toHaveBeenCalled(); expect(callbacks.onClose).not.toHaveBeenCalled(); expect(toast.error).toHaveBeenCalledWith(caso === "negado" ? "Não autorizado" : "Não foi possível arquivar o card. Tente novamente."); }
});
