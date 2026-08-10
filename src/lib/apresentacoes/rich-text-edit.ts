import type { TextoComponente } from "@/lib/validations/slide-componentes";

export type RichTextAlpha = NonNullable<TextoComponente["richText"]>;
type RichRun = RichTextAlpha["paragraphs"][number]["runs"][number];
export type RichRunPatch = Partial<Omit<RichRun, "text">>;

export function textoPlanoDoRichText(richText: RichTextAlpha): string {
  return richText.paragraphs
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join("\n");
}

function estiloDoRun(run: RichRun | undefined): Omit<RichRun, "text"> {
  if (!run) return {};
  return Object.fromEntries(
    Object.entries(run).filter(([key]) => key !== "text"),
  ) as Omit<RichRun, "text">;
}

function assinaturaDoEstilo(run: RichRun): string {
  return JSON.stringify(estiloDoRun(run));
}

function agruparCaracteres(chars: Array<{ char: string; style: Omit<RichRun, "text"> }>): RichRun[] {
  if (chars.length === 0) return [{ text: "" }];
  const runs: RichRun[] = [];
  for (const item of chars) {
    const atual = runs.at(-1);
    const candidato: RichRun = { text: item.char, ...item.style };
    if (atual && assinaturaDoEstilo(atual) === assinaturaDoEstilo(candidato)) {
      atual.text += item.char;
    } else {
      runs.push(candidato);
    }
  }
  return runs;
}

export function criarRichTextDoTexto(texto: string, estilo: RichRunPatch = {}): RichTextAlpha {
  return {
    paragraphs: texto.split("\n").map((linha) => ({ runs: [{ text: linha, ...estilo }] })),
  };
}

/** Aplica estilo somente ao intervalo selecionado no texto plano, preservando os demais runs. */
export function aplicarEstiloNoIntervaloRichText(
  richText: RichTextAlpha,
  inicioEntrada: number,
  fimEntrada: number,
  patch: RichRunPatch,
): RichTextAlpha {
  const tamanhoTotal = textoPlanoDoRichText(richText).length;
  const inicio = Math.max(0, Math.min(tamanhoTotal, Math.min(inicioEntrada, fimEntrada)));
  const fim = Math.max(inicio, Math.min(tamanhoTotal, Math.max(inicioEntrada, fimEntrada)));
  if (inicio === fim) return richText;

  let cursor = 0;
  return {
    paragraphs: richText.paragraphs.map((paragraph, paragraphIndex) => {
      const novosRuns: RichRun[] = [];
      for (const run of paragraph.runs) {
        const inicioRun = cursor;
        const fimRun = cursor + run.text.length;
        const inicioLocal = Math.max(0, inicio - inicioRun);
        const fimLocal = Math.min(run.text.length, fim - inicioRun);
        if (inicioLocal >= fimLocal) {
          novosRuns.push(run);
        } else {
          const antes = run.text.slice(0, inicioLocal);
          const trecho = run.text.slice(inicioLocal, fimLocal);
          const depois = run.text.slice(fimLocal);
          if (antes) novosRuns.push({ ...run, text: antes });
          if (trecho) novosRuns.push({ ...run, ...patch, text: trecho });
          if (depois) novosRuns.push({ ...run, text: depois });
        }
        cursor = fimRun;
      }
      if (paragraphIndex < richText.paragraphs.length - 1) cursor += 1;

      const caracteres = novosRuns.flatMap((run) => [...run.text].map((char) => ({ char, style: estiloDoRun(run) })));
      return { ...paragraph, runs: agruparCaracteres(caracteres) };
    }),
  };
}

function sincronizarParagrafo(runsAntigos: RichRun[], textoNovo: string): RichRun[] {
  const textoAntigo = runsAntigos.map((run) => run.text).join("");
  const caracteresAntigos = [...textoAntigo];
  const caracteresNovos = [...textoNovo];
  const estilosAntigos = runsAntigos.flatMap((run) =>
    [...run.text].map(() => estiloDoRun(run)),
  );
  const estiloPadrao = estiloDoRun(runsAntigos.find((run) => run.text.length > 0) ?? runsAntigos[0]);

  let prefixo = 0;
  while (
    prefixo < caracteresAntigos.length
    && prefixo < caracteresNovos.length
    && caracteresAntigos[prefixo] === caracteresNovos[prefixo]
  ) prefixo += 1;

  let sufixo = 0;
  while (
    sufixo < caracteresAntigos.length - prefixo
    && sufixo < caracteresNovos.length - prefixo
    && caracteresAntigos[caracteresAntigos.length - 1 - sufixo] === caracteresNovos[caracteresNovos.length - 1 - sufixo]
  ) sufixo += 1;

  const caracteres = caracteresNovos.map((char, index) => {
    if (index < prefixo) return { char, style: estilosAntigos[index] ?? estiloPadrao };
    if (index >= caracteresNovos.length - sufixo) {
      const indiceAntigo = caracteresAntigos.length - (caracteresNovos.length - index);
      return { char, style: estilosAntigos[indiceAntigo] ?? estiloPadrao };
    }
    const estiloVizinho = estilosAntigos[Math.min(prefixo, Math.max(0, estilosAntigos.length - 1))] ?? estiloPadrao;
    return { char, style: estiloVizinho };
  });

  return agruparCaracteres(caracteres);
}

/**
 * Atualiza o texto plano sem abandonar a estrutura rica importada. Trechos que continuam
 * iguais mantêm exatamente seus estilos; texto inserido herda o estilo do run adjacente.
 */
export function sincronizarRichTextComTexto(richText: RichTextAlpha, textoNovo: string): RichTextAlpha {
  const novosParagrafos = textoNovo.split("\n");
  const referenciaFinal = richText.paragraphs.at(-1);

  return {
    paragraphs: novosParagrafos.map((texto, index) => {
      const original = richText.paragraphs[index] ?? referenciaFinal;
      return {
        ...(original ?? {}),
        runs: sincronizarParagrafo(original?.runs ?? [], texto),
      };
    }),
  };
}

export function atualizarRunRichText(
  richText: RichTextAlpha,
  paragraphIndex: number,
  runIndex: number,
  patch: Partial<RichRun>,
): RichTextAlpha {
  return {
    paragraphs: richText.paragraphs.map((paragraph, pIndex) => ({
      ...paragraph,
      runs: paragraph.runs.map((run, rIndex) =>
        pIndex === paragraphIndex && rIndex === runIndex ? { ...run, ...patch } : run,
      ),
    })),
  };
}
