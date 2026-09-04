import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { slaConfiguracaoAdminSchema } from "@/lib/validations/bpm-sla";

const raiz = process.cwd();
const ler = (arquivo: string) => fs.readFileSync(path.join(raiz, arquivo), "utf8");

describe("administração de SLA", () => {
  it("compartilha a validação Zod e exige o detalhe do escopo", () => {
    const base = {
      pipelineId: "cm12345678901234567890123", nome: "SLA comercial", escopo: "ETAPA",
      etapaId: null, tipoTarefa: null, tipoProcesso: null, servicoId: null,
      quantidade: 2, unidade: "DIAS", inicioMomento: "ENTRADA_ETAPA", pausaRegra: "STANDBY",
      ativa: true, amareloTipo: "PERCENTUAL_CONSUMIDO", amareloValor: 75, amareloUnidade: null,
      vermelhoTipo: "ATRASO", vermelhoValor: 0, vermelhoUnidade: "MINUTOS",
    };
    expect(slaConfiguracaoAdminSchema.safeParse(base).success).toBe(false);
    expect(slaConfiguracaoAdminSchema.safeParse({ ...base, etapaId: "cm12345678901234567890124" }).success).toBe(true);
  });

  it("integra a seção na rota protegida e expõe CRUD e preview", () => {
    const pagina = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx");
    const cliente = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx");
    const secao = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigSection.tsx");
    const formulario = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigForm.tsx");
    const actions = ler("src/actions/bpm/Sla.ts");
    expect(pagina).toContain("ListarConfiguracoesSlaBpm");
    expect(cliente).toContain("<SlaConfigSection");
    expect(secao).toContain("SLA e Alertas");
    expect(formulario).toContain("zodResolver(slaConfiguracaoAdminSchema)");
    expect(formulario).toContain("Prévia dos estados do SLA");
    expect(actions).toContain("SalvarConfiguracaoSlaBpm");
    expect(actions).toContain("AtivarDesativarConfiguracaoSlaBpm");
    expect(actions).toContain("ExcluirConfiguracaoSlaBpm");
    expect(actions).toContain('exigirAcessoConfigPipeline(userId, "configurarSla", tx)');
  });
});
