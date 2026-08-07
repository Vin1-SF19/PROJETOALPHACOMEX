import { describe, expect, it } from "vitest";
import { BIBBLE_TOOLS } from "@/lib/bibble/tools";
import { executarTool } from "@/lib/bibble/tool-executor";
import {
  consultarManualModulo,
  encontrarManualModulo,
  MANUAIS_MODULOS,
  podeConsultarManualModulo,
} from "@/lib/shared/module-knowledge";

describe("catálogo de conhecimento modular do Bibble", () => {
  it("resolve aliases com e sem acento", () => {
    expect(encontrarManualModulo("Alpha Metas")?.id).toBe("alpha-metas");
    expect(encontrarManualModulo("módulo de parceiros")?.id).toBe("parceiros");
    expect(encontrarManualModulo("modulo de parceiros")?.id).toBe("parceiros");
  });

  it("retorna somente o tópico solicitado", () => {
    const resultado = consultarManualModulo("metas", "parceiro não cadastrado");
    expect(resultado.sucesso).toBe(true);
    if (!resultado.sucesso) return;

    expect(resultado.topico).toContain("parceiro não cadastrado");
    expect(resultado.conteudo).toContain("Outro parceiro / Não cadastrado");
    expect(resultado.conteudo).not.toContain("## Usar o modo TV");
  });

  it("corrige a premissa de cadastrar cliente em Parceiros", () => {
    const resultado = consultarManualModulo("Parceiros", "cadastrar cliente");
    expect(resultado.sucesso).toBe(true);
    if (!resultado.sucesso) return;

    expect(resultado.conteudo).toContain("não cadastra um cliente novo");
    expect(resultado.conteudo).toContain("já existe no CS & NPS");
    expect(resultado.conteudo).toContain("Alpha Metas");
  });

  it("cobre os fluxos críticos dos dois módulos", () => {
    const metas = consultarManualModulo("Alpha Metas");
    const parceiros = consultarManualModulo("Parceiros");
    expect(metas.sucesso && metas.conteudo).toContain("Configurar metas individuais");
    expect(metas.sucesso && metas.conteudo).toContain("Gerenciamento de Leads");
    expect(metas.sucesso && metas.conteudo).toContain("justificativa de meta");
    expect(parceiros.sucesso && parceiros.conteudo).toContain("Cadastrar um parceiro");
    expect(parceiros.sucesso && parceiros.conteudo).toContain("pré-cadastros");
    expect(parceiros.sucesso && parceiros.conteudo).toContain("níveis e comissões");
  });

  it("nega por padrão e permite permissão, papel do módulo ou Admin", () => {
    const metas = MANUAIS_MODULOS.find((manual) => manual.id === "alpha-metas")!;
    const parceiros = MANUAIS_MODULOS.find((manual) => manual.id === "parceiros")!;

    expect(podeConsultarManualModulo(metas, { role: "User", permissoes: [] })).toBe(false);
    expect(podeConsultarManualModulo(metas, { role: "User", permissoes: ["metas"] })).toBe(true);
    expect(podeConsultarManualModulo(metas, { role: "Lider Comercial", permissoes: [] })).toBe(true);
    expect(podeConsultarManualModulo(parceiros, { role: "User", permissoes: ["parceiros"] })).toBe(true);
    expect(podeConsultarManualModulo(parceiros, { role: "Admin", permissoes: [] })).toBe(true);
  });

  it("expõe uma tool explicitamente somente leitura", () => {
    const tool = BIBBLE_TOOLS.find((item) => item.function.name === "consultar_manual_modulo");
    expect(tool).toBeDefined();
    expect(tool?.function.description).toContain("somente leitura");
    expect(tool?.function.parameters.required).toEqual(["modulo"]);
  });

  it("aplica autorização na execução da tool", async () => {
    const negado = await executarTool(
      "consultar_manual_modulo",
      { modulo: "Parceiros", topico: "cadastrar parceiro" },
      { userId: 1, userName: "Usuário", role: "User", permissoes: [] },
    );
    const permitido = await executarTool(
      "consultar_manual_modulo",
      { modulo: "Parceiros", topico: "cadastrar parceiro" },
      { userId: 1, userName: "Usuário", role: "User", permissoes: ["parceiros"] },
    );

    expect(negado).toContain("não tem permissão");
    expect(JSON.parse(permitido)).toMatchObject({ sucesso: true, modulo: "Parceiros" });
  });

  it("informa sugestões para módulo ou tópico desconhecido", () => {
    const modulo = consultarManualModulo("inexistente");
    const topico = consultarManualModulo("Parceiros", "teletransporte");
    expect(modulo.sucesso).toBe(false);
    expect(!modulo.sucesso && modulo.sugestoes).toContain("Alpha Metas");
    expect(topico.sucesso).toBe(false);
    expect(!topico.sucesso && topico.sugestoes?.length).toBeGreaterThan(5);
  });
});
