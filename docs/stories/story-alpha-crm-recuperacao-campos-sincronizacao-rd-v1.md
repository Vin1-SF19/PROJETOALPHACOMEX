# Story: Recuperar campos e sincronizar novos leads do RD Station CRM V1

## Status

Ready for Review — carga autorizada aplicada em produção e reconciliada: 1.170/1.170 grupos, nove negócios novos, zero divergências e FK inválida. Aprovação operacional independente @qa; QA global conserva ressalvas por falhas preexistentes da suíte e inspeção autenticada no navegador não realizada.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build", "simulacao-backup", "reconciliacao", "Vault"]
```

## História

Como usuário do Alpha CRM, quero preencher corretamente os dados recuperáveis dos leads importados em todas as etapas e funis e trazer os novos negócios do RD Station, para consultar os formulários completos com os dados disponíveis na origem e manter o painel atualizado.

## Contexto, origem e dependências

O pedido explícito de 16/10/2026 amplia a recuperação para todos os leads, etapas e funis e inclui os novos negócios. A story anterior `story-alpha-crm-migracao-historico-rd-station-v1.md`, seções **Contexto e escopo**, **Regras de identidade e elegibilidade** e **Auditoria de campos e formulários — 16/10/2026 (somente leitura)**, registra a migração e a auditoria das lacunas. Esta story é sua continuação para campos e atualização pontual; não requer uma sincronização recorrente, nova interface ou mudança de esquema.

Na definição posterior de escopo, o usuário incluiu somente o funil adicional **REVISÃO DO RADAR - ASSESSORIA SMART** e os dados dos negócios nele contidos; os cinco outros funis sem mapeamento ficam fora deste lote. Os dez funis anteriormente aprovados continuam incluídos. O inventário completo registra 354 negócios ainda não importados: oito nos dez funis conhecidos, um no Smart e 345 nos cinco funis excluídos. O lote prevê até nove novos negócios, sujeitos às demais validações. Smart será representado por um pipeline próprio e suas quatro etapas originais, na ordem RD, com campos e formulários disponíveis na origem e sem migration de esquema. A importação desse pipeline exige apresentar na prévia seu setor de acesso, responsável, configuração e dados, seguida do mesmo gate Vault; não autoriza inventar transições, automações ou regras de encerramento ausentes da evidência RD.

A auditoria paginada de 16/10 retornou 1.566 negócios RD e encontrou os 1.212 cards importados. Estes têm zero valores próprios em `BpmCardCampoValor`, mas seus cadastros canônicos podem estar parcialmente preenchidos. A listagem RD contém contatos; o detalhe consultado não contém esse bloco. Foram identificados dados RD de contato em 1.188 cards, e-mail em 474, telefone em 1.164, UF em 1.014, regime em 882, valor acordado em 824 e Radar pretendido em 910. São ocorrências na origem, não contagens prometidas de gravação: existem identidades ambíguas, valores já preenchidos e divergências. Nove combinações empresa/campo apresentam desacordo entre negócios da mesma empresa. As contagens são uma fotografia e devem ser refeitas antes do plano.

O e-mail apresentado no formulário é canônico e depende de contato inequívoco; gravar um e-mail duplicado em campo próprio não resolve a origem do formulário. UF, município, regime e data de constituição pertencem ao cadastro `Cliente`; dados específicos do negócio precisam do campo de card correto. A prévia deve separar essas fontes.

O relatório privado `database-backups/pre-change/rd-fields-audit-2026-10-16/relatorio.txt` e `summary.json` fundamentam o diagnóstico. Fotografias, planilhas, identidades pessoais e payloads completos continuam privados. Esses arquivos não são backup completo. A migração anterior, seu backup e sua confirmação não autorizam a nova mutação em massa.

## Critérios de aceite

1. **Coleta completa, somente leitura:** disponibilizar operação CLI `collect` que consulte o CRM V1, enumere todos os funis e todas as etapas acessíveis e percorra integralmente os negócios e seus dados necessários, incluindo contatos da listagem, detalhes e definições de campos/opções. Não filtrar apenas Em tratativa nem apenas os dez funis já mapeados. Identificar filtros, estados retornados pela API, paginação, datas de coleta, falhas, contagens e limites; coleta incompleta bloqueia o plano de aplicação. Repetições de páginas, erros e limites devem ser detectados, sem tratar resposta parcial como sucesso. Nunca alterar o RD.
2. **Identidade estável e cobertura:** reconciliar todos os cards importados e novos negócios pela chave `provider = RD_STATION_CRM_V1` + `sourceDealId`. Produzir contagens por funil/etapa e classificação de cada negócio: existente, novo elegível, conflito, sem mapeamento, sem identidade verificável ou erro de coleta. Não mesclar negócios pelo CNPJ ou nome; negócios distintos da mesma empresa permanecem distintos. Negócio importado não localizado no snapshot atual é exceção, sem excluir ou arquivar o card Alpha.
3. **Destinos de pipeline e etapa:** para negócios novos, usar os dez funis e o de/para de etapas já aprovados e representados explicitamente no importador/configuração, validando os IDs Alpha atuais e registrando ajustes de nomes de etapas na prévia. Incluir, por decisão posterior expressa do usuário, um pipeline próprio para **REVISÃO DO RADAR - ASSESSORIA SMART**, com as quatro etapas RD na ordem original: **Contratos Stand-by**, **Envio do checklist e boas vindas**, **Documentação em análise** e **CLIENTES CANCELADOS**. Representar os campos e respectivas opções comprovadas na origem e disponibilizá-los nos formulários das etapas, reutilizando fontes canônicas quando semanticamente equivalentes, sem migration de esquema. Não inventar transições, obrigatoriedades, automações ou lifecycle a partir dos nomes das etapas; a API coletada não comprova essas regras. Apresentar setor de acesso e responsável com evidência verificável na prévia; não atribuir ao executor/fallback nem deixar acesso irrestrito por omissão de setor. Os cinco demais funis adicionais — AFRMM, TTD-409, Recuperações Marcelo, Recuperações Rafael e Falavinha — permanecem fora do lote atual, com 345 negócios registrados como exclusões explícitas no inventário de 16/10, sujeito à atualização da coleta. O inventário prevê até nove novos negócios elegíveis antes das demais validações. A recuperação dos campos de cards existentes preserva sua etapa, pipeline, responsável, membros e visibilidade atuais.
4. **Cliente dos negócios novos:** resolver `Cliente` existente por CNPJ válido normalizado e correspondência inequívoca, ou por resolução humana explícita registrada. Quando não existir cliente, propor sua criação somente com CNPJ válido e identidade empresarial verificável no RD, com campos cuja origem seja comprovada. CNPJ ausente/inválido, identidades contraditórias e nome aproximado vão para exceção; não criar cliente fictício nem vínculo sem evidência. A criação de cliente deve constar separadamente na prévia sujeita à confirmação. O critério substitui a restrição antiga de não criar clientes automaticamente apenas para operações elegíveis e especificamente aprovadas neste novo lote.
5. **Campos e formulários semanticamente corretos:** `preview` deve produzir matriz explícita campo RD → destino canônico/card/global/opção vigente, tipo, regra de normalização, origem e motivo. Preencher exclusivamente destinos vazios com origem válida e inequívoca; preservar valores não vazios, inclusive quando divergentes, registrando conflitos. Reconciliar todos os negócios de cada empresa antes de propor valores canônicos compartilhados; nenhuma ordem de processamento pode decidir o valor vencedor. Validar campo/opção vigente e o resolvedor que abastece o formulário. Não duplicar campos canônicos em `BpmCardCampoValor` para mascarar lacunas.
6. **Contatos sem associação indevida:** validar e normalizar telefones e e-mails; reaproveitar pessoas somente por identificadores exatos e correspondência inequívoca. Nome semelhante não identifica pessoa. Considerar `Pessoa.celular` obrigatório e único; contato sem celular utilizável não autoriza inventar telefone, reutilizar número de outra pessoa ou violar o modelo. Quando telefone e e-mail apontarem para pessoas diferentes, ou múltiplos contatos impedirem seleção canônica, registrar exceção. Criar/reusar `PessoaClienteVinculo` somente com evidência do negócio/empresa, sem desativar vínculos existentes nem eleger contato principal arbitrariamente. Dados recuperáveis que não podem ser representados ficam preservados no payload e reportados.
7. **Ambiguidades e dados sem equivalente:** preservar payload original e snapshot atual com proveniência, sem substituir silenciosamente o original. Mapear opções apenas por equivalência semântica explícita. “À definir” permanece pendente; faixas RD de 15 milhões não equivalem automaticamente às de 16 milhões do Alpha; mês sem dia/ano não vira data; faixas de impostos não provam suficiência; condições de pagamento não autorizam inventar descontos. Não inferir endereço, concluir checklist, criar próximo contato vigente a partir de tarefa histórica ou transformar vendedor/parceiro histórico em vínculo atual. Campos sem equivalente ou sem evidência ficam no payload e relatório de exceções.
8. **Prévia fechada e guardada:** `preview` opera sem gravação remota e gera snapshot/plano privado e imutável para revisão, com fingerprint da identidade do banco, hash do plano, lote, fontes coletadas, contagens, IDs, valores anteriores/novos, estado esperado, operações de criação/vínculo/preenchimento e exceções. Identificar operações por entidade e campo; deduplicar atualizações de empresas compartilhadas. O plano deve separar recuperação de existentes, novos cards, clientes, pessoas e vínculos. Credenciais e dados reais não podem aparecer em console, Git, fixtures ou relatório público; arquivos privados ficam ignorados pelo Git e com acesso restrito.
9. **Gate de execução Vault:** antes de qualquer mutação remota, acionar Vault e apresentar ambiente/banco afetados, comandos exatos, escopo/contagens do lote/hash, impacto, riscos, alternativa somente leitura e rollback. Exigir backup completo criado antes da alteração, verificado por restauração, integridade e contagens e com no máximo 48 horas, em `database-backups/pre-change/`. Backup ausente, vencido ou inválido bloqueia execução. Obter confirmação explícita do usuário para a prévia concreta após sua apresentação; silêncio, pedido geral de sincronização ou consentimento anterior não bastam. Não executar migration; estruturas existentes devem ser reutilizadas se suficientes. Qualquer necessidade estrutural é dependência separada sujeita à política de banco.
10. **Apply idempotente e restrito:** `apply` consome exclusivamente plano/hash/banco aprovados e usa lotes/transações pequenas, guards do estado atual imediatamente antes de gravar e trilha persistida de operação/lote/origem/antes/depois. Divergência ou edição humana posterior vira conflito e não é sobrescrita. Retomada e segunda aplicação não duplicam cards, pessoas, clientes, vínculos, valores ou proveniências, nem reexecutam operações já confirmadas. Capturar falhas parciais com resultado verificável; não mudar permissões, disparar automações, notificações, SLAs ou tarefas por efeito da carga.
11. **Simulação e rollback compensatório:** executar `apply`, `verify`, segunda aplicação e `rollback` em cópia privada restaurada do backup antes da carga remota. Demonstrar ausência de duplicação, integridade referencial e preservação do estado original. Rollback deve compensar somente operações aplicadas pelo lote e manter auditoria, protegendo edições posteriores e dependências criadas depois. Não remover entidades reutilizadas nem novas entidades que adquiriram dependências externas; reportar bloqueios. Restauração completa não é o rollback normal.
12. **Reconciliação e validação da experiência:** `verify` confronta cada operação aplicada com o plano, conferindo valores canônicos/campos, contatos e vínculo de origem dos novos cards, preservação de campos não vazios, proveniência, contagens por funil/etapa e exceções. Verificar que o resolvedor dos formulários existentes entrega os dados recuperados e que novos cards aparecem nos destinos mapeados aos usuários já autorizados. Usar testes de integração/apresentação e indicar explicitamente se inspeção autenticada não foi realizada. Não afirmar preenchimento completo onde o RD está vazio ou existe exceção. Informar totais aplicados, pendentes e respectivos motivos; não declarar todos os funis importados com destinos ainda não resolvidos.
13. **Qualidade e conclusão:** cobrir os cenários abaixo com testes sem dados reais, executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, registrar evidências, revisar o código e atualizar checklist e file list. Só concluir a recuperação após aplicação autorizada e reconciliação; aprovação da implementação não substitui execução nem resolução das pendências do usuário.

## Tasks / Subtasks

- [x] Registrar escopo completo, achados da auditoria e limites de autorização nesta story.
- [x] Validar a preparação com `story-draft-checklist.md`.
- [x] Inspecionar estruturas/importadores existentes e confirmar de/para completo por ID (AC 2–7).
- [x] Implementar coleta completa V1 e snapshots privados, com bloqueio de coleta parcial (AC 1, 8).
- [x] Reconciliar todos os funis/etapas e negócios novos e levantar destinos pendentes sem inferência (AC 2–4).
- [x] Implementar mapeamento canônico/card, consenso por empresa e contatos exatos (AC 5–7).
- [x] Implementar `preview`, guards/hash, `apply`, auditoria, `verify` e `rollback` com retomada (AC 8–12).
- [x] Implementar testes úteis de borda e integração e executar gates completos (AC 13).
- [x] Gerar backup novo, obter validação Vault e simular ciclo completo em cópia restaurada (AC 9, 11).
- [x] Apresentar prévia concreta, exceções, relatório Vault e pedir confirmação específica do lote (AC 3, 8–9).
- [x] Aplicar somente lote confirmado, verificar resultados e resolver/reportar exceções restantes (AC 10, 12).
- [x] Atualizar file list, evidências, status e resultado da recuperação sem expor dados privados (AC 13).

## Dev Notes

### Integrações existentes a reutilizar

- `scripts/migrar-rd-alpha.mjs`: provider `RD_STATION_CRM_V1`, de/para de pipelines/etapas, identidade de origem e importação de novos cards. Não reutilizar cegamente a elegibilidade/transformação antiga para suprir dados canônicos.
- `scripts/coletar-complemento-rd-alpha.mjs`, `scripts/complementar-rd-alpha.mjs` e `scripts/lib/rd-complement-recovery.mjs`: padrões existentes de coleta, plano fechado, guards, auditoria, verificação e compensação. Avaliar reaproveitamento sem regressão do complemento de tarefas/notas.
- `src/lib/bpm/campos-configuraveis-server.ts`: verificar as fontes reais dos formulários; campo próprio, global personalizado e canônico não são intercambiáveis.
- `prisma/schema.prisma`: `Cliente`, `Pessoa`, `PessoaClienteVinculo`, `BpmCard`, `BpmCampo`, `BpmCampoOpcao`, `BpmCampoValorGlobal`, `BpmCardCampoValor`, `BpmCardOrigemExterna` e trilhas de importação existentes. Confirmar campos e constraints antes de gerar o plano.
- `scripts/turso-backup.mjs` e `scripts/verify-turso-backup.mjs`: fluxo de backup e verificação a confirmar com Vault; fotografias RD/Alpha não os substituem.
- `tests/bpm/rd-station-*.test.ts` e `tests/bpm/rd-complement-recovery.test.ts`: padrões Vitest e integração SQLite existentes.

O CLI novo pode ser dedicado à recuperação de campos e sincronização; sua escolha de arquivo fica a cargo do executor após inspeção, mantendo `scripts/` e helpers/testes existentes. Registrar o caminho exato e todos os comandos executáveis na prévia antes de solicitar execução. Não editar componentes de UI salvo defeito demonstrado na resolução/apresentação dos dados desta story.

### Configuração e contratos

Usar credenciais existentes em `.env.local`: `RD_STATION_CRM_V1_TOKEN`, `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`, sem imprimir valores. Endpoint V1 de negócios: listagem `GET /deals` e detalhe `GET /deals/{id}`; campos customizados, funis/etapas e paginação devem seguir o contrato real validado na coleta. A V2 via MCP não substitui nem mistura identidades sem prova de equivalência.

Operações da CLI: `collect`, `preview`, `simulate`, `apply`, `verify`, `rollback`. Apenas `apply` e `rollback` podem mutar o destino e ambas exigem seus próprios guards e o gate de banco aplicável. Preview e verify nunca gravam para “corrigir” divergências.

### Mapeamento de funis já existente

| Origem RD já mapeada | Destino Alpha |
|---|---|
| Revisão de Estimativa do Radar (Leads) | Revisão de Radar |
| Diretoria Operacional – Vitor | Operacional |
| Financeiro – Entrada | Financeiro |
| Financeiro – Êxito | Financeiro |
| Revisão do Radar – Operacional Protocolo | Operacional |
| Stand-by – Processos Revisão de Radar | Revisão de Radar / Stand By |
| Habilitação do Radar | Revisão de Radar |
| Revisão do Radar – Operacional Maria | Operacional |
| Revisão do Radar – Operacional Mariah | Operacional |
| Deferidos – Processos Revisão do Radar | Operacional / Processo deferido |

Esta tabela resume a story anterior, não define novas relações etapa-a-etapa. Usar os IDs e a configuração aprovados. A decisão posterior do usuário resolveu o destino de Assessoria Smart: pipeline próprio, quatro etapas RD, setor Operacional 4 e responsável Wivian 34 por identidade exata. Os cinco demais funis adicionais permanecem explicitamente fora deste lote (345 negócios). As cinco novas entradas Radar usam o ID existente da etapa renomeada para “Em tratativa”, preservando sua identidade.

### Decisões e coerência entre stories

- [AUTO-DECISION] Escopo → todos os negócios/funis/etapas acessíveis e novos negócios, porque o usuário ampliou expressamente o recorte.
- [AUTO-DECISION] Sem destino aprovado → coletar e apresentar exceção, pois o pedido geral não define o pipeline/etapa de destino de funis adicionais.
- [AUTO-DECISION] Campos existentes divergentes → preservar e reportar, conforme auditoria e proteção das edições humanas.
- [AUTO-DECISION] Status → Ready for Review: aplicação autorizada e verificação concluídas; ressalvas basais de QA global permanecem documentadas.
- [DECISÃO DO USUÁRIO] Importar Assessoria Smart com seus dados; demais cinco funis adicionais excluídos. Não inferir transições entre as quatro etapas Smart.
- [DECISÃO TÉCNICA VALIDADA] Rollback compensatório conserva novas identidades e proveniência, arquiva os novos cards e desativa Smart; guardas de estado protegem alterações posteriores.
- `accumulated-context.md` e `.aiox/gotchas.json` não foram localizados na preparação. A coerência usa a story anterior e seu registro acumulado de migração, complemento e auditoria. Não criar contexto ausente nem atribuir decisões a documentos inexistentes.
- A persona foi carregada pelo fallback `.aiox-core/development/agents/sm.md`, pois `.Codex/commands/AIOX/agents/sm.md` não existe neste checkout. O escopo é uma story local específica solicitada; não há criação/sincronização de tarefa externa.

## Testing

Testes Vitest em `tests/bpm/` com fixtures sintéticas e SQLite real quando necessário para constraints, transações, retomada e compensação. Validar os seguintes comportamentos mensuráveis:

- Paginação completa, página repetida, erro intermediário/rate limit e coleta parcial bloqueada; negócios em qualquer etapa/funil e fora do de/para.
- Identidade por provider/deal, mesmo CNPJ em negócios distintos, novos negócios, CNPJ inválido/ausente e cliente compartilhado com valores conflitantes.
- Campo canônico versus próprio; vazio preenchido e não vazio preservado; opções incompatíveis, mês parcial, pagamento indefinido e dados sem equivalente.
- Pessoa por telefone/e-mail exatos, normalização, ambiguidade entre identificadores, telefone ausente, e-mail sem telefone e vínculos já existentes, sem pessoa fictícia ou seleção principal arbitrária.
- Hash adulterado, banco diferente, pré-condição alterada, segunda aplicação, falha parcial e retomada; zero duplicatas e zero sobrescritas humanas.
- Rollback do lote, entidade reutilizada, dependência posterior e edição posterior protegidas, mantendo auditoria e integridade.
- Resolução dos dados nos formulários e novos cards nos destinos corretos sem ampliar acesso ou produzir notificações/automações.

Gates obrigatórios: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Separar falhas preexistentes de falhas introduzidas com evidências reais, sem marcar gate como aprovado sem execução. Os gates executados e suas limitações estão registrados em QA Results; falhas preexistentes não foram convertidas em aprovação global.

## 🤖 CodeRabbit Integration

### Story Type Analysis

Primary Type: Integration. Secondary Types: API, Security, Database (mutação controlada de dados, sem migration prevista). Complexity: alta, pela reconciliação de entidades compartilhadas e execução em massa.

### Specialized Agent Assignment

- @dev: implementação e revisão pré-commit.
- @qa: veredito de qualidade, regressões e reconciliação.
- @architect: decisões estruturais se necessárias e revisão de impacto de acesso.
- @data-engineer / @db-sage e Vault: modelo, integridade, backup e segurança da carga.
- @devops: somente se houver PR/publicação autorizada; esta story não autoriza push/deploy.

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): revisão, lint/typecheck/test/build e zero CRITICAL.
- [ ] Pre-PR (@devops): revisão da integração e dos artefatos, caso haja PR.
- [ ] Pre-Deployment (@devops): se houver publicação, validar configuração e rollback; aplicação de dados continua condicionada ao Vault e confirmação específica.

### Self-Healing Configuration

Story 6.3.3: @dev em modo light, até duas iterações/15 minutos, correção de CRITICAL; HIGH documentado. @qa em modo full, até três iterações/30 minutos, CRITICAL/HIGH corrigidos e MEDIUM como dívida. @devops em modo check, somente relatório. Registrar indisponibilidade do CodeRabbit conforme configuração do projeto, mantendo os demais gates.

### CodeRabbit Focus Areas

Cobertura da paginação, identidades e campos corretos, preservação de valores, dados privados, ausência de credenciais nos artefatos, guards contra concorrência, idempotência, criação de vínculos baseada em evidência e compensação sem excluir dependências posteriores.

## Resultado da Story Draft Checklist

Checklist aplicado: `.aiox-core/product/checklists/story-draft-checklist.md`. Readiness: **READY para implementação**, clareza 9/10. Dependências de execução estão explícitas e não impedem coleta/prévia ou implementação.

| Categoria | Resultado | Evidência / pendência |
|---|---|---|
| Objetivo e contexto | PASS | Pedido integral, achados e continuidade da story anterior resumidos. |
| Orientação técnica | PASS | Integrações, entidades, configuração, operações CLI e restrições identificadas. |
| Referências | PASS | Story anterior e seções pertinentes, diagnóstico privado e caminhos existentes indicados. |
| Autocontenção | PASS | Mapeamentos conhecidos, exceções, identidade e política de preenchimento explícitos. |
| Testes | PASS | Cenários de dados, guards, simulação/rollback e gates mensuráveis definidos. |
| CodeRabbit | PASS | Tipos, agentes, gates, self-healing e focos preenchidos. |

Perspectiva do desenvolvedor: é possível implementar a preparação sem perguntas adicionais. Importar negócios de funis não mapeados depende de destino fornecido pelo usuário; aplicar qualquer lote remoto depende da prévia, backup e confirmação. Não representar essas pendências como sincronização integral concluída.

## Dev Agent Record

### Agent Model Used

Preparação: River (SM). Implementação: Codex (GPT-6), com revisão independente de arquitetura, QA e Vault.

### Completion Notes / Debug Log References

Implementação CLI concluída sem mudança de esquema ou interface; RD somente leitura e nenhuma gravação remota deste lote. `RD_STATION_CRM_V1_TOKEN` disponível em `.env.local` privado; MCP RD disponível é V2, coleta desta carga usa V1 diretamente.

Prévia final: fingerprint `5d12d21ba997f82084439c3fcf44077014d650a646097382b0e6828419395354`, 1.212 cards existentes analisados, nove novos, sete empresas novas, 809 pessoas novas, 834 vínculos, 1.771 campos de Cliente, 7.688 valores de card e oito e-mails de pessoas existentes. São 5.474 eventos de exceção, não leads únicos, incluindo 345 negócios fora do escopo e 553 ocorrências de valores preservados. As ambiguidades não geram valores inventados.

Backup de produção `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-16T14-22-39-588Z.sql`, gerado 16/10/2026 14:22:40 UTC: 344.030.970 bytes, 337 tabelas e 271.734 linhas, SHA-256 `e3b9d4d10d92b3a0615126db199c9899ce33b788cc47aecbbb8af66048ae213c`. Restauração integral e contagens/integridade/FK validadas independentemente por Vault. Não usar snapshots de leads como backup integral.

Simulação final às 14:58:17 UTC para o mesmo fingerprint: 1.170 grupos aplicados e verificados; repetição com zero escritas; 1.170 grupos revertidos; verificação final integral sem divergências; integridade ok e FK zero após aplicação e compensação. Rollback preserva novas identidades, proveniência e auditoria; não é restauração bit a bit do banco original.

Assessoria Smart: quatro etapas, 33 campos e formulários; setor Operacional 4, Wivian 34; sem transições/obrigatoriedades inventadas. A movimentação entre etapas depende de configuração posterior. Catálogo de Parceiro indicante com 63 opções conservado; editor administrativo atual limita edição a 50.

Artefatos privados revisáveis: `database-backups/pre-change/rd-fields-sync-2026-10-16/vault-report.txt`, `plan.json`, `preview-summary.json`, `campos-a-preencher.csv` (9.467 propostas), `simulation.json`, snapshots `source.json`, `scope.json` e `details.json`. Permissões 0600, ignorados pelo Git. O relatório contém ambiente, comandos exatos, impacto, riscos de aplicação parcial, alternativa individual, compensação e pedido de confirmação. Prévia não equivale a execução.

Logs locais: `/tmp/rd-fields-sync-backup.log`, `/tmp/rd-fields-sync-preview.log`, `/tmp/rd-fields-sync-simulation.log`, `/tmp/rd-fields-sync-tests-focused.log`, `/tmp/rd-fields-sync-focused-lint.log`, `/tmp/rd-fields-sync-final-lint.log`, `/tmp/rd-fields-sync-final-typecheck.log`, `/tmp/rd-fields-sync-final-test.log`, `/tmp/rd-fields-sync-build-isolated.log`.

### Execução autorizada e reconciliação — 16/10/2026

Usuário confirmou “autorizo” após a prévia concreta. A primeira tentativa do fingerprint `5d12…9395354` foi bloqueada no primeiro grupo, com zero gravações, por ocupação posterior de um ID de Cliente. Não houve force de guardas. Novo backup completo remoto foi criado e restaurado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-16T16-04-55-553Z.sql`, 16:04:56 UTC, 344.126.158 bytes, 337 tabelas, 271.887 linhas, SHA-256 `28eac5bb2650c839385091eb466a9dfce56a2a681806d56fb60068e684bf9b82`; verificação Vault independente, integridade ok/FK zero.

O subconjunto de 1.169 grupos permaneceu equivalente ao autorizado, com uma realocação técnica de ID livre e suas FKs. Prova em duas cópias restauradas conferiu 153.260 checkpoints de antes/depois/compensação e todos os SQL/argumentos/evidências. Fontes, código e valores não foram ampliados. Plano executado `f059a8d7db796a5d41d2bbe53665d703311124312267d5223fa393b19e887a30`, autorizado pelo vínculo à confirmação original e liberado por Vault, simulado antes da aplicação.

Um negócio novo tinha empresa já cadastrada por CNPJ exato após a primeira prévia, com dois valores de formulário diferentes. Foi separado integralmente; usuário confirmou especificamente **“Autorizar importação mantendo Regime Normal do Alpha”**, após receber a prévia revisada, backup, simulação e preservação do cadastro. Complemento `22d2f10436790fcd2d1fc22a0bd6ef47c9b3785e71e7b2b9e7963e5bf39afa89`, simulado e liberado pelo Vault, aplicado após a carga principal. Nenhuma alteração em Cliente nesse complemento.

Resultado real: **9.456 preenchimentos** (1.768 atributos de Cliente + 7.688 valores de card), **oito e-mails** de pessoas existentes, **nove negócios novos**, **seis empresas novas**, **809 pessoas novas**, **834 vínculos** e **50 eventos de origem**. Três atributos já preenchidos no cadastro posterior à prévia foram preservados; por isso há três preenchimentos e uma empresa nova a menos que a proposta inicial. Nenhuma operação autorizada ficou pendente. Os 345 negócios dos outros cinco funis permanecem fora do escopo aprovado; ocorrências sem dado/equivalência/identidade segura permanecem reportadas, sem inventar valores.

Aplicações confirmadas: principal 1.169/1.169, complemento 1/1, sem skips. Verificação real em snapshot remoto READONLY consistente às **16:33:25.439 UTC**, com **17.021 consultas**, mesmos hashes de banco/plano/código e mesmo `verifySyncChange`: **1.170 aplicados e correspondentes, zero revertidos/divergentes**, `quick_check=ok`, `foreign_key_check=0`. Verificador privado revisado por QA antes da execução; não modificou o runtime aprovado para acelerar leituras.

Pós-check real concluído às **16:33:57.697 UTC**: nove cards ativos; Smart com quatro etapas, quatro formulários, 33 campos, 132 componentes e 132 configurações de campo/etapa. Função real de acesso aprovou o responsável 34; resolvedor canônico real retornou sete fontes, seis não vazias, e CNPJ/razão social correspondentes ao Cliente. Zero rótulos inválidos em seleções preenchidas/ativas dos cards RD. Regime confirmado preservado. Não houve inspeção visual autenticada no navegador.

QA independente: **APPROVED para carga e reconciliação operacional**, sem novo CRITICAL/HIGH associado. Isso não é aprovação global da suíte: as seis asserções e um erro de importação basais permanecem documentados. Sem commit, push, deploy, migration, alteração no RD ou disparo de notificações.

Artefatos privados finais: `database-backups/pre-change/rd-fields-sync-2026-10-16/execution-report.txt`, `execution-result.json`, `campos-aplicados.csv` (9.464 linhas: campos + oito e-mails), `remote-verification-summary.json`, `form-data-verification.json`, os dois `apply-result.json`/`verify-result.json`, autorizações originais e do complemento, `rebase-equivalence.json`, planos aprovados preservados. Logs: `/tmp/rd-fields-sync-apply-subset.log`, `/tmp/rd-fields-sync-apply-complement.log`, `/tmp/rd-fields-sync-remote-verify.log`, `/tmp/rd-fields-sync-form-check.log`. Todos os dados reais permanecem ignorados pelo Git e protegidos.

### File List

- `docs/stories/story-alpha-crm-recuperacao-campos-sincronizacao-rd-v1.md` — escopo, checklist, decisões, evidências e pendência de autorização/aplicação.
- `scripts/sincronizar-rd-alpha.mjs` — CLI collect/preview/simulate/apply/verify/rollback, backup e hashes do banco/código/fontes, arquivos privados.
- `scripts/lib/rd-field-mapping.mjs` — mapeamento semântico e normalização conservadora de tipos/opções.
- `scripts/lib/rd-sync-plan.mjs` — plano por empresa, consenso/identidade, nove novos negócios, Smart, guardas e compensação.
- `scripts/lib/rd-sync-engine.mjs` — execução transacional, auditoria, idempotência e verificação/rollback guardados.
- `tests/bpm/rd-field-mapping.test.ts` — bordas de normalização/equivalências.
- `tests/bpm/rd-sync-plan.test.ts` — integração SQLite, identidade, consenso, opções do resolvedor e concorrência.
- `tests/bpm/rd-sync-engine.test.ts` — transações, hash, retomada, falha parcial, compensação e entidades compartilhadas.
- `tests/bpm/rd-sync-collection.test.ts` — integridade da coleta/paginação.
- `package.json` — comando `rd-alpha:sync`.
- `docs/stories/story-alpha-crm-migracao-historico-rd-station-v1.md` — registro anterior da auditoria somente leitura; preservado.
- `.env.local` e `database-backups/pre-change/` — somente artefatos privados/ignorados; nunca versionar credenciais, dumps ou dados reais.
- `database-backups/pre-change/rd-fields-sync-2026-10-16/verify-remote-snapshot.mjs` — verificação privada somente leitura com o mesmo engine em snapshot remoto consistente, revisada por QA.
- `database-backups/pre-change/rd-fields-sync-2026-10-16/check-form-data.mjs` — pós-check privado com resolvedor canônico/permissões reais, sem mutações.

As demais alterações preexistentes do checkout, inclusive UI/ownership/memórias, pertencem a outro trabalho e não foram revertidas nem incluídas como implementação desta carga.

## QA Results

Revisão independente @qa: sem achados novos CRITICAL/HIGH no código revisto. **APPROVED para carga autorizada e reconciliação operacional** após conferir os dois planos, aplicações, snapshot e pós-check reais. Story segue Ready for Review; QA global mantém CONCERNS/NEEDS_WORK pelas falhas preexistentes da suíte. Nenhuma operação autorizada pendente.

| Validação executada | Resultado e evidência |
|---|---|
| Testes específicos | PASS: quatro arquivos, 77 testes, fixtures sintéticas e SQLite real; `/tmp/rd-fields-sync-tests-focused.log`. |
| Lint dos arquivos novos | PASS, zero erros, `/tmp/rd-fields-sync-focused-lint.log`. |
| `npm run lint` | PASS, zero erros; 1.193 avisos preexistentes; `/tmp/rd-fields-sync-final-lint.log`. |
| `npm run typecheck` | PASS, `/tmp/rd-fields-sync-final-typecheck.log`. |
| `npm run build` | PASS em checkout isolado, `/tmp/rd-fields-sync-build-isolated.log`; build concorrente inicial interrompido foi substituído por execução isolada bem-sucedida. |
| `npm test` | FAIL preexistente: 635 arquivos passam, quatro falham; 4.781 testes passam, seis asserções falham, quatro skips e um todo. Inclui erro de importação além das seis asserções. `/tmp/rd-fields-sync-final-test.log`. |
| Baseline independente | QA reproduziu as mesmas seis asserções e um erro de importação no HEAD limpo `2658139b`, worktree `/tmp/rd-sync-clean-head.oHE4KO`, evidência `/tmp/rd-sync-clean-head.oHE4KO-qa-results.json`. Falhas: em-tratativa (2), card-modal-integration (1), builder/embed (3), arquivamento-modal-react (import next/server via next-auth). |
| Backup integral + Vault | PASS: backup original e novo integral restaurados; SHA, contagens, integridade e FK conferidos. Confirmações humanas original e do complemento recebidas; ambos liberados por Vault e aplicados. |
| Simulação do fingerprint final | PASS: aplicar/verificar/repetir/reverter/reverificar, 1.170 grupos, zero duplicatas/divergências/FKs inválidas. |
| CodeRabbit | CLI indisponível; revisão independente executada, sem alegar aprovação de ferramenta ausente. |
| Aplicação e reconciliação remotas | PASS: 1.170/1.170 grupos aplicados e correspondentes aos dois planos; 17.021 consultas em snapshot consistente, zero divergências/reversões/FKs inválidas; quick_check ok. |
| Resolvedor e configuração reais após carga | PASS: nove ativos, Smart quatro etapas/formulários, 33 campos, 132 componentes/configurações, acesso do responsável, canônicos corretos, zero seleções inválidas e regime confirmado preservado. |
| Navegador autenticado | Não realizado; não alegar inspeção visual de UI. Resolvedor e permissões foram exercitados programaticamente no banco real. |

Limitações materiais comunicadas: Smart não tem transições inferidas; editor de opções limitado a 50 apesar do catálogo conservado de 63; 345 negócios excluídos e ambiguidades preservadas. Rollback mantém identidades novas e auditoria. Suíte global não está verde. Aplicação e verificação remotas autorizadas concluídas. Limites de origem e de configuração Smart permanecem explícitos; não representam operações autorizadas ainda não aplicadas. A revisão global mantém as ressalvas basais acima.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-10-16 | 1.0 | Story preparada para recuperação integral de campos e atualização de novos negócios V1, com prévia, exceções, idempotência e gate Vault. | River (SM) |

| 2026-10-16 | 1.1 | CLI, Smart aprovado no escopo, plano final, backup integral, 77 testes e simulação completa; execução remota pendente de confirmação específica. | Codex / revisão QA e Vault |

| 2026-10-16 | 1.2 | Autorizações humana/Vault, rebase técnico sem expansão, complemento confirmado, 1.170 grupos aplicados e reconciliados, Smart e resolvedor reais verificados; Ready for Review com ressalvas basais. | Codex / revisão QA e Vault |
