export interface VisualDiffResult {
  similarity: number;
  differentPixels: number;
  totalPixels: number;
  diffUrl: string;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar uma imagem da comparação visual."));
    image.src = url;
  });
}

/** Diff visual localizado. Branco = igual; magenta mais intenso = diferença maior. */
export async function compararImagens(
  referenceUrl: string,
  importedUrl: string,
  size: { width: number; height: number },
  threshold = 24,
): Promise<VisualDiffResult> {
  const [reference, imported] = await Promise.all([loadImage(referenceUrl), loadImage(importedUrl)]);
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const sourceCanvas = document.createElement("canvas");
  const importedCanvas = document.createElement("canvas");
  const diffCanvas = document.createElement("canvas");
  for (const canvas of [sourceCanvas, importedCanvas, diffCanvas]) {
    canvas.width = width;
    canvas.height = height;
  }
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const importedContext = importedCanvas.getContext("2d", { willReadFrequently: true });
  const diffContext = diffCanvas.getContext("2d");
  if (!sourceContext || !importedContext || !diffContext) throw new Error("Canvas 2D indisponível para comparação visual.");
  sourceContext.drawImage(reference, 0, 0, width, height);
  importedContext.drawImage(imported, 0, 0, width, height);
  const sourcePixels = sourceContext.getImageData(0, 0, width, height);
  const importedPixels = importedContext.getImageData(0, 0, width, height);
  const diff = diffContext.createImageData(width, height);
  let differentPixels = 0;
  for (let index = 0; index < sourcePixels.data.length; index += 4) {
    const delta = Math.max(
      Math.abs(sourcePixels.data[index] - importedPixels.data[index]),
      Math.abs(sourcePixels.data[index + 1] - importedPixels.data[index + 1]),
      Math.abs(sourcePixels.data[index + 2] - importedPixels.data[index + 2]),
      Math.abs(sourcePixels.data[index + 3] - importedPixels.data[index + 3]),
    );
    if (delta > threshold) differentPixels += 1;
    const intensity = Math.min(255, delta * 2);
    diff.data[index] = 255;
    diff.data[index + 1] = 255 - intensity;
    diff.data[index + 2] = 255;
    diff.data[index + 3] = 255;
  }
  diffContext.putImageData(diff, 0, 0);
  const totalPixels = width * height;
  return {
    similarity: totalPixels ? 1 - differentPixels / totalPixels : 1,
    differentPixels,
    totalPixels,
    diffUrl: diffCanvas.toDataURL("image/png"),
  };
}
