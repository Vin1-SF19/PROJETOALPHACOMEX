# Story: CRM — edição completa dos dados da empresa e histórico auditável

## Status e responsáveis

Done — entrega concluída **somente em staging**, com consentimento específico, Vault/backup verificado, coluna aplicada, deployment READY, homologação autenticada e QA **PASS FINAL STAGING**. Escopo entregue: cadastro completo, contatos, QSA e RADAR/fiscal; exclui contratos, pagamentos e equipe. Produção está fora do escopo desta story, preservada sem publicação. `@sm` prepara story; `@architect` define persistência; `@dev` implementa; `@qa` valida; `@devops` publica dentro da autorização vigente.

## Story

**Como** usuário autorizado do CRM, **quero** editar cadastro completo, contatos, QSA e RADAR/fiscal pela gaveta, consultar CNPJ para preencher os dados disponíveis e salvar conscientemente, **para que** o cadastro fique correto e cada alteração tenha autor, data/hora e antes/depois no histórico. Contratos, pagamentos e equipe não integram esta edição, conforme resposta explícita do usuário.

Quero também retirar do histórico visível a anotação técnica inteira criada pela importação Instagram, mantendo o histórico comercial útil e a auditoria das edições.

## Comportamento solicitado

- Botão **Editar dados** bem visível ao lado de **Fonte: CS&NPS / ATIVO** na gaveta Dados da empresa.
- Ação pede confirmação antes de habilitar a edição de todos os campos dos grupos autorizados: cadastro completo, contatos, QSA e RADAR/fiscal. Negar/fechar essa confirmação não altera dados nem entra em edição. Contratos, pagamentos e equipe conservam a apresentação existente e ficam fora do editor.
- CNPJ preenchido oferece lupa para consultar as APIs existentes e preencher os dados disponíveis (incluindo QSA, Radar e capital social), como prévia do formulário. Botões **Salvar** e **Cancelar** ficam no topo durante edição.
- Dados pendentes impedem saída silenciosa do card: salvar, descartar explicitamente ou continuar editando. Cancelar/descartar não grava dados nem auditoria de alteração.
- Cada mudança confirmada aparece no histórico com campo, antes, depois, autor e dia/hora.

## Evidência e limites

- Diagnóstico inicial: `DadosEmpresaConteudo.tsx` apresentava Fonte/situação e informações consolidadas somente para leitura; `DadosEmpresaDrawer.tsx` controlava abertura/carregamento. A entrega adiciona editor explícito aos grupos autorizados, preservando contratos/pagamentos/equipe fora da edição.
- `ObterDadosEmpresaCardBpm` em `src/actions/bpm/Empresas.ts` verifica acesso ao card e consolida `Cliente`, `ClienteServico`, `Pessoa`/vínculos, `ConsultaPreAnalise` e `radar_fiscal`. Trata-se de múltiplas fontes; somente os grupos autorizados entram na nova edição. Não gravar contratos/pagamentos/equipe ou usar dados consolidados de negócio como se fossem cadastrais.
- Decisão explícita de `@architect`: preparar `Cliente.perfilCadastralJson Json?` para extras cadastrais/contatos/QSA/RADAR/fiscal que precisam sobreviver inclusive sem CNPJ, mantendo os atributos básicos já canônicos em `Cliente`. DTO/allowlist e snapshot fortes definem o contrato; não aceitar JSON arbitrário nem usar o novo perfil para guardar contratos, pagamentos, equipe, segredos ou marketing. Auditoria mantém campos legíveis, em vez de expor um dump bruto do JSON.
- Concorrência definida por `@architect`: CAS em `Cliente.updatedAt` contra o snapshot carregado, com alteração de atributos/perfil e auditoria existente na mesma transação. Falha de pré-condição é conflito explícito; não sobrescrever edição concorrente. Não persistir o rascunho por CNPJ como chave quando ele ainda não existe.
- `HistoricoAlteracaoCliente` já tem `campo`, `valorAnterior`, `valorNovo`, `userId`, snapshot de nome, `criadoEm` e `loteId`; `ClienteServicoHistorico` e `BpmCardHistorico` também existem. Reusar os modelos apropriados e a timeline do card, evitando duplicar auditoria visível.
- `salvarAlteracoesCliente` atual é referência parcial: requer sessão, mas não aplica ACL específica de card, não aceita CNPJ e faz atualização/auditoria separadas. Não reutilizar esse caminho como se satisfizesse autorização/transação desta story.
- Clients existentes: `getReceitaData`, `getEmpresaAquiData`, `consultarRadar` e agregador `src/lib/bpm/consulta-cnpj-lead.ts`. `ConsultarCnpjNovoContrato` é restrita à etapa financeira; não remover essa restrição para usar a lupa desta gaveta. Criar/adaptar somente a camada autorizada necessária com os clients existentes, sem nova API externa.
- `CardFullViewModal.tsx` já tem revisão de pendências com salvar, continuar editando e sair sem salvar; integrar o rascunho da gaveta ao controle existente, sem fluxo paralelo que permita fechamento indevido.
- Diagnóstico inicial: `AssumirLeadInstagram` criava anotação técnica `Dados recebidos do Instagram`. A entrega deixa de criá-la nas novas assunções e filtra o legado pela assinatura técnica estreita em três projeções, preservando anotações humanas/eventos reais. Não apaga registros existentes nem faz limpeza/backfill em massa.
- Gate de estrutura cumprido após preparo do código: consentimento específico **sim**, relatório Vault e backup completo restaurado/revalidado antes do único ALTER aprovado. Coluna confirmada em staging antes de publicar o novo Prisma. Não executar outros DDL/backfills; eventual rollback mantém a coluna opcional e retorna ao código anterior.
- Sem backfill, carga histórica, importação, alteração NoLoss/Apps Script ou env. Homologação usa somente o lead fictício já existente no staging, com CRUD normal auditado e restauração dos valores pela própria interface. Preservar as duas stories anteriores com alterações locais. Marketing/UTMs privados no NoLoss continuam fora do CRM; produção permanece fora desta autorização.

## Acceptance Criteria

1. **Editar dados** aparece no topo ao lado de Fonte/situação, com destaque e rótulo acessível. Usuário somente leitura não ganha ação de edição. Confirmação explícita inicia a edição; cancelar a confirmação mantém leitura e não dispara escrita/consulta.
2. Após confirmar, todos os campos de **cadastro completo, contatos, QSA e RADAR/fiscal** podem ser editados, incluindo grupos/listas, conforme o DTO e as permissões vigentes. **Contratos, pagamentos e equipe ficam excluídos**, sem controles de edição nem alteração indireta. Identificadores técnicos, proveniência e auditoria permanecem metadados protegidos. Atributos básicos usam `Cliente`; extras usam `Cliente.perfilCadastralJson` conforme schema/DTO explícitos, inclusive quando CNPJ for ausente.
3. **Salvar** e **Cancelar** ficam visíveis no topo durante edição; estado de carregamento/erro/salvamento é claro. Alterar campos mantém um rascunho local; nenhum autosave ou atualização indireta de registros consolidados ocorre antes de Salvar.
4. Lupa do CNPJ requer documento preenchido e válido, sessão e permissão de edição do card. Consultar clients existentes no servidor; segredos e respostas brutas sensíveis não vão ao navegador. Resultados disponíveis preenchem somente a prévia, preservando edições locais deliberadas; campos ausentes, falhas parciais, timeout ou 404 não apagam valores válidos nem inventam QSA/Radar/capital.
5. Resposta assíncrona da consulta corresponde ao CNPJ/card ainda ativos; mudança de CNPJ, cancelamento, descarte, troca de card ou consulta mais recente invalida a resposta anterior. Consulta isolada não persiste cadastro, QSA, Radar, cache de negócio ou auditoria de alteração; se helper atual escreve, separar consulta e persistência.
6. Salvamento valida payload/allowlist/tipos/documento/contatos/valores e aplica ACL no servidor antes de ler ou escrever dados restritos, revalidando o contexto na transação. Escopo inclui somente empresa vinculada e entidades autorizadas. Não vincular/mesclar silenciosamente outra empresa se o novo CNPJ já existe nem editar registros de outro card por ID adulterado.
7. Alterações canônicas/perfil, vínculos pertinentes e auditoria são gravados atomicamente na mesma transação. Usar snapshot/DTO e CAS em `Cliente.updatedAt` para detectar edição concorrente; autor/data do servidor. Conflito, falha de validação ou erro SQL preserva rascunho e não deixa persistência/auditoria parcial; comunicar conflito sem sobrescrever a mudança de outra pessoa.
8. Cada campo efetivamente alterado registra antes/depois, autor real da sessão e dia/hora, agrupado no mesmo lote de Salvar usando os históricos existentes. Mostrar valores legíveis no histórico do card, com formatação do projeto `pt-BR`/`America/Sao_Paulo`. Não criar linha por campo inalterado nem permitir que o payload forje autor/data. Mudanças compartilhadas de empresa preservam o vínculo correto e não exigem acesso a outros cards restritos.
9. Salvar com sucesso sai da edição e atualiza gaveta/card/histórico a partir do persistido. Duplo clique/repetição não duplica auditoria. Falha mantém edição e pendências; não fechar nem exibir sucesso antes de commit confirmado.
10. **Cancelar** restaura o snapshot salvo e descarta prévias de consulta, sem escrita/auditoria de alteração. Ao tentar fechar gaveta/card, clicar fora, usar Escape, trocar card ou navegar com pendências, usar o guard existente com escolhas de salvar, descartar ou continuar. Rascunho não pode sumir silenciosamente; falha ao salvar conserva a edição. Back/Forward do iframe pode concluir a navegação e desmontar o dono da rota: o MESMO editor permanece no host estável do layout até a escolha, sem fingir cancelar traversal. A preservação da instância limita-se à permanência do layout `PainelAlpha`; saída desse layout, remoção do iframe e recarga/fechamento total dependem do guard/aviso aplicável, sem prometer sobreviver ao encerramento forçado do processo.
11. A anotação técnica inteira de importação Instagram deixa de aparecer no histórico visível, inclusive entradas legadas identificáveis, sem apagar registros/banco. Não remover anotações humanas pelo simples texto parecido nem ocultar eventos de criação/assunção ou a nova auditoria. Dados comerciais necessários continuam acessíveis nos locais próprios, sem reexpor envelope/marketing.
12. Testes cobrem confirmação, ACL/IDs adulterados, rascunho, todos os grupos autorizados e exclusão de contratos/pagamentos/equipe, perfil extra sem CNPJ, lupa/validação e corrida, consulta sem escrita, cancelamento/fechamento com pendências, transação/rollback, conflito CAS, auditoria por campo/autor/horário, repetição e filtro estreito da anotação técnica. Gates de código: lint, typecheck, testes e build; registrar resultados reais e atualizar File List/checklist. Testes de schema usam ambiente isolado autorizado, sem contornar o gate do banco staging.
13. Entrega concreta apresenta schema/migração, banco staging, impacto, alternativa e rollback. Aplicação exige consentimento específico após relatório Vault/backup verificado, recebido nesta entrega; homologar no ambiente autorizado. Não executar DDL/backfill como parte implícita dos gates de código. Produção exige autorização própria posterior.

## Tasks / Subtasks

- [x] Inspecionar gaveta, fontes consolidadas, anotação técnica, histórico existente e guard de pendências.
- [x] Registrar delimitação explícita: cadastro completo/contatos/QSA/RADAR-fiscal; excluir contratos/pagamentos/equipe.
- [x] Registrar arquitetura: básicos em Cliente, extras em perfilCadastralJson, DTO/snapshot forte e CAS updatedAt com auditoria transacional.
- [x] Preparar código e artefato schema/migração sem aplicar DDL ou acessar coluna ausente no runtime staging.
- [x] Implementar filtro estreito de histórico em três projeções, confirmação e editor com rascunho/Salvar/Cancelar no topo.
- [x] Integrar lupa preview pura com clients existentes e controle de respostas antigas, sem persistência na consulta.
- [x] Implementar salvamento transacional, CAS e auditoria existente legível.
- [x] Integrar guard único e host estável no layout, preservando a instância após Back/desmontagem do dono da rota.
- [x] Verificar em Chromium real: mesmo input após Back, salvar após detach, guard do shell, sem overflow/erros JavaScript.
- [x] Executar testes/gates finais de código e obter aprovação QA local com resultado concreto revisável; nenhuma migração staging executada implicitamente.
- [x] Receber relatório Vault/backup staging revalidado, válido até 2026-10-22 20:48:47 UTC; revalidar idade/integridade na eventual execução.
- [x] Receber consentimento específico para migração/publicação staging e aplicar somente a coluna aprovada após backup válido/Vault PASS.
- [x] Publicar e homologar staging após gates integrados: deployment READY, 14 verificações autenticadas aprovadas, consulta/cancelamento sem persistência e duas gravações auditadas/restauração pela UI da empresa fictícia.
- [x] Obter QA PASS FINAL STAGING e confirmar produção/NoLoss/configuração preservados; produção não integra esta entrega.

## Arquitetura do host e limite de navegação

O editor é montado no [CardModalHost.tsx](../../src/app/PainelAlpha/AlphaCRM/CardModal/CardModalHost.tsx), instalado pelo [layout PainelAlpha](../../src/app/PainelAlpha/layout.tsx). O wrapper da rota/board publica o modal no host; ao desmontar por Back dentro do iframe, o conteúdo do editor e seu rascunho continuam na mesma instância até salvar, descartar ou continuar. Não há cancelamento fictício de traversal nem criação de um segundo formulário para mascarar perda do primeiro.

`PainelCardState` mantém `CardSaveProvider` no layout, e provider aninhado reutiliza o contexto existente (no-op), evitando dividir pendências. Essa preservação depende do layout `PainelAlpha` permanecer montado. Guard do shell e aviso de saída tratam remoção do iframe/saída completa conforme mecanismo aplicável; não se promete persistência após fechamento forçado do navegador.

## Implementação e evidência local

- Checkpoint `bf9a634b`: 37 arquivos; merge `43adebac` integra staging `69047dee`. Editor completo no escopo autorizado, consulta pura, DTO/snapshot, transação com CAS/auditoria e filtro estreito da anotação técnica em três projeções. Host/layout e seus ajustes posteriores ainda integram o delta local.
- Gates integrados ANTES da estabilização final do host: **724 arquivos/5.798 testes PASS, 4 skipped e 1 todo**, lint 0 erros/1.193 avisos legados, typecheck e build aprovados. Esses resultados não são apresentados como conclusão do delta posterior do host.
- Delta final do host: **3 arquivos de testes/23 testes PASS**; após corrigir pureza da fixture React, rechecagem focada com **17 testes PASS**. Chromium real final em `/tmp/crm-empresa-editor-preview/verification.json`, às **2026-10-22 14:29:46 UTC**: mesmo input após Back, dono da rota desmontado, salvamento após detach, guard de fechamento do shell, continuar preserva rascunho, descarte fecha iframe, sem diálogos sobrepostos, zero erros JavaScript e sem overflow (largura/scrollWidth 558 px). Fonte/CSS reais e APIs fictícias: prévia local, sem DDL/homologação remota.
- **Gates anteriores validados:** `npm test` exit0, **724 arquivos/5.805 testes PASS, 4 skipped e 1 todo (5.810 total)**, duração 35,86 s, iniciado às 14:28:28 UTC, `/tmp/crm-empresa-editor-tests-validated.log`. Lint exit0/0 erros e 1.193 avisos legados às 14:32 UTC, `/tmp/crm-empresa-editor-lint-validated.log`; typecheck exit0, `/tmp/crm-empresa-editor-typecheck-validated.log`; build exit0 com Prisma generate, player e CLI Next webpack com heap de 8 GB, `/tmp/crm-empresa-editor-build-validated.log`. Foram executadas as três fases equivalentes do build; o script padrão limitado a 3 GB não foi usado nem é declarado aprovado.
- **Árvore integrada final `e1bb8086`:** checkpoint do host `6b0fbb8e` mais merge local de staging `d7580d07`, sem conflitos. As regras adicionais de TI/Admin observadores e restrição de assunção foram preservadas byte a byte, assim como o editor/guard; as duas stories antigas continuam fora dos checkpoints. Novo `npm test` exit0: **724 arquivos/5.833 testes PASS, 4 skipped e 1 todo (5.838 total)**, 33,61 s, iniciado às 14:35:52 UTC, `/tmp/crm-empresa-editor-tests-merged.log`. Lint exit0/0 erros/1.193 avisos em `/tmp/crm-empresa-editor-lint-merged.log`; build completo equivalente com heap 8 GB exit0 em `/tmp/crm-empresa-editor-build-merged.log`; typecheck exit0 em `/tmp/crm-empresa-editor-typecheck-merged-final.log`. Typecheck foi repetido após o build terminar, pois a execução concorrente encontrou arquivos `.next/types` em regeneração. Nenhum erro de código ficou pendente.
- Incidentes de validação: execução de testes com processos paralelos concorrentes sofreu três timeouts por contenção; a execução limpa posterior de `npm test` passou conforme o log validated. Achado de pureza da fixture React foi corrigido, seguido de lint e testes focados aprovados. Logs anteriores com falhas não são contados como sucesso nem usados como recibo final.
- Parecer local anterior do agente `qa_instagram`: fonte sem achados P1/P2 e gates aprovados, antes de DDL/publicação. Avanço concorrente `d7580d07` integrado em `e1bb8086`. A sequência autorizada de migração/publicação e o PASS FINAL STAGING estão registrados abaixo; os gates locais anteriores não são usados isoladamente para alegar homologação remota.
- Vault: [relatório de staging](../crm-edicao-dados-empresa-vault-20261022.md) registra planejamento e aplicação do único ALTER após consentimento específico e nova restauração/integridade do backup, dentro de 48 horas no instante da execução. Coluna confirmada, 2.178 clientes preservados. Publicação/homologação seguem a sequência abaixo; produção permanece fora da autorização.

## Ativação autorizada em staging — 2026-10-22

- Usuário respondeu **sim às 16:28 UTC** à pergunta específica sobre adicionar a coluna opcional e publicar somente no staging. Vault reaplicou a validação completa do backup (restauração, integridade, hash, banco e idade de 43,68 h) antes da operação.
- Único `ALTER TABLE` aprovado confirmado às 16:29:45 UTC e por nova conexão às 16:30:02 UTC: 2.178 clientes preservados, 14 colunas (antes 13), `perfilCadastralJson JSONB` nullable/sem default, 0 valores não nulos e nenhuma alteração em índices ou outras tabelas. Recibo privado no caminho registrado no relatório Vault; não publicar dumps ou credenciais.
- Primeiro push de staging em `fae70b26` chegou à Vercel, mas o build `dpl_wyBo2BYnwJQnWDMXeUnyzxERPD4k` falhou por OOM/SIGKILL no container de 8 GB. Alias permaneceu na versão anterior; produção e configuração remota não foram alteradas.
- Ajuste arquitetural mínimo aprovado: `PerfilEmpresaProvider` acompanha o nó do card, com chave estável, em vez de ser importado pelo host global; leitura de confirmação em `CardSaveContext` usa import dinâmico somente após save confirmado, preservando versão/erros. Contrato do editor, ACL, auditoria e schema não mudam.
- Após o ajuste: `npm test` exit0, 724 arquivos/5.833 testes PASS, 4 skipped e 1 todo, `/tmp/crm-empresa-editor-tests-build-fix-final.log`; lint exit0/0 erros/1.193 avisos, `/tmp/crm-empresa-editor-lint-build-fix.log`; **script padrão real `npm run build` com heap de 3 GB exit0** em 1:34,97, `/tmp/crm-empresa-editor-build-default-fix.log`. Typecheck sequencial exit0 em `/tmp/crm-empresa-editor-typecheck-build-fix.log`; Chromium às 16:40:50 UTC confirmou mesmo input após Back, save após detach, proteção do shell, 0 erros e largura 558/558 px. Naquele ponto ainda faltava o novo deploy remoto; seu resultado aprovado consta no fechamento, sem atribuir causa isolada ao OOM anterior.
- Concorrência: origin/staging passou a `04599fdb` (consulta RADAR CSV, baseado em ancestral antigo). Checkpoint mínimo `fb7e7809` e merge normal local `102deb86` preservam ambos os históricos e os 12 arquivos Radar; nenhuma reescrita/force push. QA identificou e validou a correção da combinação: ausência no CSV, por 404 ou resposta 200 com “NÃO CONSTA NO ARQUIVO CONSULTADO”, não pode sintetizar “NÃO HABILITADA” nem apagar situação/submodalidade anteriores. Helper sinaliza fonte Radar indisponível e preserva os dados; resposta negativa comprovada e metadados continuam válidos. Nenhuma alteração no client/API CSV concorrente.
- Gates integrados após essa correção: `npm test` exit0, **726 arquivos/5.842 testes PASS, 4 skipped e 1 todo (5.847 total)**, 35,45 s, `/tmp/crm-empresa-editor-tests-final-integrated.log`; lint exit0/0 erros/1.193 avisos em `/tmp/crm-empresa-editor-lint-final-integrated.log`; `npm run build` padrão heap 3 GB exit0 em `/tmp/crm-empresa-editor-build-final-integrated.log`; typecheck sequencial exit0 em `/tmp/crm-empresa-editor-typecheck-final-integrated.log`.

## Fechamento e homologação autenticada de staging

- Código publicado `63612d765fd1ac4ddf9b16c0b2f349e416958755`, deployment `dpl_FkhYBLopCryLJeu1Ax583xt59Jdn` **READY**, com alias de staging conferido às **16:58:06 UTC**. Build remoto padrão de 3.072 MB aprovado: compilação em aproximadamente 2,3 minutos e build total em aproximadamente 4 minutos. Produção permaneceu em `main` `28651e7f`; NoLoss e os 201 itens de configuração remota foram preservados.
- Chromium real no staging, autenticado, às **17:05:17 UTC**: **14 verificações PASS**, zero erros de página. Foram conferidos filtro da anotação técnica, confirmação/cancelamento, grupos autorizados, ausência de autosave, guards do X do card e da gaveta, Back com a MESMA instância de formulário, continuar editando, salvar após navegação e recarga persistida. Isso complementa a prévia local; não é uma simulação por APIs fictícias.
- Consulta CNPJ real retornou **3 sócios/QSA e capital social** para preencher a prévia, preservando edição manual. Nenhum dado consultado foi salvo; Cancelar manteve **zero persistência dessa consulta**. Radar parcial sem retorno manteve os dados anteriores, sem sintetizar situação fiscal nem apagar valor válido.
- Homologação usou somente a empresa fictícia já existente no staging, ID 3068. Duas gravações normais pela interface alteraram o nome para marcador de teste e o restauraram ao valor original. Conferência do banco: **2 auditorias de Cliente + 2 eventos de card**, antes/depois exatos, lotes correspondentes, perfil versão 1, autor real e dia/hora legíveis no fuso do projeto. Nome original, CNPJ, capital, responsável e etapa ficaram preservados/restaurados. Não houve importação de leads nem alteração de empresas/leads reais; as duas gravações fictícias foram intencionais e auditadas.
- Recibos privados, sem reproduzir credenciais ou dados pessoais nesta story: [release de staging](/tmp/crm-edicao-empresa-staging-release-evidence.json), `/home/ialpha/.local/share/noloss/integrations/instagram/manual-test-staging/empresa-editor-runtime-verification.private.json`, `empresa-editor-db-after.private.json` e `empresa-editor-runtime-audit-verification.private.json` na mesma pasta privada.
- QA final do agente `qa_instagram`: **PASS FINAL STAGING** para código `63612d76` publicado e runtime autenticado, incluindo auditoria nas duas tabelas, alteração/restauração fictícia e consulta cancelada sem escrita. Produção está **fora do escopo e preservada**, sem pendência que impeça concluir esta entrega de staging. Fechamento documental em commit local; sem novo push ou deploy.

## File List

- `docs/crm-edicao-dados-empresa-vault-20261022.md`
- `docs/stories/story-crm-edicao-dados-empresa-historico-20261022.md`
- `prisma/migrations/20261022140000_cliente_perfil_cadastral/migration.sql`
- `prisma/schema.prisma`
- `src/actions/bpm/EmpresaCadastro.ts`
- `src/actions/bpm/Empresas.ts`
- `src/actions/bpm/InstagramLeads.ts`
- `src/actions/bpm/Interacoes.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaConteudo.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaDrawer.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaEditor.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/SeletorPipelineBoard.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/hooks/usePainelFrameLeaveGuard.ts`
- `src/lib/bpm/consulta-cnpj-lead.ts`
- `src/lib/bpm/dados-empresa-edicao.ts`
- `src/lib/bpm/dados-empresa-server.ts`
- `src/lib/bpm/dados-empresa.ts`
- `src/lib/bpm/historico-descricao.ts`
- `src/lib/bpm/instagram-anotacao-tecnica.ts`
- `src/lib/bpm/timeline.ts`
- `src/lib/painel-leave-guard.ts`
- `src/lib/timeline/extractors/card.ts`
- `tests/bpm/consulta-cnpj-lead.test.ts`
- `tests/bpm/dados-empresa.test.ts`
- `tests/bpm/empresa-cadastro-editor-react.test.ts`
- `tests/bpm/empresa-cadastro-frame-guard-react.test.ts`
- `tests/bpm/empresa-cadastro-sqlite.test.ts`
- `tests/bpm/empresa-cadastro.test.ts`
- `tests/bpm/instagram-leads-assumir.test.ts`
- `tests/bpm/movimentacao-importados-rd-react.test.ts`
- `tests/bpm/movimento-livre-react.test.ts`
- `tests/bpm/seletor-pipeline-pendente-react.test.ts`
- `tests/bpm/transicao-requisitos-card-react.test.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardModalHost.tsx`
- `src/app/PainelAlpha/layout.tsx`

## CodeRabbit Integration

Tipo: UI + Business Logic + dados canônicos/auditoria. QA revisou ACL, fontes consolidadas, rascunho/consulta sem escrita, atomicidade, conflitos, host/guard de saída, filtro preciso do item técnico e compatibilidade semântica RADAR CSV. **PASS FINAL STAGING** após publicação READY e 14 verificações autenticadas, conferência de auditoria e restauração fictícia. Consentimento específico e Vault/backup precederam o único ALTER aplicado. Não foi declarada revisão automatizada inexistente nem publicação em produção.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 0.1 | Editor completo com consulta em prévia, salvamento auditado e retirada visual da anotação técnica Instagram | `@sm` |
| 2026-10-22 | 0.2 | Escopo explícito do usuário e arquitetura de perfil JSON; código/schema preparados, DDL/runtime staging pendentes de consentimento específico | `@sm` / `@architect` |
| 2026-10-22 | 0.3 | Editor e host implementados/prévia verificada; revisão local e gates finais em curso, DDL/runtime staging pendentes de consentimento | `@sm` |
| 2026-10-22 | 0.4 | Gates validated e QA local aprovados; migração/runtime staging continuam pendentes de consentimento específico e revalidação Vault/backup | `@sm` |
| 2026-10-22 | 0.5 | Done staging após consentimento, Vault/ALTER, deploy READY, homologação autenticada e QA final; produção fora do escopo | `@sm` |
