import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  transaction: vi.fn(),
  stageFindFirst: vi.fn(),
  fieldFindMany: vi.fn(),
  formFindUniqueOrThrow: vi.fn(),
  formUpdateMany: vi.fn(),
  formCreate: vi.fn(),
  sectionUpdate: vi.fn(),
  sectionCreate: vi.fn(),
  sectionDeleteMany: vi.fn(),
  componentUpdate: vi.fn(),
  componentCreate: vi.fn(),
  componentDeleteMany: vi.fn(),
  auditCreate: vi.fn(),
  pipelineUpdate: vi.fn(),
  revalidatePath: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: mocks.access }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notify }));
vi.mock("@/lib/prisma", () => ({
  default: { $transaction: mocks.transaction },
}));

import { SalvarFormularioEtapaBpm } from "@/actions/bpm/FormulariosEtapa";
import {
  BPM_STAGE_CHECKLIST_TARGET,
  formularioEtapaSemAlteracao,
  salvarFormularioEtapaSchema,
  type SalvarFormularioEtapaInput,
} from "@/lib/bpm/formularios-etapa";

const PIPELINE_ID = "pipeline-1";
const STAGE_ID = "stage-1";
const FIELD_ID = "field-1";
const FORM_ID = "form-1";
const SECTION_ID = "section-1";
const FIELD_COMPONENT_ID = "component-field";
const CHECKLIST_COMPONENT_ID = "component-checklist";
const CAPABILITY_COMPONENT_ID = "component-capability";

type InputComponent =
  SalvarFormularioEtapaInput["secoes"][number]["componentes"][number];
type PersistedComponent = InputComponent & { id: string; ordem: number };

const components: PersistedComponent[] = [
  {
    id: FIELD_COMPONENT_ID,
    chave: "field-1",
    tipo: "CAMPO",
    campoId: FIELD_ID,
    capability: null,
    configJson: null,
    ordem: 0,
  },
  {
    id: CHECKLIST_COMPONENT_ID,
    chave: "checklist",
    tipo: "CHECKLIST",
    campoId: null,
    capability: BPM_STAGE_CHECKLIST_TARGET,
    configJson: null,
    ordem: 1,
  },
  {
    id: CAPABILITY_COMPONENT_ID,
    chave: "follow-up",
    tipo: "CAPABILITY",
    campoId: null,
    capability: "FOLLOW_UP_SCHEDULER",
    configJson: null,
    ordem: 2,
  },
];

function persistedForm(version = 1) {
  return {
    id: FORM_ID,
    etapaId: STAGE_ID,
    versao: version,
    ativo: true,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    secoes: [
      {
        id: SECTION_ID,
        formularioId: FORM_ID,
        chave: "principal",
        titulo: "Principal",
        ordem: 0,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        componentes: components,
      },
    ],
  };
}

function input(
  title = "Principal",
  version = 1,
): SalvarFormularioEtapaInput {
  return {
    pipelineId: PIPELINE_ID,
    etapaId: STAGE_ID,
    versaoEsperada: version,
    ativo: true,
    secoes: [
      {
        id: SECTION_ID,
        chave: "principal",
        titulo: title,
        componentes: components.map((component) => ({
          id: component.id,
          chave: component.chave,
          tipo: component.tipo,
          campoId: component.campoId,
          capability: component.capability,
          configJson: component.configJson,
        })),
      },
    ],
  };
}

function transactionClient() {
  return {
    bpmPipeline: { update: mocks.pipelineUpdate },
    bpmEtapa: { findFirst: mocks.stageFindFirst },
    bpmCampo: { findMany: mocks.fieldFindMany },
    bpmEtapaFormulario: {
      findUniqueOrThrow: mocks.formFindUniqueOrThrow,
      updateMany: mocks.formUpdateMany,
      create: mocks.formCreate,
    },
    bpmFormularioSecao: {
      update: mocks.sectionUpdate,
      create: mocks.sectionCreate,
      deleteMany: mocks.sectionDeleteMany,
    },
    bpmFormularioComponente: {
      update: mocks.componentUpdate,
      create: mocks.componentCreate,
      deleteMany: mocks.componentDeleteMany,
    },
    bpmPipelineConfigAuditoria: { create: mocks.auditCreate },
  };
}

describe("contrato e salvamento diferencial do formulário de etapa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.access.mockResolvedValue(undefined);
    mocks.stageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      nome: "Novos leads",
      capabilitiesJson: JSON.stringify(["FOLLOW_UP_SCHEDULER"]),
      formulario: persistedForm(),
    });
    mocks.fieldFindMany.mockResolvedValue([
      {
        id: FIELD_ID,
        nome: "CNPJ",
        ativo: true,
        pipelineId: PIPELINE_ID,
        etapaConfiguracoes: [{ id: "config-1", visivel: true }],
        pipelinesAssociados: [],
      },
    ]);
    mocks.formFindUniqueOrThrow.mockResolvedValue(persistedForm());
    mocks.formUpdateMany.mockResolvedValue({ count: 1 });
    mocks.sectionUpdate.mockResolvedValue({ id: SECTION_ID });
    mocks.componentUpdate.mockResolvedValue({ id: FIELD_COMPONENT_ID });
    mocks.sectionDeleteMany.mockResolvedValue({ count: 0 });
    mocks.componentDeleteMany.mockResolvedValue({ count: 0 });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.pipelineUpdate.mockResolvedValue({ configVersion: 2 });
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient()));
  });

  it("autentica antes de validar ou abrir transação", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await SalvarFormularioEtapaBpm(input())).toEqual({
      success: false,
      error: "Não autorizado",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("preserva CHECKLIST e CAPABILITY válidos no schema", () => {
    const parsed = salvarFormularioEtapaSchema.parse(input());
    expect(parsed.secoes[0].componentes[1].capability).toBe("STAGE_CHECKLIST");
    expect(parsed.secoes[0].componentes[2].capability).toBe("FOLLOW_UP_SCHEDULER");
  });

  it("rejeita capability inexistente e campo duplicado", () => {
    const invalidCapability = input();
    invalidCapability.secoes[0].componentes[2].capability = "ARBITRARY_STRING";
    expect(salvarFormularioEtapaSchema.safeParse(invalidCapability).success).toBe(false);

    const duplicate = input();
    duplicate.secoes[0].componentes.push({
      ...duplicate.secoes[0].componentes[0],
      id: "another-id",
      chave: "another-key",
    });
    expect(salvarFormularioEtapaSchema.safeParse(duplicate).success).toBe(false);
  });

  it("reconhece read → save sem alteração como semanticamente idempotente", () => {
    expect(
      formularioEtapaSemAlteracao(persistedForm(), {
        ativo: true,
        secoes: input().secoes,
      }),
    ).toBe(true);
  });

  it("não escreve no banco em save semanticamente idêntico", async () => {
    const result = await SalvarFormularioEtapaBpm(input());
    expect(result.success).toBe(true);
    expect(mocks.formUpdateMany).not.toHaveBeenCalled();
    expect(mocks.sectionUpdate).not.toHaveBeenCalled();
    expect(mocks.componentUpdate).not.toHaveBeenCalled();
    expect(mocks.componentDeleteMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("preserva IDs e targets ao atualizar diferencialmente", async () => {
    mocks.formFindUniqueOrThrow.mockResolvedValue(persistedForm(2));
    const result = await SalvarFormularioEtapaBpm(input("Dados principais"));

    expect(result.success).toBe(true);
    expect(mocks.formUpdateMany).toHaveBeenCalledWith({
      where: { id: FORM_ID, versao: 1 },
      data: { ativo: true, versao: { increment: 1 } },
    });
    expect(mocks.componentDeleteMany).not.toHaveBeenCalled();
    expect(mocks.componentCreate).not.toHaveBeenCalled();
    expect(mocks.componentUpdate).toHaveBeenCalledWith({
      where: { id: CHECKLIST_COMPONENT_ID },
      data: expect.objectContaining({
        secaoId: SECTION_ID,
        capability: "STAGE_CHECKLIST",
      }),
    });
    expect(mocks.componentUpdate).toHaveBeenCalledWith({
      where: { id: CAPABILITY_COMPONENT_ID },
      data: expect.objectContaining({ capability: "FOLLOW_UP_SCHEDULER" }),
    });
  });

  it("remove somente o componente explicitamente omitido", async () => {
    mocks.formFindUniqueOrThrow.mockResolvedValue(persistedForm(2));
    const changed = input("Dados principais");
    changed.secoes[0].componentes = changed.secoes[0].componentes.filter(
      (component) => component.id !== CHECKLIST_COMPONENT_ID,
    );

    const result = await SalvarFormularioEtapaBpm(changed);
    expect(result.success).toBe(true);
    expect(mocks.componentDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: [CHECKLIST_COMPONENT_ID] } },
    });
    expect(mocks.componentCreate).not.toHaveBeenCalled();
  });

  it("rejeita capability canônica que não está habilitada na etapa", async () => {
    const changed = input("Alterado");
    changed.secoes[0].componentes.push({
      chave: "meeting",
      tipo: "CAPABILITY",
      campoId: null,
      capability: "MEETING_SCHEDULER",
      configJson: null,
    });
    const result = await SalvarFormularioEtapaBpm(changed);
    expect(result).toMatchObject({ success: false });
    expect(result.error).toContain("CAPABILITY_FORA_ETAPA");
    expect(result.error).toContain("Novos leads");
    expect(mocks.formUpdateMany).not.toHaveBeenCalled();
  });

  it("rejeita versão obsoleta antes de qualquer escrita", async () => {
    mocks.stageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      nome: "Novos leads",
      capabilitiesJson: JSON.stringify(["FOLLOW_UP_SCHEDULER"]),
      formulario: persistedForm(2),
    });
    const result = await SalvarFormularioEtapaBpm(input("Principal", 1));
    expect(result).toMatchObject({ success: false });
    expect(result.error).toContain("CONFLITO_VERSAO_FORMULARIO");
    expect(mocks.fieldFindMany).not.toHaveBeenCalled();
    expect(mocks.formUpdateMany).not.toHaveBeenCalled();
  });

  it("não permite perder ou trocar o target de componente persistido", async () => {
    mocks.stageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      nome: "Novos leads",
      capabilitiesJson: JSON.stringify(["FOLLOW_UP_SCHEDULER", "MEETING_SCHEDULER"]),
      formulario: persistedForm(),
    });
    const changedTarget = input("Alterado");
    changedTarget.secoes[0].componentes[1].capability = "MEETING_SCHEDULER";
    changedTarget.secoes[0].componentes[1].tipo = "CAPABILITY";
    const result = await SalvarFormularioEtapaBpm(changedTarget);
    expect(result).toMatchObject({ success: false });
    expect(result.error).toContain("IDENTIDADE_COMPONENTE_INCOMPATIVEL");
    expect(mocks.formUpdateMany).not.toHaveBeenCalled();
  });

  it("identifica campo, etapa e motivo quando a configuração não é visível", async () => {
    mocks.fieldFindMany.mockResolvedValue([
      {
        id: FIELD_ID,
        nome: "CNPJ",
        ativo: true,
        pipelineId: PIPELINE_ID,
        etapaConfiguracoes: [{ id: "config-1", visivel: false }],
        pipelinesAssociados: [],
      },
    ]);
    const result = await SalvarFormularioEtapaBpm(input("Alterado"));
    expect(result).toMatchObject({ success: false });
    expect(result.error).toContain("CAMPO_FORA_FORMULARIO_ETAPA");
    expect(result.error).toContain("CNPJ");
    expect(result.error).toContain("Novos leads");
    expect(result.error).toContain("não visível");
    expect(mocks.formUpdateMany).not.toHaveBeenCalled();
  });

  it("rejeita campo sem configuração canônica na etapa sem fallback de pipeline", async () => {
    mocks.fieldFindMany.mockResolvedValue([
      {
        id: FIELD_ID,
        nome: "CNPJ",
        ativo: true,
        pipelineId: PIPELINE_ID,
        etapaConfiguracoes: [],
        pipelinesAssociados: [],
      },
    ]);
    const result = await SalvarFormularioEtapaBpm(input("Alterado"));
    expect(result).toMatchObject({ success: false });
    expect(result.error).toContain("não existe BpmCampoEtapaConfig");
    expect(mocks.formUpdateMany).not.toHaveBeenCalled();
  });
});
