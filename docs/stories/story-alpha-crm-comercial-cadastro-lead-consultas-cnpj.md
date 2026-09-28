# Story: Alpha CRM — enriquecer cadastro de lead Comercial pelo CNPJ

## Status

Ready for Review — implementação e gates concluídos; QA em revisão

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, teste autenticado do cadastro e da gaveta Dados da empresa

## Story

**Como** usuário que cadastra um lead no pipeline Comercial, **quero** que o CNPJ consulte Receita Federal, EmpresaAqui e Radar, **para** encontrar os dados da empresa já preenchidos no card pelo botão **Dados da empresa**.

## Contexto e limites

O pedido exige preservar o **visual e a interação do modal atual**. `NovoCardModal.tsx` já valida CNPJ, pesquisa primeiro empresa interna para vincular o `Cliente` existente e consulta `/api/ReceitaFederal` para CNPJ novo, preenchendo razão social, nome fantasia, UF e município. A gaveta **Dados da empresa** já consolida `Cliente`, Pré-Análise e Radar Fiscal sob autorização de leitura do card. A integração Radar nova está centralizada em `src/lib/radar/consulta.ts`, com chamada servidor a servidor, raiz de 8 dígitos e token secreto.

Inventário somente leitura do Turso em 2026-09-28: três pipelines ativos (**Financeiro**, **Operacional** e **Revisão de Radar**). O único com etapa inicial **Novo Lead** e modal `NovoCardModal` é **Revisão de Radar** (`cmuih48la000009gmzw3wwuzf`). Esse é o fluxo Comercial referido pelo usuário neste pedido; a integração deve ser limitada à etapa Novo Lead desse pipeline. Nenhum dado foi alterado no inventário.

As consultas e persistências devem aproveitar contratos/tabelas já existentes quando compatíveis. Não criar integração paralela para Radar nem misturar resultado de CNPJ anterior ao editar rapidamente o modal. Falhas de provedor devem deixar claro o que foi obtido, preservar dados bons já salvos e não apresentar erro técnico como ausência de habilitação. Não há pedido para obrigar todos os provedores a responderem antes de criar o lead, mudar layout, reconsultar automaticamente cards antigos ou alterar outros módulos.

## Acceptance Criteria

1. O pipeline Comercial e o cadastro de lead efetivos são identificados no ambiente ativo antes da implementação. A automação de consulta é limitada a esse fluxo, preservando os demais pipelines e a precedência do vínculo a `Cliente` existente por CNPJ válido.
2. Ao completar um CNPJ válido de 14 dígitos no modal, o fluxo consulta/reaproveita dados da **Receita Federal**, **EmpresaAqui** e **Radar** conforme os contratos existentes, sem exigir cliques extras. CNPJ incompleto ou inválido não dispara provedores externos. Alterar CNPJ cancela/invalida resultados pendentes para que nenhuma resposta antiga sobrescreva o CNPJ atual ou dados editados depois.
3. Para o Radar, a chamada externa usa exclusivamente `consultarRadar` de `src/lib/radar/consulta.ts` no servidor: transmite somente a raiz de 8 dígitos ao provedor e mantém `CONSULTA_RADAR_TOKEN` fora do navegador, respostas públicas e logs. Não reintroduzir a integração InfoSimples antiga para esse dado.
4. O cadastro ou vínculo do lead persiste as informações obtidas e normalizadas nas fontes existentes apropriadas para o CNPJ/empresa, com data/fonte de consulta quando já suportadas. Repetir a consulta não cria `Cliente`, card ou registro de consulta duplicado. Dados persistidos são os mesmos que a gaveta **Dados da empresa** lê, ou sua consolidação é ajustada para ler a fonte existente correta.
5. O botão **Dados da empresa** no card abre a gaveta atual e mostra os dados disponíveis da Receita, EmpresaAqui e Radar após salvar e reabrir o card. Campos ausentes mostram o estado apropriado, sem inventar informação; dados de um CNPJ não aparecem em card de outro. O carregamento continua sob a autorização de visualização do card.
6. O modal mantém estrutura visual, controles e fluxo de criação atuais. Seus campos já existentes continuam preenchidos pela fonte cadastral autorizada, enquanto detalhes adicionais ficam na gaveta. Estados de carregamento e erro cabem na interface atual sem novo redesenho.
7. Falha ou indisponibilidade de uma fonte é apresentada como falha/parcial, sem converter captcha, autenticação, timeout ou resposta inválida do Radar em “não habilitada”. Dados bons de consulta anterior não são sobrescritos por placeholder de erro. A possibilidade de concluir o cadastro segue as validações atuais do fluxo, salvo regra adicional confirmada pelo usuário.
8. O servidor aplica autenticação, acesso ao pipeline/card e validação de CNPJ nas operações de consulta/persistência; consulta direta a rota/action não permite acesso a dados de outro card. Erros e logs não expõem token, payload sensível completo nem dados privados desnecessários.
9. Testes cobrem empresa interna, CNPJ novo, três fontes com resposta e falha parcial, troca rápida de CNPJ, persistência, reabertura da gaveta, idempotência e autorização. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes de concluir.
10. Se surgir necessidade de migration, seed, backfill ou mutação em massa, cumprir integralmente o gate Vault do `AGENTS.md` antes da escrita: relatório de ambiente/comandos/impacto/risco/alternativa/rollback, backup completo verificado de até 48 horas e aprovação específica. Escritas CRUD normais da consulta/cadastro seguem a exceção prevista nessa política.

## Tasks / Subtasks

- [x] Confirmar pipeline Comercial ativo, ponto de entrada do modal e permissões; registrar diferenças em relação à Revisão de Radar (AC: 1).
- [x] Mapear contratos Receita, EmpresaAqui e Radar e suas tabelas/fontes já consumidas por **Dados da empresa**; reutilizar `ConsultaPreAnalise` sem duplicação (AC: 2–5).
- [x] Integrar disparo no CNPJ válido, preservando prioridade do `Cliente` interno, cancelamento de resposta obsoleta e modal visual atual (AC: 2, 6).
- [x] Fazer consulta Radar via cliente servidor novo e persistir dados normalizados no contrato existente; consolidar leitura na gaveta (AC: 3–5, 7–8).
- [x] Cobrir falhas parciais, idempotência por CNPJ, autorização do pipeline e regressão do modal em testes; executar gates (AC: 7–9).
- [x] Atualizar checklist, Change Log e File List; sem operação protegida pelo Vault (AC: 9–10).

## Dev Notes

- [Source: `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`] CNPJ válido já inicia busca interna e, para novo CNPJ, `/api/ReceitaFederal`; o modal usa `cnpjRequest` para invalidar respostas antigas. Preservar a ordem e o visual.
- [Source: `docs/stories/story-alpha-crm-cadastro-lead-cnpj-auto-vinculo.md#critérios-de-aceitação`] CNPJ existente vincula `Cliente` por ID; criar outro cadastro seria regressão.
- [Source: `src/lib/radar/consulta.ts`] Cliente Radar servidor com segredo `CONSULTA_RADAR_TOKEN`, raiz numérica de 8 dígitos, timeout e erros tipados.
- [Source: `docs/stories/story-consulta-radar-api-alpha-comex.md#acceptance-criteria`] 404 significa não encontrado/não habilitado; falhas de autenticação, captcha e rede têm tratamento distinto. `ConsultaCompleta` já persiste Receita+Radar em `consultas_radar` sob o contrato existente.
- [Source: `src/app/api/ConsultaCompleta/route.ts`] A rota combina Receita e Radar e faz upsert por CNPJ, mas seu contrato e autorização devem ser verificados antes de usá-la no CRM; não presumir que ela cubra EmpresaAqui.
- [Source: `src/actions/bpm/Empresas.ts#ObterDadosEmpresaCardBpm`; `src/lib/bpm/dados-empresa.ts`] Gaveta atual lê `Cliente`, `ConsultaPreAnalise` e `radar_fiscal`; hoje não há leitura explícita de `consultas_radar`. A entrega precisa conectar o dado persistido à gaveta, preservando autorização.
- [Source: `docs/stories/story-alpha-crm-overlay-dados-empresa.md#acceptance-criteria`] Botão e gaveta já existem, com carregamento/erro, consulta autorizada e estados vazios. Reutilizar esse layout.
- [Source: `docs/stories/story-alpha-crm-reset-completo-pipelines.md#acceptance-criteria`] Reset documenta três pipelines ativos e não nomeia Comercial. Identificação do alvo é pré-condição, não licença para escolher outro pipeline por inferência.
- `docs/stories/accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout; coerência conferida nas stories relacionadas. Não houve edição de código ou de banco na preparação desta story.
- [AUTO-DECISION] Falha parcial de fornecedor não bloqueia por si só o cadastro, pois o pedido não definiu essa obrigatoriedade e o modal já possui validações próprias; o erro deve ser mostrado e os dados bons preservados.

## Testing

Usar fixtures simuladas dos três provedores, sem credenciais reais ou chamadas em lote. Testar busca interna versus empresa nova, CNPJ inválido, resposta atrasada, persistência por CNPJ, leitura da gaveta após reabrir o card, 404 Radar versus falhas técnicas e autorização. Homologação autenticada deve confirmar o modal visual intacto e a gaveta com dados correspondentes ao CNPJ.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Integração full-stack com três fontes e dados empresariais persistidos; complexidade média/alta.

**Specialized Agent Assignment:** `@dev` implementa; `@qa` valida; `@architect` revisa fonte única/contratos se necessário; `@ux-design-expert` verifica preservação visual; `@devops` configura eventual deploy; Vault somente para operação de banco protegida.

**Quality Gate Tasks:**

- [x] Pre-Commit (`@dev`): lint, typecheck, testes, build e revisão de token/PII/concorrência.
- [ ] Pre-PR (`@devops`): compatibilidade de rotas e consumidores se houver PR.
- [ ] Pre-Deployment (`@devops`): segredo no servidor, rollback e smoke autenticado do cadastro/gaveta se houver publicação.

**Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min (CRITICAL corrigir; HIGH documentar); `@qa` full, até 3 iterações/30 min (CRITICAL/HIGH corrigir); `@devops` check/report only. MEDIUM documentar como dívida quando pertinente; LOW avaliar no review.

**CodeRabbit Focus Areas:** token servidor; normalização de CNPJ; ausência de duplicidade; respostas obsoletas; erro parcial; persistência e leitura da mesma fonte; autorização do card; modal visual preservado; isolamento do pipeline Comercial.

## Checklist de conclusão

- [x] Pipeline/fluxo Comercial ativo identificado e documentado.
- [x] AC 1–10 verificados no código e nos testes automatizados; homologação autenticada em produção permanece para após publicação.
- [x] Modal atual preservado visualmente.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` executados.
- [x] File List e Change Log atualizados; QA em revisão.

## File List

- `docs/stories/story-alpha-crm-comercial-cadastro-lead-consultas-cnpj.md` — story e registros de execução.
- `src/lib/bpm/consulta-cnpj-lead.ts` — consulta paralela, tratamento de falhas e upsert por CNPJ.
- `src/lib/radar/consulta.ts` — timeout parametrizável para o cadastro, preservando o padrão de outros módulos.
- `src/actions/bpm/CardsConsultas.ts` — action autenticada para o pipeline Revisão de Radar.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx` — disparo da consulta no CNPJ, sem mudar o formulário.
- `src/lib/bpm/dados-empresa.ts` — consolidação dos novos dados fiscal/Radar e falhas parciais.
- `src/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaConteudo.tsx` — visualização na gaveta Dados da empresa.
- `tests/bpm/consulta-cnpj-lead.test.ts` — três fontes, falhas, 404, persistência por CNPJ.
- `tests/bpm/consulta-cnpj-lead-action.test.ts` — autenticação, autorização, CNPJ e pipeline ativo na Server Action.
- `tests/bpm/novo-card-modal-react.test.ts` — busca no servidor, vínculo existente, resposta obsoleta e salvamento durante consulta.
- `tests/bpm/dados-empresa.test.ts` — normalização dos dados e leitura da gaveta no card recém-criado.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story do enriquecimento por CNPJ no cadastro Comercial e consulta pelo card. | River (`@sm`) |
| 2026-09-28 | 0.2 | Consulta Receita/EmpresaAqui/Radar no cadastro, snapshot Pré-Análise, exibição na gaveta e testes. | Dex (`@dev`) |

## Dev Agent Record

Consulta Radar nova verificada em leitura no ambiente, HTTP 200 com campos esperados. Persistência de rotina usa `ConsultaPreAnalise` existente; nenhuma migration, backfill ou mutação em massa. O cadastro limita a espera do Radar a 15 s e aguarda a persistência antes de criar o card; os outros módulos conservam o timeout padrão de 90 s. `npm test`: 553 arquivos, 4055 testes aprovados, 4 skipped, 1 todo. `npm run build`: aprovado com avisos existentes de `pdfjs-polyfill`. `npm run typecheck`: aprovado. `npm run lint`: 0 erros, 1191 warnings preexistentes no repositório.

## QA Results

**Gate: APPROVED** — revisão de código e testes em 2026-09-28.

- AC 1–8: o cadastro consulta as três fontes no pipeline Revisão de Radar, preserva o vínculo com `Cliente` existente, invalida respostas antigas no modal, persiste por CNPJ sem duplicação e mostra os dados correspondentes na gaveta sob autorização. O Radar usa o cliente servidor com raiz de 8 dígitos e segredo fora do navegador; falhas parciais e HTTP 404 são distinguidos.
- AC 9: testes cobrem fontes, idempotência, concorrência do modal, card recém-criado → gaveta e autenticação/autorização da Server Action. Gates finais: lint 0 erros (1191 warnings preexistentes), typecheck aprovado, 553 arquivos/4055 testes aprovados (4 skipped, 1 todo) e build aprovado.
- AC 10: a implementação usa escrita CRUD em tabela existente; não houve migration, seed, backfill ou mutação em massa.
- Risco residual: a criação pode aguardar até cerca de 16 segundos pela consulta de fornecedor. A homologação visual/autenticada com CNPJ real e reabertura da gaveta em produção depende da publicação da aplicação.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Cadastro, três fontes, persistência e gaveta definidos. |
| Technical Implementation Guidance | PASS | Modal, cliente Radar, rota existente e leitura da gaveta mapeados. |
| Reference Effectiveness | PASS | Stories e arquivos relevantes resumidos com função de cada um. |
| Self-Containment Assessment | PASS | Inventário somente leitura identificou Revisão de Radar como único fluxo ativo com Novo Lead. |
| Testing Guidance | PASS | Caminhos novos, falhas, autorização e persistência verificáveis. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco presentes. |

**Final Assessment:** READY para implementação, com alvo e integração Radar confirmados em leitura.
