# CodeRabbit Review — CS & NPS alertas de Último CS

**Data:** 2026-09-15
**Escopo:** alterações não commitadas da story `STORY-CS-NPS-ALERTAS-ULTIMO-CS-DEZ-DIAS`

## Execução

A CLI do CodeRabbit não está instalada neste ambiente: não há executável `wsl`, `coderabbit` ou `/home/ialpha/.local/bin/coderabbit`. O self-healing automatizado não pôde ser executado.

## Fallback manual

O diff do recorte foi revisado manualmente com foco em:

- autorização estrita para roles normalizadas `TI` e `RECURSOSHUMANOS` na consulta e no salvamento rápido;
- fonte de verdade no último `ClienteServicoLogCs.dataRegistro`, sem uso de `ultimoCs` legado;
- fronteira inclusiva de 10 dias e DTO serializável;
- ausência de mudança de schema, migration, seed ou variável de ambiente;
- identidade por `clienteServicoId` no fluxo de múltiplos serviços;
- reconciliação sem consultas sobrepostas e leitura nova obrigatória após salvar;
- preservação das demais fontes da central global;
- validação de sentimento, data e relato no modal rápido.

## Resultado

| Severidade | Quantidade | Situação |
|---|---:|---|
| CRITICAL | 0 | Nenhum achado na revisão manual |
| HIGH | 0 | Nenhum achado na revisão manual |
| MEDIUM | 0 | Nenhum achado na revisão manual |
| LOW | 0 | Nenhum achado na revisão manual |

**Decisão do fallback:** PASS no recorte. A indisponibilidade da CLI permanece registrada e não substitui o gate global, atualmente bloqueado por regressões preexistentes fora desta story.
