function distanciaCor(a: readonly number[], b: readonly number[]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.crossOrigin = "anonymous";
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(new Error("Não foi possível carregar a imagem para processamento."));
    imagem.src = url;
  });
}

/**
 * Remove apenas o fundo conectado às bordas. Isso preserva áreas internas da
 * mesma cor e é mais previsível do que tornar globalmente toda cor parecida transparente.
 */
export async function removerFundoPelasBordas(url: string, tolerancia: number): Promise<Blob> {
  const imagem = await carregarImagem(url);
  if (imagem.naturalWidth * imagem.naturalHeight > 12_000_000) {
    throw new Error("Para remover o fundo, use uma imagem de até 12 megapixels.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = imagem.naturalWidth;
  canvas.height = imagem.naturalHeight;
  const contexto = canvas.getContext("2d", { willReadFrequently: true });
  if (!contexto) throw new Error("Seu navegador não disponibilizou o processador de imagem.");

  contexto.drawImage(imagem, 0, 0);
  const frame = contexto.getImageData(0, 0, canvas.width, canvas.height);
  const dados = frame.data;
  const largura = canvas.width;
  const altura = canvas.height;
  const cantos = [
    [dados[0], dados[1], dados[2]],
    [dados[(largura - 1) * 4], dados[(largura - 1) * 4 + 1], dados[(largura - 1) * 4 + 2]],
    [dados[(altura - 1) * largura * 4], dados[(altura - 1) * largura * 4 + 1], dados[(altura - 1) * largura * 4 + 2]],
    [dados[(largura * altura - 1) * 4], dados[(largura * altura - 1) * 4 + 1], dados[(largura * altura - 1) * 4 + 2]],
  ];
  const fundo = [0, 1, 2].map((canal) => Math.round(cantos.reduce((soma, cor) => soma + cor[canal], 0) / cantos.length));
  const visitado = new Uint8Array(largura * altura);
  const fila = new Int32Array(largura * altura);
  let inicio = 0;
  let fim = 0;

  function enfileirar(x: number, y: number) {
    if (x < 0 || y < 0 || x >= largura || y >= altura) return;
    const posicao = y * largura + x;
    if (visitado[posicao]) return;
    visitado[posicao] = 1;
    const indice = posicao * 4;
    if (distanciaCor([dados[indice], dados[indice + 1], dados[indice + 2]], fundo) > tolerancia) return;
    fila[fim++] = posicao;
  }

  for (let x = 0; x < largura; x += 1) {
    enfileirar(x, 0);
    enfileirar(x, altura - 1);
  }
  for (let y = 1; y < altura - 1; y += 1) {
    enfileirar(0, y);
    enfileirar(largura - 1, y);
  }

  while (inicio < fim) {
    const posicao = fila[inicio++];
    const x = posicao % largura;
    const y = Math.floor(posicao / largura);
    dados[posicao * 4 + 3] = 0;
    enfileirar(x - 1, y);
    enfileirar(x + 1, y);
    enfileirar(x, y - 1);
    enfileirar(x, y + 1);
  }

  contexto.putImageData(frame, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Falha ao gerar o PNG transparente.")), "image/png");
  });
}
