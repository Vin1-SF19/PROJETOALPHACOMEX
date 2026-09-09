import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  formularioPossuiTarget,
  resolverFormularioEtapa,
  type FormularioEtapaPersistido,
} from "@/lib/bpm/formulario-renderer";
import {
  BPM_FORM_COMPONENT_REGISTRY,
  listarCatalogoComponentesFormulario,
  salvarFormularioEtapaSchema,
} from "@/lib/bpm/formularios-etapa";
import { BPM_CAPABILITIES } from "@/lib/bpm/ontology";

const formulario: FormularioEtapaPersistido = {
  id: "form-1",
  ativo: true,
  versao: 2,
  secoes: [
    {
      id: "secao-2",
      chave: "especializados",
      titulo: "Especializados",
      ordem: 1,
      componentes: [
        {
          id: "cap-1",
          chave: "proximo-contato",
          tipo: "CAPABILITY",
          campoId: null,
          capability: BPM_CAPABILITIES.FOLLOW_UP_SCHEDULER,
          configJson: null,
          ordem: 0,
        },
      ],
    },
    {
      id: "secao-1",
      chave: "dados",
      titulo: "Dados",
      ordem: 0,
      componentes: [
        {
          id: "campo-2",
          chave: "campo-dois",
          tipo: "CAMPO",
          campoId: "field-2",
          capability: null,
          configJson: null,
          ordem: 1,
        },
        {
          id: "campo-1",
          chave: "campo-um",
          tipo: "CAMPO",
          campoId: "field-1",
          capability: null,
          configJson: null,
          ordem: 0,
        },
      ],
    },
  ],
};

const campos = [
  { id: "field-1", chave: "stable.one", nome: "Nome um", tipo: "texto", visivel: true },
  { id: "field-2", chave: "stable.two", nome: "Nome dois", tipo: "texto", visivel: true },
];

describe("P0-3 - resolver canônico do formulário de etapa", () => {
  it("preserva ordem de seções/componentes e resolve campos somente da configuração canônica", () => {
    const resultado = resolverFormularioEtapa({ formulario, camposCanonicos: campos });

    expect(resultado.status).toBe("READY");
    expect(resultado.secoes.map((secao) => secao.chave)).toEqual(["dados", "especializados"]);
    expect(resultado.secoes[0].componentes.map((item) => item.campoId)).toEqual(["field-1", "field-2"]);
  });

  it("não cria fallback quando um campo do formulário não pertence à etapa", () => {
    const resultado = resolverFormularioEtapa({ formulario, camposCanonicos: [campos[0]] });

    expect(resultado.status).toBe("INVALID");
    expect(resultado.diagnosticos).toContainEqual(expect.objectContaining({ code: "CAMPO_FORA_ETAPA", componenteId: "campo-2" }));
    expect(resultado.secoes[0].componentes[1]).toEqual(expect.objectContaining({ tipo: "INVALIDO", valido: false }));
  });

  it("distingue campo canônico condicionalmente oculto de campo inválido", () => {
    const resultado = resolverFormularioEtapa({
      formulario,
      camposCanonicos: campos,
      campoIdsVisiveis: new Set(["field-1"]),
    });

    expect(resultado.status).toBe("READY");
    expect(resultado.diagnosticos).toHaveLength(0);
    expect(resultado.secoes[0].componentes[1]).toEqual(
      expect.objectContaining({ campoId: "field-2", valido: true, visivel: false }),
    );
  });

  it("trata formulário ausente/inativo explicitamente sem herdar campos do pipeline", () => {
    const ausente = resolverFormularioEtapa({ formulario: null, camposCanonicos: campos });
    const inativo = resolverFormularioEtapa({ formulario: { ...formulario, ativo: false }, camposCanonicos: campos });

    expect(ausente).toEqual(expect.objectContaining({ status: "MISSING", secoes: [] }));
    expect(inativo).toEqual(expect.objectContaining({ status: "INACTIVE", secoes: [] }));
  });

  it("seleciona componente por target estável mesmo quando labels são renomeadas", () => {
    const resultado = resolverFormularioEtapa({
      formulario,
      camposCanonicos: campos.map((campo) => ({ ...campo, nome: `Renomeado ${campo.id}` })),
    });

    expect(formularioPossuiTarget(resultado, BPM_CAPABILITIES.FOLLOW_UP_SCHEDULER)).toBe(true);
    expect(resultado.secoes[1].componentes[0].rendererId).toBe("follow-up-scheduler");
  });

  it("isola target desconhecido e config fora do schema", () => {
    const desconhecido = structuredClone(formulario);
    desconhecido.secoes[0].componentes[0] = {
      ...desconhecido.secoes[0].componentes[0],
      tipo: "CAPABILITY",
      campoId: null,
      capability: "INEXISTENTE",
    };
    const configInvalida = structuredClone(formulario);
    configInvalida.secoes[0].componentes[0] = {
      ...configInvalida.secoes[0].componentes[0],
      tipo: "CAPABILITY",
      campoId: null,
      capability: BPM_CAPABILITIES.FOLLOW_UP_SCHEDULER,
      configJson: '{"arbitrario":true}',
    };

    expect(resolverFormularioEtapa({ formulario: desconhecido, camposCanonicos: campos }).diagnosticos[0].code).toBe("TARGET_DESCONHECIDO");
    expect(resolverFormularioEtapa({ formulario: configInvalida, camposCanonicos: campos }).diagnosticos[0].code).toBe("CONFIG_INVALIDA");
  });

  it("recusa target singular duplicado no save e isola duplicata persistida", () => {
    const duplicado = structuredClone(formulario);
    duplicado.secoes[0].componentes.push({
      ...duplicado.secoes[0].componentes[0],
      id: "cap-2",
      chave: "proximo-contato-duplicado",
      ordem: 1,
    });
    const resolvido = resolverFormularioEtapa({ formulario: duplicado, camposCanonicos: campos });
    const payload = {
      pipelineId: "pipeline-1",
      etapaId: "etapa-1",
      versaoEsperada: 2,
      ativo: true,
      secoes: duplicado.secoes.map((secao) => ({
        id: secao.id,
        chave: secao.chave,
        titulo: secao.titulo,
        componentes: secao.componentes.map((componente) => ({
          id: componente.id,
          chave: componente.chave,
          tipo: componente.tipo,
          campoId: componente.campoId,
          capability: componente.capability,
          configJson: componente.configJson,
        })),
      })),
    };

    expect(resolvido.status).toBe("INVALID");
    expect(resolvido.diagnosticos).toContainEqual(
      expect.objectContaining({ code: "TARGET_DUPLICADO", componenteId: "cap-2" }),
    );
    expect(salvarFormularioEtapaSchema.safeParse(payload).success).toBe(false);
  });

  it("builder e save derivam suas referências do mesmo registry", () => {
    const catalogo = listarCatalogoComponentesFormulario(JSON.stringify([
      BPM_CAPABILITIES.FOLLOW_UP_SCHEDULER,
    ]));

    expect(Object.keys(BPM_FORM_COMPONENT_REGISTRY)).toContain(BPM_CAPABILITIES.STAGE_CHECKLIST);
    expect(catalogo.map((item) => item.target)).toEqual([
      BPM_CAPABILITIES.STAGE_CHECKLIST,
      BPM_CAPABILITIES.FOLLOW_UP_SCHEDULER,
    ]);
  });

  it("card e preview usam o renderer compartilhado; preview permanece inerte", () => {
    const raiz = process.cwd();
    const slot = readFileSync(resolve(raiz, "src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx"), "utf8");
    const preview = readFileSync(resolve(raiz, "src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineWorkspaceSections.tsx"), "utf8");
    const cards = readFileSync(resolve(raiz, "src/actions/bpm/Cards.ts"), "utf8");

    expect(slot).toContain("<FormularioEtapaRenderer");
    expect(preview).toContain("<FormularioEtapaRenderer");
    expect(preview).toContain('mode="preview"');
    expect(preview).toContain("readOnly");
    expect(preview).toContain("disabled");
    expect(cards).toContain("resolverFormularioEtapa");
    expect(cards).toContain("formularioEtapa,");
    expect(slot).not.toMatch(/etapaEh[A-Z]/);
    expect(slot).not.toContain("card.etapa.nome");
  });
});
