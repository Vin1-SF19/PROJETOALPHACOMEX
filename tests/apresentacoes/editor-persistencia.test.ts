import { describe, expect, it, vi } from "vitest";
import {
  serializarPersistenciaSlide,
  useEditorStore,
} from "@/components/Apresentacoes/Editor/store/useEditorStore";

describe("persistência concorrente do editor", () => {
  it("serializa escritas do mesmo slide na ordem de entrada", async () => {
    const eventos: string[] = [];
    let liberarPrimeira: (() => void) | undefined;
    const bloqueio = new Promise<void>((resolve) => {
      liberarPrimeira = resolve;
    });

    const primeira = serializarPersistenciaSlide("slide-fila", async () => {
      eventos.push("primeira-inicio");
      await bloqueio;
      eventos.push("primeira-fim");
    });
    const segunda = serializarPersistenciaSlide("slide-fila", async () => {
      eventos.push("segunda-inicio");
      eventos.push("segunda-fim");
    });

    await vi.waitFor(() => expect(eventos).toEqual(["primeira-inicio"]));
    liberarPrimeira?.();
    await Promise.all([primeira, segunda]);
    expect(eventos).toEqual([
      "primeira-inicio",
      "primeira-fim",
      "segunda-inicio",
      "segunda-fim",
    ]);
  });

  it("não limpa dirty quando a resposta pertence a uma versão antiga", () => {
    useEditorStore.setState({
      slideAtivoId: "slide-versao",
      isDirty: true,
      isSaving: true,
      versaoEdicao: 8,
    });

    useEditorStore.getState().concluirSalvamento("slide-versao", 7, true);
    expect(useEditorStore.getState()).toMatchObject({ isDirty: true, isSaving: true });

    useEditorStore.getState().concluirSalvamento("slide-versao", 8, true);
    expect(useEditorStore.getState()).toMatchObject({ isDirty: false, isSaving: false });
  });

  it("ignora a conclusão antiga quando ela chega depois da versão atual", () => {
    useEditorStore.setState({
      slideAtivoId: "slide-resposta-invertida",
      isDirty: true,
      isSaving: true,
      versaoEdicao: 12,
    });

    useEditorStore.getState().concluirSalvamento("slide-resposta-invertida", 12, true);
    useEditorStore.getState().concluirSalvamento("slide-resposta-invertida", 11, true);

    expect(useEditorStore.getState()).toMatchObject({
      versaoEdicao: 12,
      isDirty: false,
      isSaving: false,
    });
  });

  it("libera a fila após uma escrita rejeitada", async () => {
    const eventos: string[] = [];
    const primeira = serializarPersistenciaSlide("slide-rejeicao", async () => {
      eventos.push("primeira");
      throw new Error("falha simulada");
    });
    const segunda = serializarPersistenciaSlide("slide-rejeicao", async () => {
      eventos.push("segunda");
      return "persistida";
    });

    await expect(primeira).rejects.toThrow("falha simulada");
    await expect(segunda).resolves.toBe("persistida");
    expect(eventos).toEqual(["primeira", "segunda"]);
  });

  it("não bloqueia gravações de slides diferentes", async () => {
    const eventos: string[] = [];
    let liberarSlideA: (() => void) | undefined;
    const bloqueioSlideA = new Promise<void>((resolve) => {
      liberarSlideA = resolve;
    });

    const slideA = serializarPersistenciaSlide("slide-paralelo-a", async () => {
      eventos.push("a-inicio");
      await bloqueioSlideA;
      eventos.push("a-fim");
    });
    const slideB = serializarPersistenciaSlide("slide-paralelo-b", async () => {
      eventos.push("b-inicio");
      eventos.push("b-fim");
    });

    await vi.waitFor(() => {
      expect(eventos).toContain("a-inicio");
      expect(eventos).toContain("b-fim");
    });
    expect(eventos).not.toContain("a-fim");

    liberarSlideA?.();
    await Promise.all([slideA, slideB]);
    expect(eventos).toContain("a-fim");
  });
});
