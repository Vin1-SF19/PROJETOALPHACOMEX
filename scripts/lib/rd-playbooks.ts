import type { JSONContent } from '@tiptap/react';
import { desserializarScriptEtapa, serializarScriptEtapa, scriptEtapaPersistidoValido } from '../../src/lib/bpm/script-etapa';
import { textoLegivelRd } from '../../src/lib/bpm/rd-station-text';
export const PLAYBOOK_DESTINATIONS: Record<string, readonly [string, string]> = {
  '6672fd5e2ba7e000181cdba4': ['Revisão de Radar', 'Fechado'],
  '667ed153478ffa00212d88d9': ['Operacional', 'Boas vindas'],
  '667ed153478ffa00212d88db': ['Operacional', 'Documentação em análise'],
  '6681a7ad67810b001961680e': ['Financeiro', 'Elaboração de Contrato'],
  '6681a7ad67810b0019616810': ['Financeiro', 'Confirmação de Pagamento'],
  '6681a7ad67810b0019616811': ['Financeiro', 'Emissão de Nota Fiscal'],
  '6681a8962a5fe30016466933': ['Financeiro', 'Emissão de Nota Fiscal'],
  '6681bb849753840016503883': ['Financeiro', 'Concluido'],
  '6681bc96f250270010f9b255': ['Operacional', 'Revisão'],
  '6681bc96f250270010f9b257': ['Operacional', 'Revisão do protocolo'],
  '6681bc96f250270010f9b258': ['Operacional', 'Aguardando despacho'],
  '66881b2f26e5f20010518ef0': ['Operacional', 'Boas vindas'],
  '66881b2f26e5f20010518ef1': ['Operacional', 'Boas vindas'],
  '66881b2f26e5f20010518ef2': ['Operacional', 'Documentação em análise'],
};
export type SourcePlaybook = { id: string; name: string; pipeline: string; objective: string | null; description: string | null };
export function composePlaybooks(existing: string | null, guides: SourcePlaybook[]): string {
  const previous = desserializarScriptEtapa(existing);
  if (existing?.startsWith('SCRIPT_NOTE_V1:') && !previous.estruturado) throw Error('Script estruturado existente inválido');
  const content: JSONContent[] = [...(previous.content.content ?? [])];
  const text: string[] = previous.plainText ? [previous.plainText] : [];
  const groups = new Map<string, SourcePlaybook[]>();
  for (const guide of guides) {
    const key = JSON.stringify([guide.objective, guide.description]);
    groups.set(key, [...(groups.get(key) ?? []), guide]);
  }
  function paragraph(value: string, heading = false) {
    const readable = textoLegivelRd(value);
    text.push(readable);
    for (const line of readable.split(/\r?\n/)) content.push({ type: heading ? 'heading' : 'paragraph', ...(heading ? { attrs: { level: 3 } } : {}), content: line ? [{ type: 'text', text: line }] : [] });
  }
  for (const group of groups.values()) {
    if (content.length) content.push({ type: 'horizontalRule' });
    paragraph(`Orientação RD — ${group[0].name}`, true);
    paragraph(`Origem: ${group.map(g => `${g.pipeline} / ${g.name}`).join('; ')}`);
    if (group[0].objective?.trim()) { paragraph('Objetivo', true); paragraph(group[0].objective); }
    if (group[0].description?.trim()) { paragraph('Orientações', true); paragraph(group[0].description); }
  }
  const result = serializarScriptEtapa({ type: 'doc', content }, text.join('\n\n'));
  if (!result || !scriptEtapaPersistidoValido(result)) throw Error('Script resultante inválido ou acima dos limites');
  return result;
}

export const PLAYBOOK_SOURCES: Record<string, { name: string; pipeline: string; pipelineId: string }> = {
  "6672fd5e2ba7e000181cdba4": {
    "name": "Contratos à enviar",
    "pipeline": "REVISÃO DE ESTIMATIVA DO RADAR (LEADS)",
    "pipelineId": "6672fd5d2ba7e000181cdba0"
  },
  "667ed153478ffa00212d88d9": {
    "name": "Envio do checklist e boas vindas",
    "pipeline": "DIRETORIA OPERACIONAL - Vitor",
    "pipelineId": "667ed153478ffa00212d88d7"
  },
  "667ed153478ffa00212d88db": {
    "name": "Documentação em análise - VITOR",
    "pipeline": "DIRETORIA OPERACIONAL - Vitor",
    "pipelineId": "667ed153478ffa00212d88d7"
  },
  "6681a7ad67810b001961680e": {
    "name": "Elaborar contrato",
    "pipeline": "DEPTO. FINANCEIRO - Entrada",
    "pipelineId": "6681a7ad67810b001961680c"
  },
  "6681a7ad67810b0019616810": {
    "name": "Pagamento confirmado",
    "pipeline": "DEPTO. FINANCEIRO - Entrada",
    "pipelineId": "6681a7ad67810b001961680c"
  },
  "6681a7ad67810b0019616811": {
    "name": "Enviar NF - Contratação",
    "pipeline": "DEPTO. FINANCEIRO - Entrada",
    "pipelineId": "6681a7ad67810b001961680c"
  },
  "6681a8962a5fe30016466933": {
    "name": "Enviar NF - êxito",
    "pipeline": "DPTO. FINANCEIRO - Êxito",
    "pipelineId": "6681a8952a5fe30016466931"
  },
  "6681bb849753840016503883": {
    "name": "Pgto confirmado",
    "pipeline": "DPTO. FINANCEIRO - Êxito",
    "pipelineId": "6681a8952a5fe30016466931"
  },
  "6681bc96f250270010f9b255": {
    "name": "Processos para revisão",
    "pipeline": "REVISÃO DO RADAR (OPERACIONAL PROTOCOLO)",
    "pipelineId": "6681bc96f250270010f9b253"
  },
  "6681bc96f250270010f9b257": {
    "name": "Revisão do protocolo feito",
    "pipeline": "REVISÃO DO RADAR (OPERACIONAL PROTOCOLO)",
    "pipelineId": "6681bc96f250270010f9b253"
  },
  "6681bc96f250270010f9b258": {
    "name": "Aguardando despacho",
    "pipeline": "REVISÃO DO RADAR (OPERACIONAL PROTOCOLO)",
    "pipelineId": "6681bc96f250270010f9b253"
  },
  "66881b2f26e5f20010518ef0": {
    "name": "Contratados stand-by",
    "pipeline": "REVISÃO DO RADAR (OPERACIONAL) - Maria",
    "pipelineId": "66881b2f26e5f20010518eee"
  },
  "66881b2f26e5f20010518ef1": {
    "name": "Envio do checklist e boas vindas",
    "pipeline": "REVISÃO DO RADAR (OPERACIONAL) - Maria",
    "pipelineId": "66881b2f26e5f20010518eee"
  },
  "66881b2f26e5f20010518ef2": {
    "name": "Documentação em análise",
    "pipeline": "REVISÃO DO RADAR (OPERACIONAL) - Maria",
    "pipelineId": "66881b2f26e5f20010518eee"
  }
};
