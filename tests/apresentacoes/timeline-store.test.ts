import { describe, expect, it, beforeEach } from "vitest";
import { useEditorStore } from "@/components/Apresentacoes/Editor/store/useEditorStore";
import { animationGroupSchema } from "@/lib/validations/slide-animacao-config";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

function anim(overrides: Partial<ElementAnimation>): ElementAnimation {
  return {
    id: "a1",
    elementId: "c1",
    category: "entrance",
    type: "fade-in",
    trigger: "on-slide-enter",
    duration: 0.5,
    delay: 0,
    order: 0,
    easing: { curva: "easeOut" },
    ...overrides,
  };
}

describe("Alpha Motion — Fase 04 — useEditorStore (timeline)", () => {
  beforeEach(() => {
    useEditorStore.setState({ animacaoConfig: undefined, isDirty: false, versaoEdicao: 0 });
  });

  it("atualizarAnimacaoElemento não quebra quando id não existe", () => {
    useEditorStore.getState().adicionarAnimacaoElemento(anim({ id: "a1" }));
    expect(() => useEditorStore.getState().atualizarAnimacaoElemento("fantasma", { duration: 2 })).not.toThrow();
    const animacoes = useEditorStore.getState().animacaoConfig?.timeline?.animations ?? [];
    expect(animacoes.find((a) => a.id === "a1")?.duration).toBe(0.5);
  });

  it("atualizarAnimacaoElemento aplica patch in-place, sem remover e recriar", () => {
    useEditorStore.getState().adicionarAnimacaoElemento(anim({ id: "a1", delay: 0 }));
    useEditorStore.getState().atualizarAnimacaoElemento("a1", { delay: 1.5 });
    const animacoes = useEditorStore.getState().animacaoConfig?.timeline?.animations ?? [];
    expect(animacoes).toHaveLength(1);
    expect(animacoes[0].delay).toBe(1.5);
  });

  it("reordenarAnimacoesElemento reatribui order conforme a nova sequência de ids", () => {
    useEditorStore.getState().adicionarAnimacaoElemento(anim({ id: "a", elementId: "c1", order: 0 }));
    useEditorStore.getState().adicionarAnimacaoElemento(anim({ id: "b", elementId: "c1", order: 1 }));
    useEditorStore.getState().adicionarAnimacaoElemento(anim({ id: "c", elementId: "c1", order: 2 }));

    useEditorStore.getState().reordenarAnimacoesElemento("c1", ["c", "a", "b"]);

    const animacoes = useEditorStore.getState().animacaoConfig?.timeline?.animations ?? [];
    expect(animacoes.find((a) => a.id === "c")?.order).toBe(0);
    expect(animacoes.find((a) => a.id === "a")?.order).toBe(1);
    expect(animacoes.find((a) => a.id === "b")?.order).toBe(2);
  });

  it("reordenarAnimacoesElemento não afeta animações de OUTRO elemento", () => {
    useEditorStore.getState().adicionarAnimacaoElemento(anim({ id: "a", elementId: "c1", order: 0 }));
    useEditorStore.getState().adicionarAnimacaoElemento(anim({ id: "x", elementId: "c2", order: 5 }));

    useEditorStore.getState().reordenarAnimacoesElemento("c1", ["a"]);

    const animacoes = useEditorStore.getState().animacaoConfig?.timeline?.animations ?? [];
    expect(animacoes.find((a) => a.id === "x")?.order).toBe(5);
  });

  it("agruparAnimacoes cria um AnimationGroup válido contra o schema Zod", () => {
    useEditorStore.getState().agruparAnimacoes(["a", "b"], "Meu Grupo");
    const grupos = useEditorStore.getState().animacaoConfig?.timeline?.groups ?? [];
    expect(grupos).toHaveLength(1);
    const parsed = animationGroupSchema.safeParse(grupos[0]);
    expect(parsed.success).toBe(true);
    expect(grupos[0].animationIds).toEqual(["a", "b"]);
    expect(grupos[0].nome).toBe("Meu Grupo");
  });

  it("desagruparAnimacoes remove o grupo sem apagar as animações", () => {
    useEditorStore.getState().adicionarAnimacaoElemento(anim({ id: "a" }));
    useEditorStore.getState().agruparAnimacoes(["a"], "Grupo Temporário");
    const grupoId = useEditorStore.getState().animacaoConfig?.timeline?.groups?.[0]?.id;
    expect(grupoId).toBeDefined();

    useEditorStore.getState().desagruparAnimacoes(grupoId!);

    const estado = useEditorStore.getState();
    expect(estado.animacaoConfig?.timeline?.groups).toEqual([]);
    expect(estado.animacaoConfig?.timeline?.animations).toHaveLength(1);
  });

  it("desagruparAnimacoes com grupoId inexistente não quebra", () => {
    expect(() => useEditorStore.getState().desagruparAnimacoes("fantasma")).not.toThrow();
  });
});
