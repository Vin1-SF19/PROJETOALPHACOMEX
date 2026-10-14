# Story: Migração dos alertas de prazo RD para o SLA do Alpha

## Status

Implementado e validado em preparação de release — carga em produção aguarda confirmação específica do plano final.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools:
  - equivalência temporal, entrada original e reentrada na etapa
  - testes do motor de SLA e ausência de efeitos indevidos
  - reconciliação idempotente da carga
```

## História

**Como** usuário do Alpha CRM,
**quero** que os alertas de prazo configurados no RD sejam representados corretamente no Alpha,
**para que** o acompanhamento preserve as regras de origem para todos os cards das etapas escolhidas, preservando a entrada original e sem interromper automações.

## Contexto e escopo preliminar

O usuário pediu migrar os SLAs RD. O inventário preliminar encontrou 17 valores `deal_stopped` em 61 etapas RD, correspondendo a dez etapas Alpha: nove com valor de um dia e “Aguardando despacho” com 12 dias. O usuário confirmou expressamente aplicar as dez regras por etapa a todos os cards, inclusive novos; a prévia deve validar os dez destinos e os prazos antes da carga.

A fonte privada é `database-backups/pre-change/rd-activities-recovery/sla-cadence-inspection.json`, mantida fora do Git. O fluxo principal informou que `BpmSlaConfig` está vazio; confirmar novamente no diagnóstico e antes da carga, sem sobrescrever configurações criadas posteriormente. Existe motor de SLA documentado em `docs/stories/story-rm-2026-095b40-gestao-prazos-sla-alertas.md`.

A migração reuniu etapas de origens distintas em etapas Alpha comuns. A decisão explícita do usuário é aplicar o SLA a todos os cards dessas etapas, independentemente da origem, incluindo cards nativos e novos. A etapa “Cliente cancelado” possui alerta no RD e exige análise explícita: não excluir a regra por interpretação do nome, nem ativar efeitos sobre cards encerrados sem compreender a política do motor.

## Decisões confirmadas e execução planejada

- Usuário confirmou **“Todos os cards dessas etapas”**: dez configurações formais por etapa, abrangendo todas as origens e cards novos, sem filtro de proveniência RD.
- Usuário confirmou **“Preservar a data de entrada original”** e aceita os atrasos resultantes. O backfill usa movimentação Alpha ou histórico RD validado da entrada na etapa atual; não reinicia o relógio na data da migração.
- Backfill somente de cards atualmente ativos em etapas elegíveis. Não criar instâncias para cards encerrados, arquivados ou em estado terminal. Ausência/ambiguidade de data verificável é exceção, sem data inventada.
- Calcular o estado inicial conforme a data histórica, inclusive vencido quando aplicável, para evitar emissão retroativa do evento `SLA_VENCIDO` pelo provisionamento. Preservar o funcionamento futuro do motor.
- Todas as regras importadas têm `suspendeAutomacaoAoVencer: false` explícito.
- A auditoria arquitetural encontrou que uma instância concluída não reinicia na reentrada. O arquiteto prepara correção mínima com testes; o fluxo principal prepara o CLI e o plano de carga. Não marcar esses ajustes como concluídos antes da validação.
- A confirmação funcional não substitui o gate final de escrita: apresentar plano exato ao Vault e ao usuário após preparação.

## Critérios de aceite

1. Auditar somente em leitura as 61 etapas e as 17 regras observadas, confirmando valores, semântica, fonte e mapeamento explícito da migração. Registrar regras ausentes, conflitos e lacunas sem tratá-los como prazo zero ou um dia padrão.
2. Produzir matriz regra RD → pipeline/etapa Alpha → prazo/início/política no Alpha, consolidando dez configurações aplicáveis a todos os cards dessas etapas. Validar a correspondência preliminar de nove destinos de um dia e “Aguardando despacho” de 12 dias; divergências ficam explicadas antes de qualquer carga.
3. Demonstrar equivalência do relógio: se RD for inatividade, não implementar como permanência em etapa; se for tempo na etapa, não reiniciar por simples edição/interação. Caso o motor não suporte a semântica necessária, preparar ajuste explícito e testes ou manter a regra como exceção, sem equivalência fictícia.
4. Cada SLA importado aplica-se a todos os cards da etapa Alpha configurada, inclusive novos, nativos e origens RD sem regra anterior, conforme autorização funcional expressa. Não introduzir filtro de origem. Para o backfill, limitar aos cards atuais ativos e obter entrada original em movimentação Alpha ou histórico RD validado; ausência de data ou conflito vira exceção, nunca início fabricado.
5. Reutilizar `BpmSlaConfig` e o motor existentes quando suportarem o contrato. Confirmar `condicaoRegraJson`, início, unidade e prioridade antes de gravar. Não sobrescrever configurações concorrentes nem escolher uma prioridade que elimine regras humanas sem justificativa no plano.
6. Gravar explicitamente `suspendeAutomacaoAoVencer: false` nas regras importadas. O schema atual tem default `true`; não depender de omissão do campo. A migração de alertas não autoriza suspender automações ou criar bloqueios de passagem de etapa.
7. Tratar “Cliente cancelado” explicitamente na prévia, preservando a regra de etapa originada no RD. Não instanciar SLA no backfill para cards encerrados, arquivados ou em estado terminal; não reabrir cards nem alterar status. Explicar a diferença entre existência da configuração e elegibilidade de instância no estado atual.
8. A prévia identifica regras/configurações a criar ou reutilizar, cards elegíveis por etapa e estado, entrada original comprovada, instâncias previstas e prazos já vencidos. Calcular o estado inicial histórico para evitar eventos `SLA_VENCIDO` retroativos de provisionamento; atrasos continuam visíveis, conforme escolha do usuário. Não disparar mensagens, tarefas, notificações em massa ou automações como efeito não declarado da carga.
9. Preparar plano fechado com identidade do banco, fingerprint, estado esperado, operações, contagens e rollback. Aplicação idempotente e retomável não duplica configurações, instâncias ou disparos; conflitos com mudanças humanas suspendem o item preservando o estado atual.
10. Antes de escrita em massa ou alteração estrutural, obter relatório Vault, apresentar ambiente/banco, comandos, impacto, riscos, alternativa sem escrita e rollback, verificar backup completo de até 48 horas e solicitar confirmação específica para o plano exato. A autorização de migrações anteriores não cobre esta carga.
11. Após aplicação autorizada, reconciliar regras, destinos, exceções, instâncias e disparos com a prévia, incluindo abrangência das dez etapas para todas as origens, exclusão de cards terminais do backfill, datas originais preservadas e ausência de suspensão de automação ou disparos retroativos. Rollback fica restrito aos registros do lote sem apagar edições posteriores.
12. A interface mostra prazo e estado em português legível, com acentos corretos e sem JSON/IDs de origem. Leitura e configuração preservam permissões existentes; a adição de SLA não concede acesso ao card.
13. Testes cobrem equivalência temporal, dias corridos quando confirmados, limite exato do vencimento, movimentos/reentrada, alteração sem reinício indevido, origens mescladas sob a mesma regra, cards novos, data histórica ausente, cancelados/arquivados, concorrência, retomada e efeitos dos jobs. A reentrada na etapa reinicia corretamente uma instância anteriormente concluída com a nova entrada, sem duplicar instâncias nem alterar o relógio de quem não saiu da etapa. Registrar gates e limitações de validação autenticada.

## Integrações verificadas e investigação

- `prisma/schema.prisma`: `BpmSlaConfig` já possui condição, pausa/retomada, início, prioridade e `suspendeAutomacaoAoVencer` com default `true`.
- `src/lib/bpm/sla.ts` e `src/actions/bpm/Sla.ts`: motor e consumo a auditar.
- Jobs SLA/automação e notificações: identificar caminhos efetivos antes da carga, incluindo comportamento sobre instâncias retroativas.
- `scripts/migrar-rd-alpha.mjs` e `docs/stories/story-alpha-crm-migracao-historico-rd-station-v1.md`: correspondência de etapas e proveniência.
- `docs/stories/story-rm-2026-095b40-gestao-prazos-sla-alertas.md`: arquitetura existente de prazos, alertas e instâncias.
- `AGENTS.md`: política Vault, backups e gates.

Os caminhos são referências de integração, não arquivos já modificados. Esta story não determina nova migration. Mudanças concorrentes em Builder/ChatbotX e cargas de playbooks/tarefas são escopos separados.

## Checklist

- [x] Registrar pedido, inventário preliminar e riscos específicos.
- [x] Validar API/snapshot, semântica de `deal_stopped` e unidade de tempo somente em leitura.
- [x] Registrar decisão explícita de todos os cards das etapas e preservação da entrada original.
- [x] Confirmar mapa 17 regras RD → dez destinos e aplicar regra global por etapa.
- [x] Auditar motor, condição, início, jobs e tratamento de Cliente cancelado.
- [x] Preparar prévia de dez configurações e backfill ativo com datas verificadas, estados iniciais calculados e exceções.
- [x] Corrigir reentrada de SLA concluído e validar testes de reinício/idempotência.
- [x] Implementar transformação idempotente e eventuais ajustes necessários, sem carga produtiva.
- [x] Validar explicitamente ausência de suspensão de automações e de alertas fora do plano.
- [x] Executar testes/gates e revisão arquitetural.
- [ ] Obter Vault, backup verificado e confirmação específica do plano.
- [ ] Aplicar e reconciliar somente operações autorizadas.
- [ ] Registrar resultados, limitações, rollback e file list final.

## CodeRabbit Integration

**Tipo:** integração, regras temporais e escrita em massa.

- @dev: testes do relógio, abrangência por etapa, entrada original, reentrada e idempotência e efeitos colaterais.
- @architect/@qa: equivalência semântica e revisão dos caminhos do motor/jobs.
- Vault: plano de carga e mudanças estruturais, se necessárias.
- @devops: publicação de alterações de aplicativo pelo fluxo próprio, sem arquivos concorrentes.
- Registrar revisão manual quando CodeRabbit não estiver disponível; não alegar execução automatizada inexistente.

## Gates e evidências

Executar `npm run lint`, `npm run typecheck`, `npm test`, testes direcionados e build quando houver alteração de aplicação. Separar regressões de falhas concorrentes/preexistentes. Não há execução ou medição feita nesta preparação documental.

## Dev Agent Record

Somente criação da story; nenhuma escrita de banco, coleta da API ou leitura de conteúdo privado do snapshot realizada por @sm.

### File List

- `docs/stories/story-alpha-crm-sla-rd-por-etapa.md` (novo).

## Change Log

| Data | Versão | Alteração | Autor |
|---|---|---|---|
| 2026-10-14 | 1.0 | Preparação da migração SLA RD com validação semântica, escopo por origem e gate de carga | @sm |
| 2026-10-14 | 1.1 | Decisão explícita: todos os cards das dez etapas, incluindo novos; entrada original preservada; backfill ativo sem eventos retroativos e correção de reentrada | @sm |

## Prévia e evidências técnicas

Decisões do usuário preservadas: todos os cards das dez etapas, incluindo novos; data de entrada original nos existentes. Importação configura nove etapas com um dia corrido e Aguardando despacho com 12 dias corridos. Comparação adicional dos dados RD encontrou quatro negociações com vencimento explícito: três compatíveis com entrada + um dia e uma com entrada + 12 dias, com diferenças inferiores a um segundo. O início não deriva de `updatedAt` ou da data de migração.

Prévia privada `database-backups/pre-change/rd-sla/plan.json`: 17 origens, dez configurações, dois pipelines, 41 instâncias (39 atrasadas e duas dentro do prazo), um card terminal excluído e zero exceções. Trinta e nove inícios vêm de histórico RD e dois de movimentos Alpha. Movimentos canônicos e as três ações históricas reconhecidas têm precedência sobre a origem RD. Alterações posteriores de estado/versão bloqueiam a carga.

Todas as configurações usam dias corridos, início na entrada da etapa e suspensão de automação desabilitada. Instâncias antigas recebem status já calculado; o provisionamento não executa hooks de disparo retroativo. Futuras mudanças de estado seguem o motor existente. Não são criados novos limiares de atenção sem equivalente RD.

IDs de configuração e instância são determinísticos e compatíveis com o CRUD. A validação de etapa reutiliza o schema canônico para aceitar IDs publicados pelo editor de pipelines. A correção do motor cria novo ciclo na reentrada após encerramento e está sendo complementada para as criações de cards na etapa inicial.

QA focal: 32 testes aprovados, incluindo SQLite com schema real e backup restaurável; lint sem erros. Cobertura: data inválida/futura/ambígua, prioridades de origem, dias corridos, edição administrativa, atomicidade, confirmação, backup, conflitos, idempotência e rollback. Rollback desativa as configurações e encerra as instâncias do lote, preservando logs e auditorias; uso ou edição posterior impede reversão automática.

Backup Vault: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-14T14-49-44-600Z.sql`, 14/10/2026 às 14:49 UTC, 336 tabelas, 266.318 registros, 329.302.667 bytes; SHA-256 `eee1977d84a84e4f36916765db50486795d65f006e6903469215f092cbeabb9a`. Identidade, integridade, restauração, FKs e contagens aprovadas. Simulação real passou por aplicação, verificação, repetição e reversão, com registros preservados. A ampliação posterior dos guards de histórico também foi coberta pelos testes SQLite.

Nenhuma escrita de produção realizada. Publicação do runtime, gates globais e confirmação específica da carga continuam pendentes. CodeRabbit indisponível; revisão manual realizada por arquitetura, QA e Vault.

## Plano final e decisões posteriores

O usuário escolheu explicitamente **importar desativada** a regra de Cliente cancelado. Resultado: dez configurações, nove ativas e uma desativada; 41 instâncias continuam elegíveis, com 39 atrasadas e duas dentro do prazo. Um card em etapa terminal fica fora da contagem. Demais regras aplicam-se a todos os cards elegíveis das etapas, incluindo novos.

Fingerprint final: `0bb9a8a78bc728f1348826cf1abd64e5c3cc63aba1655dd3caa73bd5f3654299`. O plano privado inclui dez configurações, 41 instâncias, respectivos logs, duas versões de pipeline e **um índice de unicidade de ciclos de card**. A restrição anterior impedia qualquer segundo ciclo; a nova mantém uma única instância aberta e preserva os ciclos encerrados. O índice de tarefas permanece intacto. DDL e carga executam na mesma transação; a definição do índice anterior é protegida por guard.

Reversão protegida: desativa as configurações, encerra as instâncias do lote, registra logs compensatórios no horário real e restaura o índice anterior. Bloqueia antes de escrever se houver edição, novos ciclos, novos logs ou qualquer duplicidade histórica que impeça restaurar a unicidade original. Não apaga histórico para forçar a reversão.

Os cinco caminhos de criação de cards iniciam o SLA da etapa inicial na mesma transação usando a data real de criação: manual, NoLoss, fechamento comercial, automação central e distribuição de oportunidades. Reentrada cria novo ciclo somente para cards; os outros gatilhos preservam a semântica anterior. Validação administrativa aceita os IDs de etapa publicados pelo editor canônico.

QA final comprovou o motor com PrismaLibSQL e DDL reais: saída/retorno preserva o primeiro ciclo e cria o segundo, impede dois ciclos abertos e mantém disparos independentes. Conjunto focal: 50 testes em cinco arquivos; após a escolha de Cliente cancelado, oito testes CLI passaram novamente. A suíte isolada final passou com 623 arquivos e 4.630 testes, quatro ignorados e um todo. Build passou; lint completo com zero erros e 1.193 avisos preexistentes. Typecheck final aprovado após ajuste de tipagem no CLI, exit 0. Evidências: `/tmp/rd-sla-release-final-build.log`, `/tmp/rd-sla-release-final-lint.log`, `/tmp/rd-sla-release-final-tests.log`, `/tmp/rd-sla-release-cancelado-tests.log` e `/tmp/rd-sla-release-typecheck-final2.log`. QA final PASS.

A release parte do commit remoto em produção e contém somente arquivos SLA; alterações locais concorrentes de ChatbotX, Dashboard e metadados AIOX ficam fora. Nenhuma escrita remota de banco foi realizada durante preparação.

### File list final

- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/NolossLeads.ts`
- `src/lib/bpm/automacoes.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/automacoes/distribuicao-oportunidades.ts`
- `src/lib/bpm/sla.ts`
- `src/lib/validations/bpm-sla.ts`
- `scripts/importar-sla-rd-alpha.mts`
- `scripts/lib/rd-sla-import.ts`
- `prisma/migrations/20261014151000_sla_ciclos_etapa_abertos/migration.sql`
- `prisma/migrations/20261014151000_sla_ciclos_etapa_abertos/rollback.sql`
- `tests/bpm/criar-card-nova-empresa.test.ts`
- `tests/bpm/promover-noloss-lead.test.ts`
- `tests/bpm/rd-sla-cli.test.ts`
- `tests/bpm/rd-sla-import.test.ts`
- `tests/bpm/sla-reentrada.test.ts`
- `tests/bpm/sla-ciclos-migration.test.ts`
- `tests/bpm/sla-reentrada-sqlite.test.ts`
- `docs/stories/story-alpha-crm-sla-rd-por-etapa.md`

## Validação integrada à versão remota

Durante a publicação, outra tarefa avançou `origin/main` para `5e5ae132`. A release SLA incorporou esse commit por merge normal (`55da9862`), preservando as mudanças já publicadas. O diff contra esse novo remoto continua restrito aos 19 arquivos SLA; nenhum arquivo do Builder ou Dashboard foi alterado pela correção SLA.

Build e lint integrados aprovados (zero erros, 1.193 avisos). Typecheck confirmado com exit 0 em `/tmp/rd-sla-merged-typecheck-confirmed.log`; a execução anterior foi interrompida por SIGTERM sem diagnóstico TypeScript. Suíte integrada: 624 arquivos e 4.644 testes aprovados, quatro ignorados, um todo e três falhas no Builder. As mesmas três falhas foram reproduzidas no checkout remoto `5e5ae132`, sem o patch SLA, em `/tmp/rd-sla-origin-builder-test.log`. QA aprovou o escopo SLA com essa limitação preexistente, sem declarar a suíte global integralmente verde. Logs adicionais: `/tmp/rd-sla-merged-build.log`, `/tmp/rd-sla-merged-lint.log` e `/tmp/rd-sla-merged-tests.log`.

Esta publicação entrega o runtime; não executa migration nem importação produtiva. A carga permanece sujeita à confirmação específica do usuário e execução pelo fluxo principal.
