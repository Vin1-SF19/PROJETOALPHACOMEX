import {
  BPM_STAGE_CHECKLIST_TARGET,
  BPM_FORM_FIELD_CONFIG_SCHEMA,
  obterDefinicaoComponenteFormulario,
} from "@/lib/bpm/formularios-etapa";

export type CampoCanonicoFormulario = {
  id: string;
  chave?: string | null;
  nome: string;
  tipo: string;
  visivel?: boolean;
  editavel?: boolean;
  somenteLeitura?: boolean;
  obrigatorio?: boolean;
};

export type FormularioEtapaPersistido = {
  id: string;
  ativo: boolean;
  versao: number;
  secoes: Array<{
    id: string;
    chave: string;
    titulo: string;
    ordem: number;
    componentes: Array<{
      id: string;
      chave: string;
      tipo: string;
      campoId: string | null;
      capability: string | null;
      configJson: string | null;
      ordem: number;
    }>;
  }>;
};

export type DiagnosticoFormularioEtapa = {
  code:
    | "FORMULARIO_AUSENTE"
    | "FORMULARIO_INATIVO"
    | "CAMPO_FORA_ETAPA"
    | "TARGET_DESCONHECIDO"
    | "TARGET_DUPLICADO"
    | "TIPO_TARGET_INCOMPATIVEL"
    | "CONFIG_INVALIDA";
  formularioId?: string;
  secaoId?: string;
  componenteId?: string;
  message: string;
};

export type ComponenteFormularioResolvido = {
  id: string;
  chave: string;
  tipo: "CAMPO" | "CHECKLIST" | "CAPABILITY" | "INVALIDO";
  campoId: string | null;
  capability: string | null;
  rendererId: string | null;
  config: Record<string, unknown>;
  valido: boolean;
  visivel: boolean;
  motivo?: string;
};

export type FormularioEtapaResolvido = {
  id: string | null;
  versao: number | null;
  ativo: boolean;
  status: "READY" | "MISSING" | "INACTIVE" | "INVALID";
  secoes: Array<{
    id: string;
    chave: string;
    titulo: string;
    componentes: ComponenteFormularioResolvido[];
  }>;
  diagnosticos: DiagnosticoFormularioEtapa[];
};

function parseConfig(configJson: string | null): Record<string, unknown> | null {
  if (!configJson?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(configJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a apresentação sem consultar pipeline, nomes ou tabelas legadas.
 * A lista `camposCanonicos` já deve ter sido derivada de BpmCampoEtapaConfig.
 */
export function resolverFormularioEtapa(params: {
  formulario: FormularioEtapaPersistido | null | undefined;
  camposCanonicos: readonly CampoCanonicoFormulario[];
  campoIdsVisiveis?: ReadonlySet<string> | readonly string[];
}): FormularioEtapaResolvido {
  const { formulario } = params;
  if (!formulario) {
    return {
      id: null,
      versao: null,
      ativo: false,
      status: "MISSING",
      secoes: [],
      diagnosticos: [{
        code: "FORMULARIO_AUSENTE",
        message: "A etapa não possui formulário canônico publicado.",
      }],
    };
  }
  if (!formulario.ativo) {
    return {
      id: formulario.id,
      versao: formulario.versao,
      ativo: false,
      status: "INACTIVE",
      secoes: [],
      diagnosticos: [{
        code: "FORMULARIO_INATIVO",
        formularioId: formulario.id,
        message: "O formulário canônico desta etapa está inativo.",
      }],
    };
  }

  const campos = new Map(params.camposCanonicos.map((campo) => [campo.id, campo]));
  const targetsResolvidos = new Set<string>();
  const campoIdsVisiveis = params.campoIdsVisiveis
    ? params.campoIdsVisiveis instanceof Set
      ? params.campoIdsVisiveis
      : new Set(params.campoIdsVisiveis)
    : new Set(params.camposCanonicos.map((campo) => campo.id));
  const diagnosticos: DiagnosticoFormularioEtapa[] = [];
  const secoes = [...formulario.secoes]
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))
    .map((secao) => ({
      id: secao.id,
      chave: secao.chave,
      titulo: secao.titulo,
      componentes: [...secao.componentes]
        .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))
        .map((componente): ComponenteFormularioResolvido => {
          const config = parseConfig(componente.configJson);
          if (!config) {
            const motivo = "A configuração do componente não contém um objeto JSON válido.";
            diagnosticos.push({
              code: "CONFIG_INVALIDA",
              formularioId: formulario.id,
              secaoId: secao.id,
              componenteId: componente.id,
              message: motivo,
            });
            return { ...componente, tipo: "INVALIDO", rendererId: null, config: {}, valido: false, visivel: true, motivo };
          }

          if (componente.tipo === "CAMPO") {
            if (componente.capability) {
              const motivo = "Um componente CAMPO não pode apontar para uma capability.";
              diagnosticos.push({
                code: "TIPO_TARGET_INCOMPATIVEL",
                formularioId: formulario.id,
                secaoId: secao.id,
                componenteId: componente.id,
                message: motivo,
              });
              return { ...componente, tipo: "INVALIDO", rendererId: null, config, valido: false, visivel: true, motivo };
            }
            if (!componente.campoId || !campos.has(componente.campoId)) {
              const motivo = "O campo não está visível/aplicável na configuração canônica da etapa.";
              diagnosticos.push({
                code: "CAMPO_FORA_ETAPA",
                formularioId: formulario.id,
                secaoId: secao.id,
                componenteId: componente.id,
                message: motivo,
              });
              return { ...componente, tipo: "INVALIDO", rendererId: null, config, valido: false, visivel: true, motivo };
            }
            const validacaoConfig = BPM_FORM_FIELD_CONFIG_SCHEMA.safeParse(config);
            if (!validacaoConfig.success) {
              const motivo = "As propriedades do campo não atendem ao schema registrado.";
              diagnosticos.push({
                code: "CONFIG_INVALIDA",
                formularioId: formulario.id,
                secaoId: secao.id,
                componenteId: componente.id,
                message: motivo,
              });
              return { ...componente, tipo: "INVALIDO", rendererId: null, config, valido: false, visivel: true, motivo };
            }
            return { ...componente, tipo: "CAMPO", rendererId: "field", config: validacaoConfig.data, valido: true, visivel: campoIdsVisiveis.has(componente.campoId) };
          }

          const definicao = obterDefinicaoComponenteFormulario(componente.capability);
          if (!definicao) {
            const motivo = "O target do componente não existe no registry canônico.";
            diagnosticos.push({
              code: "TARGET_DESCONHECIDO",
              formularioId: formulario.id,
              secaoId: secao.id,
              componenteId: componente.id,
              message: motivo,
            });
            return { ...componente, tipo: "INVALIDO", rendererId: null, config, valido: false, visivel: true, motivo };
          }
          if (definicao.tipo !== componente.tipo) {
            const motivo = "O tipo persistido é incompatível com o target registrado.";
            diagnosticos.push({
              code: "TIPO_TARGET_INCOMPATIVEL",
              formularioId: formulario.id,
              secaoId: secao.id,
              componenteId: componente.id,
              message: motivo,
            });
            return { ...componente, tipo: "INVALIDO", rendererId: null, config, valido: false, visivel: true, motivo };
          }
          if (componente.campoId) {
            const motivo = "Um componente especializado não pode apontar para um campo.";
            diagnosticos.push({
              code: "TIPO_TARGET_INCOMPATIVEL",
              formularioId: formulario.id,
              secaoId: secao.id,
              componenteId: componente.id,
              message: motivo,
            });
            return { ...componente, tipo: "INVALIDO", rendererId: null, config, valido: false, visivel: true, motivo };
          }
          const validacaoConfig = definicao.configSchema.safeParse(config);
          if (!validacaoConfig.success) {
            const motivo = "As propriedades do componente não atendem ao schema registrado.";
            diagnosticos.push({
              code: "CONFIG_INVALIDA",
              formularioId: formulario.id,
              secaoId: secao.id,
              componenteId: componente.id,
              message: motivo,
            });
            return { ...componente, tipo: "INVALIDO", rendererId: null, config, valido: false, visivel: true, motivo };
          }
          if (!definicao.multiple && targetsResolvidos.has(definicao.target)) {
            const motivo = "O target não permite mais de uma ocorrência no formulário.";
            diagnosticos.push({
              code: "TARGET_DUPLICADO",
              formularioId: formulario.id,
              secaoId: secao.id,
              componenteId: componente.id,
              message: motivo,
            });
            return { ...componente, tipo: "INVALIDO", rendererId: null, config: validacaoConfig.data, valido: false, visivel: true, motivo };
          }
          targetsResolvidos.add(definicao.target);
          return {
            ...componente,
            tipo: componente.tipo as "CHECKLIST" | "CAPABILITY",
            rendererId: definicao.rendererId,
            config: validacaoConfig.data,
            valido: true,
            visivel: true,
          };
        }),
    }));

  return {
    id: formulario.id,
    versao: formulario.versao,
    ativo: true,
    status: diagnosticos.length ? "INVALID" : "READY",
    secoes,
    diagnosticos,
  };
}

export function formularioPossuiTarget(
  formulario: FormularioEtapaResolvido,
  target: string,
): boolean {
  return formulario.secoes.some((secao) =>
    secao.componentes.some(
      (componente) => componente.valido && componente.capability === target,
    ),
  );
}

export function formularioPossuiChecklist(formulario: FormularioEtapaResolvido): boolean {
  return formularioPossuiTarget(formulario, BPM_STAGE_CHECKLIST_TARGET);
}
