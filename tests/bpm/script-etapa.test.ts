import { describe, expect, it } from "vitest";

import {
  desserializarScriptEtapa,
  MAX_TEXTO_SCRIPT_ETAPA,
  scriptEtapaPersistidoValido,
  serializarScriptEtapa,
} from "@/lib/bpm/script-etapa";

describe("script da etapa", () => {
  it("serializa e recupera o documento do editor Note", () => {
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Roteiro comercial" }] }],
    };

    const persistido = serializarScriptEtapa(content, "  Roteiro comercial  ");
    const recuperado = desserializarScriptEtapa(persistido);

    expect(recuperado).toEqual({ content, plainText: "Roteiro comercial", estruturado: true });
    expect(scriptEtapaPersistidoValido(persistido)).toBe(true);
  });

  it("converte texto simples legado sem exibir o marcador como HTML", () => {
    const recuperado = desserializarScriptEtapa("Primeira linha\n<script>alert(1)</script>");

    expect(recuperado.estruturado).toBe(false);
    expect(recuperado.plainText).toContain("<script>");
    expect(recuperado.content.content?.[1]?.content?.[0]?.text).toBe("<script>alert(1)</script>");
  });

  it("representa editor vazio como null", () => {
    expect(serializarScriptEtapa({ type: "doc", content: [] }, "   ")).toBeNull();
    expect(scriptEtapaPersistidoValido(null)).toBe(true);
  });

  it("rejeita texto acima do limite", () => {
    expect(() => serializarScriptEtapa({ type: "doc", content: [] }, "x".repeat(MAX_TEXTO_SCRIPT_ETAPA + 1)))
      .toThrow("no máximo");
  });

  it("não aceita string arbitrária no contrato de escrita", () => {
    expect(scriptEtapaPersistidoValido("texto sem envelope")).toBe(false);
    expect(scriptEtapaPersistidoValido("SCRIPT_NOTE_V1:{invalido")).toBe(false);
  });

  it("rejeita nós desconhecidos e protocolos inseguros", () => {
    const noDesconhecido = `SCRIPT_NOTE_V1:${JSON.stringify({
      version: 1,
      plainText: "ataque",
      content: { type: "doc", content: [{ type: "iframe", attrs: { src: "https://example.com" } }] },
    })}`;
    const linkInseguro = `SCRIPT_NOTE_V1:${JSON.stringify({
      version: 1,
      plainText: "clique",
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "clique", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }],
      },
    })}`;

    expect(scriptEtapaPersistidoValido(noDesconhecido)).toBe(false);
    expect(scriptEtapaPersistidoValido(linkInseguro)).toBe(false);
  });
});
