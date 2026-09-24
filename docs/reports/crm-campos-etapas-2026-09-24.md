# Diagnóstico dos campos por etapa — 24/09/2026

Inventário somente leitura do banco remoto de produção. Inclui as configurações de campos nas etapas ativas dos pipelines ativos; não contém valores de cards nem dados pessoais. O CSV ao lado registra cada campo e suas flags de etapa.

| Pipeline | Configurações | Campos ativos e visíveis | Campos inativos ainda marcados visíveis |
| --- | ---: | ---: | ---: |
| Financeiro | 80 | 75 | 5 |
| Operacional | 78 | 72 | 6 |
| Revisão de Radar | 72 | 29 | 29 |

## Diagnóstico do aviso no card

O formulário publicado de **Reunião Agendada** no pipeline **Revisão de Radar** contém dois componentes inválidos: **Radar atual** (ID `ca4cadfe0c70c89d56c098a40`) e **Status da sede** (ID `c04896f2c2567b2e71dcfc721`). Ambos os campos estão globalmente inativos (`BpmCampo.ativo=0`), mas continuam visíveis na configuração da etapa e referenciados no formulário. A mesma dupla está nos formulários **Boas-vindas** e **Em análise** do pipeline **Operacional**, somando seis componentes inválidos em três formulários.

Os dois são seleções sem opções ativas nem `opcoesJson`, sem valores de cards, valores globais ou anexos. A desativação foi uma decisão administrativa documentada em `docs/stories/story-rm-2026-8c3862-revisao-radar.md` para evitar um campo de seleção sem catálogo. Reativá-los sem definir opções contraria essa decisão e não resolve o formulário de modo consistente.

A publicação da configuração principal altera `BpmCampo.ativo` sem remover referências em `BpmFormularioComponente` (`src/actions/bpm/ConfiguracaoPipeline.ts`). O renderer usa apenas campos ativos e aplicáveis; por isso encontra as referências antigas, isola os componentes e mostra o aviso. A configuração de visibilidade por etapa, sozinha, não reativa o campo.

A composição de **Reunião Agendada** possui 18 referências de campo: 16 válidas e essas duas inválidas. Os demais 176 componentes de campo publicados nos pipelines ativos são válidos; o total inventariado é 182. Não há obrigações ativas em campos globalmente inativos ou ocultos.

O único campo de seleção ativo e visível sem opções locais encontrado no inventário é **Regime tributário**, em quatro etapas. Ele lê `CLIENTE.regimeTributario` como fonte canônica e é uma exceção prevista na decisão administrativa; não produz este diagnóstico.

## Correção recomendada

Retirar somente as referências de **Radar atual** e **Status da sede** das composições publicadas das três etapas afetadas, preservando as definições inativas e seus vínculos históricos. Fazer isso pelo editor autenticado de Campos e formulários, com publicação individual de cada etapa, ou por uma operação administrativa auditada e protegida por versão. Não reativar os campos sem catálogo aprovado.

Este relatório não altera configurações ou dados.
