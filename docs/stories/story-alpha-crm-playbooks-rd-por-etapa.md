# Story: Playbooks do RD nas etapas corretas do Alpha CRM

## Status

Implementado e validado — aguardando confirmação específica do usuário para a carga em produção.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools:
  - reconciliação de origem e destino por etapa
  - preservação de conteúdo e importação idempotente
  - testes de apresentação e autorização
```

## História

**Como** usuário do Alpha CRM,
**quero** consultar os 14 playbooks do RD nas etapas Alpha correspondentes,
**para que** as orientações de atendimento estejam disponíveis no fluxo correto sem perder o conteúdo já existente.

## Origem, contexto e escopo

Pedido direto do usuário para trazer 14 playbooks/guias RD, distribuídos por seis funis de origem, para as etapas corretas no Alpha. O inventário preliminar está no snapshot privado e ignorado `database-backups/pre-change/rd-activities-recovery/procedures-inspection.json`; a preparação deve verificá-lo e reconciliá-lo com leitura da origem e do destino. Este caminho é referência de evidência local, não autorização para versionar seu conteúdo.

Reutilizar o mapeamento explícito de funis/etapas já aprovado na migração, documentado em `docs/stories/story-alpha-crm-migracao-historico-rd-station-v1.md` e implementado nos artefatos de migração. Não inferir destino por nome parecido e não pedir ao usuário para reconstruir mapeamentos já verificáveis. Os seis funis deste inventário não devem ser confundidos com a totalidade de funis/leads migrados.

O modelo existente possui `BpmEtapa.script`; a story `story-rm-2026-6a27b0-gerenciador-scripts.md` documenta o editor administrativo por pipeline/etapa e a apresentação somente leitura na aba Scripts do card. Confirmar o contrato real de serialização e renderização antes de selecionar a estratégia de importação. A orientação deve permanecer orientação: não converter texto instrucional em checklist obrigatório, tarefa, bloqueio de etapa ou automação sem pedido explícito.

## Critérios de aceite

1. Auditar somente em leitura os 14 guias, seus seis funis e suas etapas RD, registrando identificadores estáveis, conteúdo disponível e resultados de coleta. Validar completude/paginação e distinguir guia ausente, vazio, inacessível e erro de API; não afirmar carga completa a partir apenas da contagem do snapshot.
2. Produzir mapeamento explícito guia RD → funil/etapa RD → pipeline/etapa Alpha usando a correspondência da migração. Confirmar que cada etapa destino pertence ao pipeline correto. Destinos ausentes/ambíguos entram em exceção sem gravação até resolução verificável.
3. Comparar previamente o conteúdo Alpha existente com cada guia. Preservar textos atuais, formatação suportada e edições humanas. Não substituir silenciosamente conteúdo existente. Quando vários guias convergirem para a mesma etapa, apresentar composição determinística, com seções legíveis e origem identificável, ou conflito explícito; nunca aplicar “último vence”.
4. Utilizar a superfície de orientações/scripts existente quando o modelo suportar o conteúdo. Preservar títulos, parágrafos, listas, links seguros e acentuação; sanitizar formatos não confiáveis conforme o contrato existente sem executar HTML ou scripts externos. O usuário não vê JSON, IDs técnicos ou marcadores internos de importação.
5. O guia aparece somente nas etapas mapeadas, acessível pela aba de orientação/script do card correspondente. A edição administrativa segue as permissões existentes e a leitura respeita acesso ao pipeline, coluna e card. Não introduzir permissões adicionais ou cópias por card desnecessárias.
6. Nenhuma instrução é convertida automaticamente em procedimento obrigatório, tarefa, condição de transição, notificação ou automação. Os checklists e orientações nativas já existentes permanecem intactos.
7. Preparar prévia fechada contendo origem, destino, estado/hash anterior, transformação proposta, operações de composição, contagens, exceções e identidade do banco. Permitir revisão do resultado final por etapa antes da confirmação específica, sem expor conteúdo privado em Git/logs públicos.
8. A carga é idempotente e retomável: repetir o plano não duplica seções ou guias. Estado divergente em relação à prévia bloqueia/segrega o item e preserva a edição humana. Registrar proveniência/auditoria de forma compatível com as estruturas existentes; não assumir estrutura nova sem verificar necessidade.
9. Antes de qualquer escrita em massa, mesmo usando somente `BpmEtapa.script`, acionar Vault, apresentar banco/ambiente, comandos, impacto, riscos, alternativa sem gravação e rollback restrito. Exigir backup completo verificado com até 48 horas e confirmação explícita do usuário para o plano exato. A autorização de migrações anteriores não cobre esta carga.
10. Após carga autorizada, reconciliar os 14 guias em aplicados, já presentes, exceções e falhas, além da quantidade de etapas afetadas; múltiplos guias podem ter um destino comum. Verificar preservação de conteúdo anterior, idempotência, apresentação e auditoria. Reversão restaura somente os valores do lote ainda compatíveis com seu estado aplicado, sem apagar edições posteriores.
11. Executar testes de mapeamento, composição, serialização, acentos, duplicação, retomada, conflitos, autorização e renderização. Registrar resultados dos gates e limites da verificação visual autenticada; não declarar publicação/carga que não tenha evidência.

## Checklist

- [x] Registrar pedido, limites e integração existente.
- [x] Validar inventário privado dos 14 guias/seis funis e auditar origem/destino somente em leitura.
- [x] Recuperar mapeamento explícito da migração e classificar exceções.
- [x] Verificar serialização/editor/renderer de `BpmEtapa.script` e conteúdo atual por destino.
- [x] Preparar resultado composto por etapa, sem substituir conteúdo nem criar obrigações.
- [x] Implementar prévia idempotente, guards, auditoria e rollback restrito.
- [x] Validar testes e gates técnicos pertinentes.
- [ ] Obter relatório Vault, backup completo verificado e consentimento específico para o plano.
- [ ] Aplicar exclusivamente o plano autorizado e reconciliar guias/etapas.
- [ ] Verificar apresentação e registrar evidências, limitações e file list final.

## Integrações e fontes

- `prisma/schema.prisma`: `BpmEtapa.script` existente; não há mudança estrutural determinada por esta story.
- `src/actions/bpm/Conhecimento.ts`: configuração de scripts existente.
- `src/app/PainelAlpha/AlphaCRM/CardModal/ConteudoScriptEtapa.tsx` e `PainelRegistrar.tsx`: apresentação do script da etapa atual.
- `scripts/migrar-rd-alpha.mjs`: correspondência de origem/destino a recuperar e validar.
- `docs/stories/story-rm-2026-6a27b0-gerenciador-scripts.md`: preservação de texto legado, editor e autorização.
- `docs/stories/story-alpha-crm-migracao-historico-rd-station-v1.md`: escopo e mapeamento explícito de migração.
- `AGENTS.md`: backup, Vault e gates.

Os caminhos indicam pontos de integração; não representam alterações já realizadas. Mudanças concorrentes em Builder/ChatbotX, tarefas/notas RD e seleção de responsáveis não pertencem a este pedido de playbooks.

## Estratégia de testes e qualidade

- Correspondência exata, origem sem destino e destino fora do pipeline; múltiplos guias para uma etapa.
- Conteúdo vazio, texto simples legado, conteúdo estruturado existente, listas/links seguros e acentos corrompidos.
- Composição preserva conteúdo nativo e não duplica em nova execução; alteração humana após prévia ou após aplicação impede sobrescrita/rollback inseguro.
- Nenhuma criação de checklist/tarefa/automação; leitura/edição continuam nos limites existentes.
- CLI em base descartável: confirmação, backup, identidade do banco, execução interrompida, retomada e reconciliação.
- `npm run lint`, `npm run typecheck`, `npm test`, testes direcionados e build quando houver alterações de aplicação. Separar falhas preexistentes/concorrentes de regressões.

## CodeRabbit Integration

**Tipo:** integração, conteúdo de orientação e escrita em massa controlada.

- @dev: revisão de idempotência, composição, serialização segura e ausência de segredos versionados.
- @architect/@qa: revisão do mapeamento, preservação e autorização.
- Vault: gate obrigatório para a carga mesmo sem migration de schema.
- @devops: publicação apenas se houver alteração de aplicativo, preservando arquivos concorrentes.
- Registrar indisponibilidade do CodeRabbit CLI quando aplicável; não alegar revisão automatizada não realizada.

## Dev Agent Record

Preparação documental somente; não houve leitura do conteúdo privado do snapshot, coleta na API, escrita de banco ou implementação nesta etapa de @sm.

### File List

- `docs/stories/story-alpha-crm-playbooks-rd-por-etapa.md` (novo).

## Change Log

| Data | Versão | Alteração | Autor |
|---|---|---|---|
| 2026-10-14 | 1.0 | Story dos 14 playbooks preparada com mapeamento explícito, preservação e gate de carga | @sm |

## Diagnóstico e correspondência validados

Leitura independente da API em 14/10/2026 confirmou os dez funis e 61 etapas do inventário: 14 etapas possuem objetivo ou descrição, em seis funis. Objetivos e descrições continuam idênticos ao snapshot original. Evidências privadas: `procedures-inspection-fresh.json` e `procedures-inspection-verification.json`, junto ao snapshot original. Consulta Alpha encontrou os 32 scripts de etapas ativas vazios; a prévia ainda deve capturar e proteger o estado exato no momento da carga.

| Funil RD / etapa | Pipeline Alpha / etapa |
|---|---|
| Comercial / Contratos à enviar | Revisão de Radar / Fechado |
| Vitor e Maria / Envio do checklist e boas vindas | Operacional / Boas vindas |
| Maria / Contratados stand-by | Operacional / Boas vindas |
| Vitor e Maria / Documentação em análise | Operacional / Documentação em análise |
| Financeiro Entrada / Elaborar contrato | Financeiro / Elaboração de Contrato |
| Financeiro Entrada / Pagamento confirmado | Financeiro / Confirmação de Pagamento |
| Financeiro Entrada / Enviar NF - Contratação | Financeiro / Emissão de Nota Fiscal |
| Financeiro Êxito / Enviar NF - êxito | Financeiro / Emissão de Nota Fiscal |
| Financeiro Êxito / Pgto confirmado | Financeiro / Concluido |
| Protocolo / Processos para revisão | Operacional / Revisão |
| Protocolo / Revisão do protocolo feito | Operacional / Revisão do protocolo |
| Protocolo / Aguardando despacho | Operacional / Aguardando despacho |

Os nomes abreviados acima servem à documentação; a implementação usa identificadores explícitos. O de/para de Contratos à enviar para Fechado mantém a migração anterior, mas o conteúdo deve identificar a etapa de origem para não generalizar instruções pré-contrato. Boas-vindas iguais são deduplicadas, preservando ambas as origens. Contratação e êxito permanecem em seções distintas.

A página do pipeline usa `force-dynamic` e carrega a configuração do banco. A aba Scripts utiliza `ConteudoScriptEtapa` e o formato TipTap existente; após a futura carga, atualizar a página deve buscar o conteúdo. Não houve verificação visual autenticada de produção nem carga nesta etapa.

## Preparação técnica

Prévia privada fechada em `database-backups/pre-change/rd-playbooks/plan.json`, fingerprint `ae00c7bd2e4613b956aaf705e88fdbe88c56e42102b7e603a01e85b93172949f`. Dez scripts inicialmente nulos, três versões de pipeline incrementadas (Revisão de Radar 27→28, Operacional 15→16, Financeiro 21→22), uma auditoria de importação com proveniência. A maior composição tem 1.374 caracteres, abaixo do limite de 8.000.

CLI: `node --import tsx scripts/importar-playbooks-rd-alpha.mts <preview|apply|verify|rollback>`. Aplicação requer `--plan`, `--confirm` igual ao fingerprint e `--backup` apontando ao SQL verificado. Rollback requer `--confirm=rollback:<fingerprint>`. Não aplicar comandos de escrita sem aprovação específica do usuário após o relatório Vault.

- Lint completo: zero erros, 1.193 avisos preexistentes.
- Typecheck em checkout isolado: PASS.
- Suíte completa em checkout isolado: 619 arquivos, 4.590 testes aprovados, quatro ignorados e um todo; inclui os dez novos testes de composição.
- Testes existentes do editor, ações e apresentação: 17 aprovados.
- QA transacional: 16 testes aprovados (dez composição e seis CLI/SQLite). Revisão Vault favorável; aguardando consentimento específico para escrita.
- Nenhuma mudança no aplicativo ou schema; não exige publicação Vercel para apresentar os scripts após a carga.
- CodeRabbit indisponível; revisão manual por arquitetura/QA/Vault.

### Arquivos da implementação

- `scripts/importar-playbooks-rd-alpha.mts`
- `scripts/lib/rd-playbooks.ts`
- `tests/bpm/rd-playbooks-import.test.ts`

## Backup, simulação e plano para aprovação

Backup completo de 14/10/2026 às 14:31 UTC: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-14T14-31-31-102Z.sql`, 336 tabelas, 266.172 registros e 328.619.149 bytes. SHA-256: `06c4f28c58a86497a6e27822ce1ab80c52b5def9930016e289ab5cbc2216bc2d`. Vault verificou identidade, restauração, integridade, chaves estrangeiras e contagens.

Simulação em cópia privada restaurada: prévia local → aplicação dos dez scripts/três versões → verificação 13/13 sem divergências → repetição sem duplicação → rollback. Conferência independente confirmou os dez scripts restaurados, versões monotônicas e dois registros de auditoria preservados. A prévia de produção permaneceu intacta.

Plano em produção: aplicar o fingerprint acima no Turso, verificar os 13 estados esperados e consultar os roteiros pela aba Scripts da etapa. Transação única evita carga parcial; mudança concorrente aborta o lote. Em falha de conexão, verificar antes de retomar. Risco de perda baixo, sem indisponibilidade programada; rollback restrito somente se não houver edição posterior. Alternativa sem escrita é manter a prévia para consulta. Nenhuma escrita remota efetuada; aprovação de cargas anteriores não cobre esta importação.
