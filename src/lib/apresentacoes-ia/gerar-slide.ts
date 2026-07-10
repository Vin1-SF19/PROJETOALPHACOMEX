import { callCompletion, type ChatMessage, type StreamChunk } from "@/lib/bibble/completion";
import { montarSystemPromptGeracaoSlide } from "./prompts";
import { preencherTemplate, camposEsperadosDoTemplate } from "./templates-layout";
import { dadosSlideSchema, type ComponenteSlide } from "@/lib/validations/slide-componentes";

/** Mesmo provedor/modelo padrão já usado pelo chat do Bibble (Ollama local, ollama.alpha-comex.com em produção) — sem custo de API externa. */
export const MODELO_GERACAO_SLIDE = process.env.BIBBLE_MODEL ?? "gemma4:e4b";

export type EventoGeracaoSlide =
  | { type: "status"; state: string }
  | { type: "text"; text: string }
  | { type: "done"; componentes: ComponenteSlide[] }
  | { type: "error"; message: string };

/** Remove cercas de markdown (```json ... ```) caso a IA as inclua por engano, apesar da instrução em contrário. */
function limparCercasMarkdown(texto: string): string {
  const semCercas = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return semCercas.trim();
}

type ResultadoValidacao = { sucesso: true; componentes: ComponenteSlide[] } | { sucesso: false; erro: string };

/**
 * Parseia e valida o texto acumulado do stream como {template, conteudo}, preenche o template
 * escolhido e valida o resultado com dadosSlideSchema. Função pura — sem I/O, testável isoladamente
 * e reaproveitável se uma onda futura precisar gerar múltiplos slides a partir de múltiplos payloads.
 */
function validarESlideDoTexto(textoAcumulado: string): ResultadoValidacao {
  const jsonLimpo = limparCercasMarkdown(textoAcumulado);

  let payload: unknown;
  try {
    payload = JSON.parse(jsonLimpo);
  } catch {
    return { sucesso: false, erro: "A IA não retornou um JSON válido. Tente reformular o pedido." };
  }

  if (typeof payload !== "object" || payload === null || !("template" in payload) || !("conteudo" in payload)) {
    return { sucesso: false, erro: "Resposta da IA fora do formato esperado (faltam campos 'template'/'conteudo')." };
  }

  const { template, conteudo } = payload as { template: unknown; conteudo: unknown };
  if (typeof template !== "string" || typeof conteudo !== "object" || conteudo === null) {
    return { sucesso: false, erro: "Resposta da IA fora do formato esperado." };
  }

  const conteudoTipado: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(conteudo as Record<string, unknown>)) {
    // Guard defensivo: nunca aceitar chaves de protótipo vindas de JSON externo (IA), mesmo que
    // JSON.parse + atribuição via colchetes não seja vulnerável a prototype pollution na prática.
    if (chave === "__proto__" || chave === "constructor" || chave === "prototype") continue;
    if (typeof valor === "string") conteudoTipado[chave] = valor;
  }

  const camposFaltando = camposEsperadosDoTemplate(template).filter((campo) => !conteudoTipado[campo]?.trim());
  if (camposFaltando.length > 0) {
    console.error(`[GERAR-SLIDE] IA omitiu campos esperados do template "${template}": ${camposFaltando.join(", ")}`);
  }

  const componentes = preencherTemplate(template, conteudoTipado);
  if (!componentes) {
    return { sucesso: false, erro: `Template "${template}" desconhecido.` };
  }

  const validado = dadosSlideSchema.safeParse({ componentes });
  if (!validado.success) {
    return { sucesso: false, erro: "O conteúdo gerado não passou na validação. Tente novamente." };
  }

  return { sucesso: true, componentes: validado.data.componentes };
}

/** Orquestra a chamada à IA (streaming) para gerar UM slide a partir de um prompt livre do usuário. */
export async function* gerarSlideStream(prompt: string, signal: AbortSignal): AsyncGenerator<EventoGeracaoSlide> {
  yield { type: "status", state: "gerando" };

  const msgs: ChatMessage[] = [
    { role: "system", content: montarSystemPromptGeracaoSlide() },
    { role: "user", content: prompt },
  ];

  let textoAcumulado = "";

  try {
    const streamRes = await callCompletion(msgs, [], MODELO_GERACAO_SLIDE, signal, true);
    if (!streamRes.body) throw new Error("Stream sem body");

    const reader = streamRes.body.getReader();
    const dec = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") break;
        try {
          const chunk = JSON.parse(raw) as StreamChunk;
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            textoAcumulado += delta;
            yield { type: "text", text: delta };
          }
        } catch {
          // chunk malformado — ignora, segue acumulando os próximos
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao chamar o provedor de IA";
    console.error("[GERAR-SLIDE] Falha ao chamar o provedor:", msg);
    yield { type: "error", message: "Não foi possível gerar o slide agora. Tente novamente em instantes." };
    return;
  }

  const resultado = validarESlideDoTexto(textoAcumulado);
  if (!resultado.sucesso) {
    yield { type: "error", message: resultado.erro };
    return;
  }

  yield { type: "done", componentes: resultado.componentes };
}
