import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(process.cwd(), "src/app/PainelAlpha/Mesclagem");
const workspace = readFileSync(resolve(raiz, "MesclagemWorkspace.tsx"), "utf8");
const controller = readFileSync(resolve(raiz, "useMesclagemController.ts"), "utf8");
const api = readFileSync(resolve(raiz, "api-mesclagem.ts"), "utf8");
const upload = readFileSync(resolve(raiz, "components/UploadDropzone.tsx"), "utf8");
const diagnostico = readFileSync(resolve(raiz, "components/CnpjDiagnostic.tsx"), "utf8");
const exportacao = readFileSync(resolve(raiz, "components/ExportPanel.tsx"), "utf8");

describe("Mesclagem — contrato do frontend", () => {
  it("renderiza histórico na rota inicial e mantém o workflow full-page na rota nova", () => {
    const pagina = readFileSync(resolve(raiz, "page.tsx"), "utf8");
    const nova = readFileSync(resolve(raiz, "nova/page.tsx"), "utf8");
    expect(pagina).toContain("<HistoryHome");
    expect(pagina).toContain("listarHistoricoMesclagem");
    expect(nova).toContain("<MesclagemWorkspace />");
    expect(pagina).toContain("await verificarAcessoMesclagem()");
    expect(nova).toContain("await verificarAcessoMesclagem()");
    expect(pagina).not.toContain("modalAberto");
  });

  it("aceita e anuncia somente os quatro formatos realmente processáveis", () => {
    expect(api).toContain("EXTENSOES_MESCLAGEM.join");
    expect(upload).toContain("EXTENSOES_MESCLAGEM.map");
    expect(upload).not.toContain('"XLSB"');
    expect(upload).not.toContain('"ODS"');
  });

  it("solicita sugestões antes de abrir o mapeamento e protege overrides manuais", () => {
    const chamada = controller.indexOf("await calcularSugestoes()");
    const avanco = controller.indexOf("setEtapa(3)", chamada);
    expect(chamada).toBeGreaterThan(-1);
    expect(avanco).toBeGreaterThan(chamada);
    expect(controller).toContain("mesclarSugestoesPreservandoManuais(atual, resultado.mapeamento)");
    expect(controller).toContain("requisicao !== requisicaoMapeamento.current");
  });

  it("invalida sugestão stale e bloqueia troca concorrente de aba", () => {
    expect(controller).toContain("function trocarAba(tipo: TipoArquivoMesclagemUi, novaAba: string)");
    expect(controller).toContain("requisicaoMapeamento.current += 1");
    expect(controller).toContain("void calcularSugestoes({ abas: { [tipo]: novaAba }, mapeamentoBase })");
    expect(controller).toContain("reconciliarOverridesManuais(mapeamento, aba.colunas)");
    expect(workspace).toContain("value={configuracao.aba} disabled={ocupado}");
  });

  it("exporta com arquivos/mapeamento atuais e reutiliza o resultado persistido no segundo download", () => {
    expect(api).toContain('fetch("/api/mesclagem/exportar"');
    expect(api).toContain('formData.append("mapeamento", JSON.stringify(params.mapeamento))');
    expect(api).not.toContain("exportar?id=");
    expect(api).toContain("x-mesclagem-historico-id");
    expect(controller).toContain("await baixarResultadoHistorico(id)");
    expect(workspace).toContain("mapeamento,");
  });

  it("mantém loading e erro independentes para cada arquivo", () => {
    expect(workspace).toContain('carregandoArquivo === "principal"');
    expect(workspace).toContain('carregandoArquivo === "complementar"');
    expect(workspace).toContain("errosArquivos.principal");
    expect(workspace).toContain("errosArquivos.complementar");
    expect(upload).toContain('aria-busy={loading}');
  });

  it("distingue duplicados autoritativos de expansão visual 1:N", () => {
    expect(diagnostico).toContain("value: resumo.cnpj.duplicados");
    expect(diagnostico).toContain('value="grupo-1n">Grupos 1:N');
    expect(diagnostico).toContain("Grupo 1:N.");
    expect(diagnostico).not.toContain("item.duplicado");
  });

  it("usa métrica total e controles nativos acessíveis", () => {
    expect(exportacao).toContain("resumo.comMatch + resumo.semMatch");
    expect(upload).toContain('<button');
    expect(upload).not.toContain('role="button"');
    expect(diagnostico).toContain('aria-label="Buscar CNPJ ou observação"');
    expect(diagnostico).toContain('aria-label="Filtrar diagnóstico de CNPJ"');
  });

  it("mantém o componente visual abaixo do limite de 300 linhas", () => {
    expect(workspace.split(/\r?\n/).length).toBeLessThanOrEqual(300);
  });

  it("usa Tailwind/tokens sem folha de estilos hardcoded do módulo", () => {
    const pagina = readFileSync(resolve(raiz, "page.tsx"), "utf8");
    expect(pagina).not.toContain("mesclagem.css");
    expect(workspace).toContain("from-slate-950 via-indigo-950/30 to-slate-950");
    expect(workspace).not.toMatch(/mesclagem-(?:shell|card|input|select|cta|fade|action)/);
  });
});
