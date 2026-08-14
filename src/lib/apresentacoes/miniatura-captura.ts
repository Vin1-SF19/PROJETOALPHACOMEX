/**
 * Captura um "print" estático do slide atualmente aberto no canvas do editor e envia como
 * miniatura da apresentação. Só deve ser chamado quando o slide salvo é o primeiro (ver
 * `ehPrimeiroSlide`) — é ele que a Dashboard exibe. Sempre best-effort: falha aqui nunca deve
 * interromper o autosave real do slide nem aparecer como erro para o usuário.
 */
export async function capturarMiniaturaPrimeiroSlide(apresentacaoId: string): Promise<void> {
  const elemento = document.getElementById("alpha-presentation-canvas");
  if (!(elemento instanceof HTMLElement)) return;

  try {
    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(elemento, {
      cacheBust: true,
      pixelRatio: 0.5,
      backgroundColor: getComputedStyle(elemento).backgroundColor,
      width: elemento.offsetWidth,
      height: elemento.offsetHeight,
      style: { transform: "none", transformOrigin: "top left" },
      filter: (node) => !(node instanceof HTMLElement) || node.dataset.editorOnly !== "true",
    });
    if (!blob) return;

    await fetch(`/api/apresentacoes/${apresentacaoId}/miniatura`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: blob,
    });
  } catch (error) {
    console.warn("[capturarMiniaturaPrimeiroSlide] falha ao gerar/enviar miniatura", error);
  }
}
