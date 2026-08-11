import { describe, expect, it } from "vitest";
import {
  configuracaoDaFontePorNomeArquivo,
  cssDasFontesPersonalizadas,
  fontePersonalizadaSchema,
  fontesPersonalizadasSchema,
  LIMITE_FONTES_PERSONALIZADAS,
  filtrarFontesUsadas,
  mesclarFontesPersonalizadas,
  nomeFonteJaExiste,
  normalizarFontesPersonalizadas,
  assinaturaConfereComFormato,
  type FontePersonalizada,
} from "@/lib/apresentacoes/fontes-personalizadas";
import { caminhoFonteGlobal, fonteGlobalDoBlob } from "@/lib/apresentacoes/fontes-globais";
import {
  embutirFontesPersonalizadas,
  OrcamentoFontesExcedidoError,
} from "@/lib/apresentacoes/embutir-fontes-personalizadas";

function criarFonte(patch: Partial<FontePersonalizada> = {}): FontePersonalizada {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    nome: "Fonte da Marca",
    url: "https://arquivos.exemplo.com/fonte.woff2",
    formato: "woff2",
    mimeType: "font/woff2",
    nomeOriginal: "fonte.woff2",
    tamanhoBytes: 1024,
    criadoEm: "2026-08-10T12:00:00.000Z",
    ...patch,
  };
}

describe("fontes personalizadas do Alpha Motion", () => {
  it("aceita metadados válidos e permite nome definido pelo usuário", () => {
    expect(fontePersonalizadaSchema.parse(criarFonte()).nome).toBe("Fonte da Marca");
    expect(fontePersonalizadaSchema.parse(criarFonte({ nome: "Minha Serif #2" })).nome).toBe("Minha Serif #2");
  });

  it("rejeita nome vazio, caracteres de controle e bibliotecas acima do limite", () => {
    expect(fontePersonalizadaSchema.safeParse(criarFonte({ nome: "   " })).success).toBe(false);
    expect(fontePersonalizadaSchema.safeParse(criarFonte({ nome: "Fonte\nInjetada" })).success).toBe(false);
    expect(fontesPersonalizadasSchema.safeParse(Array.from({ length: LIMITE_FONTES_PERSONALIZADAS + 1 }, (_, i) => criarFonte({
      id: `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`,
    }))).success).toBe(false);
  });

  it.each([
    ["marca.woff2", "woff2", [0x77, 0x4f, 0x46, 0x32]],
    ["marca.WOFF", "woff", [0x77, 0x4f, 0x46, 0x46]],
    ["marca.ttf", "truetype", [0x00, 0x01, 0x00, 0x00]],
    ["marca.otf", "opentype", [0x4f, 0x54, 0x54, 0x4f]],
  ] as const)("valida extensão e assinatura real de %s", (arquivo, formato, assinatura) => {
    expect(configuracaoDaFontePorNomeArquivo(arquivo)?.formato).toBe(formato);
    expect(assinaturaConfereComFormato(Uint8Array.from(assinatura), formato)).toBe(true);
  });

  it("não confia apenas na extensão", () => {
    expect(configuracaoDaFontePorNomeArquivo("imagem.png")).toBeNull();
    expect(assinaturaConfereComFormato(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), "woff2")).toBe(false);
  });

  it("aceita também a assinatura TrueType usada por fontes Apple", () => {
    expect(assinaturaConfereComFormato(Uint8Array.from([0x74, 0x72, 0x75, 0x65]), "truetype")).toBe(true);
  });

  it("detecta nomes duplicados sem diferenciar maiúsculas ou minúsculas", () => {
    expect(nomeFonteJaExiste([criarFonte()], "fonte DA marca")).toBe(true);
    expect(nomeFonteJaExiste([criarFonte()], "Outra fonte")).toBe(false);
  });

  it("gera @font-face escapando nome e URL como strings CSS", () => {
    const css = cssDasFontesPersonalizadas([criarFonte({ nome: 'Marca \"Premium\" </style><script>' })]);
    expect(css).toContain('font-family: "Marca \\"Premium\\"');
    expect(css).toContain('format("woff2")');
    expect(css).not.toContain("</style>");
    expect(css).not.toContain("<script>");
  });

  it("normaliza dados antigos ou inválidos para biblioteca vazia", () => {
    expect(normalizarFontesPersonalizadas(undefined)).toEqual([]);
    expect(normalizarFontesPersonalizadas([{ nome: "incompleta" }])).toEqual([]);
  });

  it("mescla o catálogo global e incorpora somente fontes usadas nos componentes", () => {
    const global = criarFonte({ nome: "Global Sans" });
    const localDuplicada = criarFonte({ id: "550e8400-e29b-41d4-a716-446655440001", nome: "global sans" });
    const serif = criarFonte({ id: "550e8400-e29b-41d4-a716-446655440002", nome: "Serif Especial" });
    const mescladas = mesclarFontesPersonalizadas([global], [localDuplicada, serif]);
    expect(mescladas).toHaveLength(2);
    expect(filtrarFontesUsadas(mescladas, [{
      componentes: [{
        id: "texto",
        tipo: "texto",
        texto: "Marca",
        tag: "p",
        x: 0,
        y: 0,
        w: 300,
        h: 100,
        zIndex: 1,
        rotacao: 0,
        fontFamily: "Serif Especial",
      }],
    }])).toEqual([serif]);
  });

  it("reconstrói os metadados da fonte global pelo caminho do Blob", () => {
    const pathname = caminhoFonteGlobal("550e8400-e29b-41d4-a716-446655440000", "Fonte da Equipe", "marca.woff2");
    expect(fonteGlobalDoBlob({
      pathname,
      url: "https://arquivos.exemplo.com/marca.woff2",
      size: 2048,
      uploadedAt: new Date("2026-08-11T10:00:00.000Z"),
    })).toMatchObject({ nome: "Fonte da Equipe", formato: "woff2", tamanhoBytes: 2048 });
  });

  it("bloqueia exportação antes de baixar fontes acima do orçamento", async () => {
    await expect(embutirFontesPersonalizadas([criarFonte({ tamanhoBytes: 2048 })], 1024))
      .rejects.toBeInstanceOf(OrcamentoFontesExcedidoError);
  });
});
