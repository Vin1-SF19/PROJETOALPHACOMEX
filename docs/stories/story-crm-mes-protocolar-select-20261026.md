# Story — Seleção apenas do mês para protocolar no CRM

## Status

Ready for Review — LOCAL: implementação concluída, quatro gates globais aprovados e QA APPROVED para publicação isolada no staging. Deploy, SHA/alias e homologação autenticada remota permanecem pendentes; nenhum push é alegado.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["revisão do diff", "testes de domínio e formulário", "npm run lint", "npm run typecheck", "npm test", "npm run build", "validação autenticada no staging"]

## Story e fonte

Como usuário do CRM, quero escolher somente um mês no campo “Mês para protocolar”, para registrar a previsão de protocolo sem informar dia ou ano.

Fonte exata: **“No crm no pipeline do Operacional na etapa Envio do Check List Atualizado e em todas aonde tem ‘Mes para protocolar’ deve ser um sslect para selcionar apenas o Mes”.**

O escopo é o CRM, incluindo a etapa indicada e os formulários compartilhados que exibem o mesmo campo semântico em outras etapas/pipelines. Este pedido é independente do plano anterior de dez pendências do CRM; não cria pipeline nem ativa outras automações.

Base de preparação: staging `ca156313eec5e484e3efe64d64abc477ab3fc769`, branch `fix/crm-mes-protocolar-select-20261026`, worktree isolado `crm-mes-protocolar-select-20261026`.

## Acceptance Criteria

1. No pipeline Operacional, na etapa **Envio do Check List Atualizado**, o campo “Mês para protocolar” é apresentado como select com os doze meses do ano, de Janeiro a Dezembro, sem seleção de dia ou ano. O placeholder indica seleção de mês; não usar `input type="month"`, que também solicita ano.
2. O comportamento vale para todas as ocorrências do mesmo campo semântico nos formulários e requisitos de transição do CRM, inclusive campos legados equivalentes como “Mês de protocolo”. A identificação reconhece as chaves confirmadas `alpha.radar.viabilidade.mes_protocolar` e `alpha.mes.de.protocolo`, além dos nomes exatos normalizados “Mês para protocolar”, “Mês de protocolo” e “Mês protocolo”; não converte outros campos de data nem nomes apenas aproximadamente semelhantes.
3. A seleção salva e reabre com o mesmo mês. O payload e a validação compartilhada de frontend/backend usam os nomes completos em português como representação canônica do domínio de doze meses. O validador pode normalizar número de mês e datas ISO/BR legadas reconhecidas quando o campo for explicitamente submetido. Novos valores fora do domínio são recusados com erro amigável. Não inventar dia, ano atual ou uma data sentinela para persistir o novo mês.
4. Registros antigos permanecem legíveis. Datas legadas reconhecidas podem projetar seu mês para apresentação sem mutação automática; abrir o card ou salvar outro campo não converte nem apaga o valor antigo silenciosamente. Valores legados não reconhecidos não são atribuídos a um mês por adivinhação; preservá-los e permitir correção explícita conforme permissões.
5. A validação específica é aplicada somente ao campo de mês para protocolar, mesmo quando a configuração legada informa tipo `data` ou `texto`. A validação de datas completas, opções de outros selects, obrigatoriedade, campo vazio, somente leitura e permissões dos demais campos permanece intacta. O servidor continua sendo autoridade para validar os dados recebidos.
6. Todos os pontos que renderizam ou consomem esse campo no CRM são conferidos. A ficha de análise de viabilidade recebe/exibe o mês de forma coerente, sem reintroduzir dia/ano ou perder o novo formato. Em `ModalPdf.tsx`, o campo “Mês de Protocolo” usa o mesmo seletor de doze meses apenas no modo complementar do CRM; o modo padrão de geração da Pré-Análise permanece preservado. Datas legadas reconhecidas na montagem da ficha são apresentadas apenas como mês.
7. O select mantém tema, contraste, navegação por teclado, rótulo acessível e estado somente leitura/carregamento compatíveis com o formulário existente. Autosave, rascunhos por instância e troca de card não devem ser prejudicados.
8. A entrega não altera schema, não executa migration, seed/backfill, mutação em massa nem script de configuração do banco; não converte dados históricos em lote. Se uma necessidade estrutural/configuracional desse tipo for descoberta, deve seguir o protocolo Vault de `AGENTS.md` antes de executar. O módulo CheckList geral fica fora do escopo, salvo dependência comprovadamente necessária ao fluxo do CRM.
9. Testes meaningful cobrem domínio dos meses, campos por chave/nome legado, leitura de valores antigos, preservação ao salvar outro campo, persistência/reabertura, validação no servidor e regressão de datas não relacionadas. Executar os quatro gates obrigatórios; atualizar checklist e File List; revisar/publicar primeiro no staging pelo DevOps. Produção exige pedido explícito posterior.

## Tasks / Subtasks

- [x] Mapear os pontos de renderização, validação e consumo do campo no CRM, incluindo o formulário da etapa operacional solicitada (AC 1–2, 5–6).
- [x] Definir helper compartilhado de identificação, lista dos doze meses, representação canônica e projeção segura de valores legados, registrando a decisão (AC 2–5).
- [x] Integrar o select no renderer compartilhado e garantir propagação dos metadados necessários no editor de etapa e nos requisitos de transição (AC 1–2, 7).
- [x] Integrar validação específica no caminho compartilhado de frontend/backend, preservando as regras dos demais tipos e as permissões (AC 3, 5).
- [x] Conferir montagem/exibição da ficha e demais consumidores do campo no CRM, ajustando somente os afetados pelo novo domínio (AC 6).
- [x] Testar formatos legados, campos desconhecidos, salvamento de outro campo, recarga, obrigatório/vazio e datas completas não relacionadas (AC 3–5, 9).
- [ ] Conferir keyboard, tema e somente leitura na UI, além de rascunhos por instância/troca de card (AC 7).
- [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; registrar comandos, resultados e limitações reais (AC 9).
- [x] Concluir revisão de QA, atualizar File List/checklist e entregar ao DevOps para commit local e publicação isolada no staging (AC 8–9).
- [ ] Publicar pelo CLI no ambiente staging autorizado, conferir SHA/deployment/alias e concluir aceite autenticado remoto; push da branch staging concorrente não está autorizado nesta entrega isolada (AC 9).

## Dev Notes

### Contexto cruzado e documentos de referência

- `accumulated-context.md` não foi encontrado neste checkout. A coerência cruzada usa as stories e o código listados abaixo; não se alega leitura de arquivo inexistente.
- `.Codex/commands/AIOX/agents/sm.md` não existe neste checkout; persona carregada pelo fallback `.aiox-core/development/agents/sm.md`. `.aiox/gotchas.json` também não foi encontrado.
- Os caminhos `docs/framework/coding-standards.md`, `tech-stack.md` e `source-tree.md`, além de `docs/architecture/index.md`, não foram encontrados. Sem orientação específica encontrada nesses documentos; usar as restrições do `AGENTS.md`, o preset registrado em `.aiox-core/data/technical-preferences.md` e os padrões reais do componente compartilhado. Não instalar biblioteca nova por causa desta mudança.
- A story da ficha automática preserva os dados do próprio card/empresa, usa o mesmo modelo da Pré-Análise e evita sobrescrever cadastro ou valores canônicos durante complemento. A mudança de apresentação do mês não autoriza alterar esse limite nem regenerar documentos antigos em massa. [Source: docs/stories/story-crm-ficha-viabilidade-automatica-20261023.md#acceptance-criteria, critérios 2, 6, 9–10]
- O pacote recente de salvamento isola rascunhos e chaves por instância de formulário; não substituir sua semântica ao integrar o select. [Source: docs/stories/story-correcoes-salvamento-sistema-20261026.md; src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx]

### Pontos de implementação conferidos

| Ponto | Contexto útil |
|---|---|
| `scripts/bpm-reuniao-agendada-config.mjs` | A definição existente associa `mes_protocolar`, “Mês para protocolar” e tipo `data`. Serve como evidência de compatibilidade; não executar o script nem alterar banco nesta story. |
| `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx` | Renderer compartilhado importado pelo editor de campos; primeiro ponto a conferir para aplicar o select sem duplicar controles por etapa. |
| `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` | Editor da etapa usa `CampoBpmInput`, `validarValoresCamposBpm`, rastreador de rascunho e `AtualizarCardBpm`. Conferir os metadados enviados e a comparação entre valor inicial/rascunho. |
| `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` | UI dos requisitos para movimentação; deve reconhecer o mesmo domínio quando o campo for exigido. |
| `src/lib/bpm/campos-dinamicos.ts` | `CampoDinamicoBpm` já tem `chave` opcional e `validarValoresCamposBpm` valida datas estritamente como `YYYY-MM-DD`; o tratamento do mês deve anteceder o ramo de data somente para o campo semanticamente correto. |
| `src/actions/bpm/Cards.ts` | Caminhos de gravação do card; conferir propagação da chave e validação server-side, sem criar bypass de permissões. |
| `src/lib/bpm/ficha-viabilidade-dados.ts` | `montarFichaAlphaDoCard` lê `alpha.radar.viabilidade.mes_protocolar` com fallback pelo nome “Mês para protocolar”; atualmente aplica `dataBr` em `extra.mesProtocolo`. Conferir projeção para mês. |
| `src/components/ModalPdf.tsx` | Campo manual `mesProtocolo` do modal compartilhado. Conferir somente se afetado pelo fluxo CRM; preservar a geração normal da Pré-Análise. |
| `src/lib/bpm/ficha-viabilidade-documento.ts` | Contrato dos complementos aceita `mesProtocolo` textual opcional. Não usar esse contrato para regravar implicitamente o campo do card. |

Não há API ou tabela nova requerida. O desenvolvedor deverá inventariar consumidores e preencher File List com os arquivos realmente alterados, sem assumir que todos os pontos candidatos precisam mudar.

### Decisões de preparação

- [AUTO-DECISION] Solicitar ano junto ao mês? → Não: o usuário pediu somente o mês; `type="month"` não atende ao pedido.
- [AUTO-DECISION] Converter datas históricas ou alterar o tipo configurado no banco? → Não: projetar mês na leitura e aceitar o novo domínio pelo contrato específico, sem backfill/configuração de banco.
- [AUTO-DECISION] Alterar todas as telas gerais de CheckList/Pré-Análise? → Não: pedido é CRM; apenas dependência compartilhada comprovadamente necessária pode ser ajustada, com regressão do modo padrão.
- [AUTO-DECISION] Representação canônica? → Nomes completos dos doze meses em português, conforme decisão de implementação informada pela coordenação; normalizar somente formatos reconhecidos, sem inventar dia ou ano. Compartilhar o seletor entre campo dinâmico e complemento da ficha.
- [AUTO-DECISION] Criar epic/ClickUp ou bloquear em elicitação? → Não: a missão define story corretiva local com nome e escopo específicos, em modo autônomo, sem sincronização externa autorizada.

## Testing

Usar Vitest e os padrões dos testes existentes em `tests/bpm/`. Ajustar testes por comportamento, não para espelhar a implementação.

1. Helper: chave exata, nomes legados normalizados, nomes parecidos recusados, doze meses e meses inválidos.
2. Legado: data ISO reconhecida projeta o mês; nome de mês reconhecido mantém significado; vazio permanece vazio; texto desconhecido não vira mês por aproximação. Não regravar na mera leitura.
3. Validação: novo mês válido aceito pelo servidor; inválido recusado; data completa de outro campo continua exigindo calendário válido; read-only/obrigatoriedade mantidos.
4. UI: seleção, salvamento/reabertura e renderização nos requisitos; salvar outro campo não altera o legado; navegação/rascunhos respeitam a instância atual.
5. Ficha, se afetada: mês do card no PDF sem dia/ano e sem sobrescrever complementos independentes.
6. Staging: conferir a etapa solicitada e ao menos outra ocorrência do mesmo campo no CRM; registrar commit/deployment e evidência autenticada. Evitar mutações em empresas reais; usar card fictício autorizado pelo fluxo normal do aplicativo.

Gates obrigatórios executados e aprovados localmente, conforme `qa-local-final.json` e parecer independente: `npm run lint` (0 erros/1.172 avisos), `npm run typecheck`, `npm test -- --maxWorkers=1` (cobertura ativa, execução completa única: 806 arquivos/6.738 testes aprovados, 4 skipped e 1 todo) e `NEXT_DIST_DIR=.next-mes-protocolar-validation npm run build`. Todos com exit 0. A verificação autenticada remota de teclado/visual e salvamento/reabertura permanece pendente após a publicação isolada.

## 🤖 CodeRabbit Integration

### Story Type Analysis

Primary Type: Frontend. Secondary Types: API/validação e integração de consumidores do campo. Complexity: Medium — renderer e validação compartilhados, formatos legados e possível consumo pela ficha.

### Specialized Agent Assignment

- @dev: implementação e revisão pré-commit.
- @ux-expert / @ux-design-expert: revisão do select, teclado, tema e somente leitura.
- @qa: revisão independente de contratos, testes e regressão.
- @github-devops / @devops: commit/push e publicação somente no staging após gates.
- @architect apenas se surgir decisão arquitetural fora do reconhecimento; Vault/Data Engineer somente se descoberta necessidade estrutural, não autorizada por esta story.

### Quality Gate Tasks

- [x] Pre-Commit (@dev/QA): CodeRabbit indisponível; revisão manual e independente concluída, com fallback conforme `coderabbit_integration.graceful_degradation`.
- Pre-PR (@github-devops): não aplicável nesta publicação isolada por CLI; nenhum PR foi criado.
- [ ] Pré-publicação staging (@devops): gates reais, SHA e escopo conferidos; nenhuma alteração de banco/configuração incluída.
- Pre-Deployment produção: não aplicável; produção não autorizada por este pedido.

### Self-Healing Configuration — Story 6.3.3

@dev em modo light: até duas iterações, timeout de 15 minutos, CRITICAL corrigido automaticamente, HIGH documentado, MEDIUM/LOW conforme política existente. QA em modo full: até três iterações/30 minutos para CRITICAL+HIGH; DevOps em modo check, somente relatório. Não alegar sucesso de ferramenta que não executou.

### Focus Areas

Identificação semântica estrita; preservação de dados antigos; mesmo contrato no cliente/servidor; datas não relacionadas intactas; ausência de mutação automática ao abrir/salvar outro campo; acessibilidade; rascunhos isolados e não regressão da ficha.

## Story Draft Checklist

Validação de preparação aplicada em 26/10/2026 com `.aiox-core/product/checklists/story-draft-checklist.md`.

| Categoria | Resultado | Evidência |
|---|---|---|
| Objetivo e contexto | PASS | Pedido exato, benefício, etapa e escopo definidos. |
| Orientação técnica | PASS | Renderer, validação, gravação e consumidores identificados; nenhum schema presumido. |
| Referências | PASS | Caminhos conferidos e fontes anteriores resumidas; ausências documentais explicitadas. |
| Autossuficiência | PASS | Domínio, legado, limites e decisões autônomas descritos. |
| Testes | PASS | Cenários de round-trip, servidor, legado, requisitos, rascunhos e PDF definidos. |
| CodeRabbit | PASS | Tipos, responsáveis, gates, self-healing e fallback preenchidos. |

Resultado: **READY**, clareza 9/10. Nenhum bloqueio para desenvolvimento; a representação canônica definida deve ser demonstrada por testes de round-trip, sem alterar o banco.

## Dev Agent Record

### Agent Model Used

Codex / Dex (`aiox-dev`), com preparação por River e validação independente por Quinn.

### Debug Log References

- `/var/tmp/alpha-mes-protocolar-targeted.log`: 4 arquivos, 46 testes aprovados.
- `/var/tmp/alpha-mes-protocolar-modal.log`: 2 arquivos, 8 testes aprovados.
- `/var/tmp/alpha-mes-protocolar-ficha.log`: 4 testes aprovados após ajuste de prioridade canônica.
- `/var/tmp/alpha-crm-mes-protocolar-20261026/qa/`: gates completos e diagnósticos de dependências locais.
- `/var/tmp/alpha-crm-mes-protocolar-20261026/release/`: comparação de remotos, ambiente e publicação.

### Completion Notes List

- Representação canônica: nome completo do mês em português. Nenhum ano/dia sentinela.
- Chaves Radar/global e aliases exatos compartilham select e validador, independentemente do tipo legado. Validação dos demais campos permanece intacta.
- Leitura normaliza somente para apresentação; não dispara `onChange` nem grava dados. Salvamento de campo independente mantém o legado. Valor desconhecido permanece visível, sem escolher um mês automaticamente.
- Ficha preserva prioridade da chave Radar com valor, depois global/alias; datas reconhecidas aparecem como mês. Complemento do CRM usa o select; geração padrão da Pré-Análise preservada.
- Nenhum schema, migration, seed, backfill ou script de configuração executado.
- `devLoadAlwaysFiles` e fallbacks ausentes, conforme preparação da story; padrões reais do projeto utilizados.
- Quatro gates globais exit 0 e revisão independente APPROVED/PASS. Teste completo único com cobertura: 806 arquivos/6.738 testes aprovados, 4 skipped e 1 todo. Fonte congelada em 3.134 arquivos; nenhuma alteração de fonte/teste após a validação. Evidência: `/var/tmp/alpha-crm-mes-protocolar-20261026/qa/qa-local-final.json`.
- Handoff local concluído: DevOps autorizado a commit local e deploy CLI somente no staging isolado. Deploy e aceite LIVE ainda pendentes; não houve push autorizado da branch concorrente nem publicação de produção.
- CodeRabbit ausente no PATH e em `~/.local/bin/coderabbit`: revisão manual e QA independente, sem alegar execução da ferramenta.
- Dependências locais estavam divergentes: Prisma isolado gerado a partir do schema deste checkout, pacote `extenso` 3.0.0 já declarado no lock recuperado de instalação existente e player gerado pelo script oficial. Nenhum manifesto/dependência versionada alterado.
- Publicação concorrente `508f6c4a` substituiu a branch staging, divergiu da base e falhou no provedor; não foi integrada nem sobrescrita. Usuário autorizou explicitamente **“Publicar a correção isolada no staging”** em 26/10/2026. Manter a versão estável `ca156313` como base desta correção, publicar isoladamente no ambiente/alias staging e preservar a branch concorrente para integração posterior. Produção permanece fora do escopo.

### File List

- `docs/stories/story-crm-mes-protocolar-select-20261026.md`
- `src/lib/bpm/mes-protocolar.ts`
- `src/components/bpm/MesProtocolarSelect.tsx`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/lib/bpm/campos-dinamicos.ts`
- `src/lib/bpm/ficha-viabilidade-dados.ts`
- `src/components/ModalPdf.tsx`
- `tests/bpm/mes-protocolar.test.ts`
- `tests/bpm/mes-protocolar-react.test.tsx`
- `tests/bpm/ficha-complementar-modal-react.test.tsx`
- `tests/bpm/ficha-viabilidade.test.ts`
- `docs/qa/gates/crm-mes-protocolar-select-20261026.yml`

Total: 12 caminhos — 6 arquivos de aplicação, 4 de testes, esta story e o gate de QA.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 26/10/2026 | 1.0 | Story corretiva local preparada, checklist aplicado e status Ready for Dev. | River / @sm |
| 26/10/2026 | 1.1 | Seletor compartilhado, validação semântica, leitura legada e complemento da ficha implementados; publicação isolada autorizada diante de divergência concorrente. | Dex / @dev |
| 26/10/2026 | 1.2 | Status Ready for Review LOCAL, gates e checklist locais conferidos, File List com 12 caminhos; deploy e aceite LIVE permanecem pendentes. QA Results preservado byte a byte. | River / @sm |

## QA Results

Pendente: avaliação de implementação por QA após os gates.


### Revisão independente — 26/10/2026 — Quinn

**APPROVED / PASS para publicação e aceite no staging.** Este parecer é local; não marca o deploy nem a homologação autenticada como concluídos.

- Revisão do diff, helpers, consumidores, projeção da ficha, contrato do editor e submissão apenas de campos alterados concluída. O achado sobre prioridade do campo canônico da ficha foi resolvido pelo desenvolvedor com regressão. Nenhum achado funcional aberto no cenário ativo.
- `npm run lint`: **PASS**, 0 erros/1.172 avisos, 87,62s na execução final.
- `npm run typecheck`: **PASS**, 17,06s, com client Prisma isolado correto e artefatos/dependência declarada preparados.
- `npm test -- --maxWorkers=1`: **PASS**, cobertura ativa, execução completa única exit0, **806 arquivos/6.738 testes aprovados**, 4 skipped e1todo;346,75s. Não foi feita composição de execuções para declarar sucesso.
- `NEXT_DIST_DIR=.next-mes-protocolar-validation npm run build`: **PASS**, execução literal do script do projeto,106,95s. Aviso não impeditivo de preloader pdfjs-dist registrado no log; não houve alteração desse módulo.
- Guard de **3.134 arquivos** de fonte/testes/configuração inalterado ao final. Os dois includes automáticos do build em tsconfig foram removidos pela restauração byte a byte; next-env gerado foi retirado para restaurar a ausência original. Nenhum código/teste foi alterado pelo QA.
- Infraestrutura de teste: client compartilhado antigo, ausência de extenso3.0.0 e bundle do player foram corrigidos localmente sem editar manifests nem schema. Auth.js usou segredo fictício exclusivoQA. Tentativas full4 com timeouts de fixtures foram mantidas nos logs; full1 resolveu sem mudar assertion, timeout ou fonte. Nenhuma credencial de banco remoto foi carregada nos gates.
- CodeRabbit não instalado em PATH nem ~/.local/bin; revisão manual utilizada conforme graceful_degradation do projeto, sem alegar execução da ferramenta.
- Metadata somente leitura fornecida pela coordenação e inspecionada: **2 campos ativos CARD, fonte nula,19 vínculos de etapa e formulário,0escritas**. A etapa alvo está vazia. A leitura não contém comparação direta com URL runtime; o aceite autenticado pós-deploy deve complementar essa evidência. Não se declara correção do loader genérico de campos GLOBAL, fora da configuração ativa desta entrega.
- Segurança/confiabilidade: domínio de12meses só no campo semântico, datas comuns e readonly preservados, sem efeito de escrita no render; complemento CRM preserva datas antigas quando outro extra é editado e modo padrão Pré-Análise continua intacto.

**Aceite remoto pendente:** DevOps publicar apenas no staging e conferir SHA/deployment/alias; coordenador validar seleção, salvamento e reabertura em card sintético existente do Operacional e segunda ocorrência. Não afirmar teste visual na etapa alvo vazia. Erros de rede Chrome anteriores ao release devem permanecer diferenciados de erros de aplicação. Não há autorização de produção.

Gate: `docs/qa/gates/crm-mes-protocolar-select-20261026.yml`. Evidências privadas: `/var/tmp/alpha-crm-mes-protocolar-20261026/qa/qa-local-final.json`, logs dos quatro gates e `source-final-guard.json`; metadata em `release/month-fields-readonly.json`.
