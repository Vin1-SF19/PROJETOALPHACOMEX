# Story — Corrigir os fluxos de edição e salvamento do sistema

## Status

Ready for Review — correções integradas à base staging vigente; quatro gates aprovados. Publicação e homologação autenticada de staging pendentes.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["regressões comportamentais de persistência", "testes de autorização e concorrência", "npm run lint", "npm run typecheck", "npm test", "npm run build", "homologação autenticada staging"]

- @dev implementa; @architect revisa mudanças de contrato, concorrência e autorização; @qa valida os resultados; @devops publica e verifica staging após os gates.
- Sem alteração estrutural prevista. Se a solução passar a exigir schema/migration/índice/backfill ou mutação em massa, acionar Vault e obter o consentimento específico obrigatório antes de executar.
- O workspace tem alterações de outras tarefas. Cada executor deve preservar esse trabalho e restringir suas edições aos arquivos sob sua responsabilidade.

## Story

Como usuário autorizado do Painel Alpha, quero editar e salvar campos, formulários, anotações e documentos com confirmação verdadeira, recuperação de rascunhos e preservação das demais alterações, para continuar meu trabalho sem perda de conteúdo nem falsa indicação de sucesso.

## Fonte, autorização e limites

- Fonte funcional: [Auditoria de edição e salvamento](../reports/auditoria-salvamento-sistema-2026-10-26.md#achados-e-correções-recomendadas), achados S01–S15 e observação C01; o pedido posterior do usuário autoriza executar as melhorias descritas.
- Fontes de teste: [reproduções e inventários da auditoria](../qa/evidencias/auditoria-salvamento-20261026/README.md). Os 18 testes históricos confirmam defeitos; não são testes de aprovação. Preservar a evidência histórica e criar regressões funcionais que exijam o comportamento correto.
- A auditoria examinou HEAD `392ec53e5b6dfbf3717f3dbf31e19824afe13b51` com alterações locais e configuração de staging por SELECT. Não demonstrou identidade com o código publicado nem incidentes em dados reais. Revalidar a base efetiva antes do deploy.
- Staging primeiro: branch `staging` e `https://staging.alpha-comex.com`. Usar `.env.staging.local` nas operações CLI de staging e conferir o banco efetivo; não presumir `.env.local`. Não copiar dados/credenciais de produção. Produção requer validação staging e pedido explícito posterior de promoção.
- Esta entrega não autoriza migration, seed, backfill, mutação em massa ou alteração de configuração de banco real. O trabalho de código e testes isolados deve avançar sem essas operações. Dados de negócio reais não serão usados para fabricar evidência de salvamento.
- Para C01, o usuário confirmou permitir edição de dados já existentes nas cinco etapas sem formulário, sem criar campos. Não criar novos pipelines nem regras de negócio.

## Acceptance Criteria

1. **S01 — confirmação da revisão de Notas:** envios de uma nota respeitam ordem/revisão; a resposta de A não limpa o rascunho B nem apresenta “Salvo” enquanto B permanece pendente. Reabrir/recarregar preserva o conteúdo ainda não confirmado.
2. **S02 — atualização parcial do CheckList autônomo:** alterar somente status preserva a observação; alterar somente observação preserva os demais dados. Campo omitido e limpeza explícita têm semânticas diferentes e verificáveis após uma nova leitura.
3. **S03 — resultado verdadeiro e atomicidade do CheckList:** a tela trata respostas estruturadas e exceções, mostra falha e mantém o rascunho; alterações otimistas são confirmadas ou revertidas corretamente. Item e progresso relacionado são gravados atomicamente; falha intermediária não deixa atualização parcial indevida.
4. **S04 — ações laterais de Notas:** arquivar/lixeira somente limpam rascunho, fecham abas e notificam sucesso após confirmação positiva do servidor. Negativa ou erro de transporte preservam conteúdo e apresentam orientação útil.
5. **S05 — procedimentos do CRM:** salvar o item B não substitui observação pendente do item A. Confirmações são aplicadas à revisão enviada; recargas preservam as demais edições e pendências do card. Observações participam do mecanismo de saída/recuperação do card.
6. **S06 — anotação simples do CRM:** digitação registra pendência e rascunho; envio participa da fila/flush do card. Fechar/reabrir recupera o texto ou exige descarte explícito. Falha de gravação mantém o conteúdo; sucesso confirmado remove somente a revisão correspondente e insere a anotação uma vez no fluxo normal.
7. **S07 — rascunho durável do CRM:** existe recuperação local por usuário/card e versão-base para conteúdo pendente; a saída do navegador informa pendências sem prometer concluir requests durante unload. Recarregar, fechar/reabrir aba e trocar usuário não sobrescrevem conteúdo remoto nem expõem rascunho de outra conta. Conflitos exigem resolução explícita.
8. **S08 — recuperação de Notas:** reconexão retoma o envio compatível; rascunho recuperado pode ser salvo sem redigitar. Divergência de versão aparece ao usuário com opção de resolução que preserva os textos. Erro de banco/rede não deixa “Salvando...” indefinidamente; há tentativa manual. A versão é conferida atomicamente e concorrência retorna conflito estruturado.
9. **S09 — tarefas legadas:** criação individual/recorrente verifica todos os resultados e não limpa formulário nem confirma itens rejeitados. Edição valida payload e preserva opcionais omitidos; consultas SQL recebem parâmetros, sem interpolação de entrada. Concluir/excluir/editar registro inexistente ou não alterado não produz falso sucesso; lotes informam resultado por item ou são atômicos conforme o contrato adotado.
10. **S10 — autorização de escrita:** tarefas legadas e reservas exigem sessão ativa e autorização para o alvo no servidor, incluindo criação/edição/exclusão/conclusão e os caminhos equivalentes utilizados pela interface. Autoria deriva da sessão; `userId` enviado não concede acesso. Preservar papéis administrativos e operações legítimas já existentes; negar antes da escrita quando faltar acesso.
11. **S11 — reservas válidas e concorrência:** o servidor e a interface recusam fim igual/anterior ao início e datas inválidas; intervalos sobrepostos são recusados. Duas requisições concorrentes para o mesmo recurso/intervalo não confirmam reservas conflitantes. Falhas são comunicadas e mantêm o formulário recuperável.
12. **S12 — cadastro mestre e histórico:** mudança cadastral e histórico associado têm uma única confirmação transacional. Falha do histórico reverte a mudança. O modal libera o estado de salvamento em todos os desfechos e mantém informação precisa de grupos confirmados/pendentes quando o salvamento composto admite resultado parcial.
13. **S13 — limpeza do pré-cadastro:** limpar Complemento e outros campos opcionais envia uma intenção explícita de limpeza aceita pelo contrato, distinta de campo não editado. Após sucesso e nova leitura, o valor continua limpo. Validar obrigatoriedade e permissões existentes; não tornar inválidos dados legados por suposição.
14. **S14 — documento Blueprint:** fila e revisão por documento impedem confirmação antiga de esconder revisão recente. Rascunho é recuperável e a versão-base evita sobrescrita concorrente silenciosa. Criação possui identidade estável/idempotência suficiente para retentativa após resposta incerta, sem duplicar documentos. Documento e histórico são confirmados atomicamente; falhas preservam conteúdo e retornam resultado estruturado.
15. **S15 — renomear nota pela aba:** a ação apresentada como “Renomear nota” persiste o título no servidor, respeita versão e permissão e preserva o conteúdo pendente do editor. Recarregar/reabrir mantém o título confirmado; falha não apresenta renomeação persistida nem apaga o rascunho.
16. **C01 — edição dos dados existentes:** nas cinco etapas sem formulário nem composição canônica, permitir editar apenas os campos já registrados no card, conforme escolha explícita do usuário. Revalidar permissões, visibilidade, leitura e mapeamentos no servidor. Preservar configurações canônicas existentes, inclusive ocultas, e não introduzir campos, defaults ou novas obrigatoriedades.
17. **Gates e regressões:** executar lint, typecheck, suíte completa e build com resultados reais; adicionar regressões que falhem no comportamento defeituoso e passem na correção, cobrindo sucesso, negação, falha intermediária, resposta atrasada, concorrência e retentativa pertinentes. Tratar a falha visual preexistente do seletor pelo contrato de tema vigente, sem suprimir teste de salvamento; limitar o lint a arquivos de projeto válidos para impedir que caches gerados inviabilizem o gate geral.
18. **Staging e entrega:** publicar a versão aprovada primeiro em staging via DevOps e registrar commit/release/READY/alias. Homologar com registros fictícios e perfis autorizados os caminhos alterados, conferir nova leitura independente da persistência e resultado em falha. Documentar o que não pôde ser exercitado; atualizar checklist, File List e relatório de correções. Não publicar/configurar produção nesta autorização.

## Matriz de rastreabilidade e pontos existentes

| Achados | AC | Implementação a revisar | Regressões mínimas |
| --- | --- | --- | --- |
| S01, S04, S08, S15 | 1, 4, 8, 15 | `src/components/Notas/NoteEditor/NoteEditor.tsx`, `Central/PainelPropriedades.tsx`, `NotesGlobalTaskbar.tsx`; `src/actions/Notas.ts`, `NotasWorkspace.ts`; `src/store/useNotasWorkspace.ts` | A→B com resposta lenta; offline/reconexão; recuperação compatível/divergente; negativa de arquivar/lixeira; renomear com conteúdo pendente. |
| S02, S03 | 2–3 | `src/actions/checklist.ts`; `src/app/PainelAlpha/CheckList/ChecklistView.tsx` | Status isolado; observação isolada; limpeza; erro retornado e rejeitado; rollback de item/progresso. |
| S05, S06, S07 | 5–7 | `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx`, `EditorAnotacaoCard.tsx`, `CardSaveContext.tsx`, `CardFullViewModal.tsx`; layout do CRM | Item A pendente enquanto B salva; anotação sair/reabrir/flush; recarga e conflito; isolamento por usuário. |
| S09, S10, S11 | 9–11 | `src/actions/Tarefas.ts`, `Reservas.ts`; `src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx`, `ReservaSalas/page.tsx`; guardas de acesso existentes | Falha individual/lote; zero linhas; opcionais ausentes; payload inválido; sessão ausente/alvo alheio; intervalos e disputa concorrente. |
| S12 | 12 | `src/actions/Clientes.ts`; `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` | Histórico falha e cadastro reverte; exceção libera UI; grupos parciais mantêm pendências. |
| S13 | 13 | `src/components/Parceiros/ModalEditarPreCadastro.tsx`; `src/actions/convites-parceiro.ts` | Limpar Complemento/endereço/contato opcional; omissão preserva; negação preserva rascunho. |
| S14 | 14 | `src/components/AlphaBlueprint/SpecificationEditor.tsx`; `src/actions/BlueprintDocuments.ts`; validações Blueprint existentes | Confirmação antiga; criação repetida; falha de histórico; duas sessões; recuperação após recarga. |
| C01 | 16 | Metadados de `BpmEtapaFormulario`/campos via leitura; [matriz auditada](../qa/evidencias/auditoria-salvamento-20261026/matriz-etapas-staging.json) | Cinco etapas permitem editar dados existentes sob ACL; composição canônica permanece preservada, sem criar configuração. |
| Gates/entrega | 17–18 | `eslint.config.mjs`, teste de Novo Card/tema, scripts de staging existentes, relatório QA desta entrega | Quatro gates com exit real; regressões; smoke e persistência autenticada staging. |

## Tarefas / subtarefas

- [x] Registrar autorização, escopo completo, restrições, critérios e referências autocontidas.
- [x] Confirmar base local, alterações concorrentes e ambiente efetivo; registrar responsabilidades por pacote (AC 17–18).
- [x] Implementar Notas: ordenação/revisão dos envios, recuperação, ações laterais e renomeação persistida (AC 1, 4, 8, 15).
- [x] Corrigir contrato parcial e transação do CheckList autônomo; confirmar/recuperar estado na interface (AC 2–3).
- [x] Integrar procedimentos e anotação ao salvamento do card; preservar rascunhos por item e entre recargas (AC 5–7).
- [x] Corrigir respostas, parâmetros e consumo de tarefas; aplicar autorização consistente aos alvos (AC 9–10).
- [x] Validar intervalos e concorrência de reservas, com falhas recuperáveis (AC 10–11).
- [x] Tornar cadastro mestre/histórico atômicos e liberar o modal após exceções (AC 12).
- [x] Corrigir intenção de limpeza dos campos opcionais do pré-cadastro (AC 13).
- [x] Proteger documento Blueprint com revisão, recuperação, criação repetível e atomicidade do histórico (AC 14).
- [x] Implementar e testar edição dos campos já registrados nas cinco etapas sem formulário, conforme confirmação do usuário (AC 16).
- [x] Acrescentar regressões funcionais por pacote; manter as reproduções históricas identificadas como evidência (AC 1–17).
- [x] Resolver abrangência do lint e expectativa visual de tema segundo os contratos atuais (AC 17).
- [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; revisar segurança, concorrência e erros de todos os pacotes (AC 17).
- [ ] Publicar/verificar primeiro staging via DevOps e homologar os fluxos alterados com registros fictícios e perfis pertinentes (AC 18).
- [ ] Atualizar resultados por achado, pendências reais, checklist, File List e evidências sem dados sensíveis (AC 18).

## Dev Notes

- Existem mecanismos aproveitáveis: fila/versão/rascunho em sessão no CRM, `AtualizarCardBpm` com validação e transação, fila por slide/revisão de edição no editor de Apresentações. Reutilizar conceitos existentes sem presumir que uma fila em um módulo protege outro. [Fonte: auditoria, seção “O que já protege o usuário”.]
- `CheckList` autônomo usa `ItemChecklist` e progresso operacional; procedimentos dentro do CRM usam entidades BPM. Evitar aplicar correção de um domínio ao outro por semelhança de nome. [Fonte: auditoria, S02–S05.]
- O localStorage é uma cópia recuperável de trabalho, não confirmação de gravação no servidor. Associar rascunho a identidade e revisão; não reaplicar silenciosamente conteúdo obsoleto. Arquivos em upload e funções de retry não são serializáveis; a recuperação deve reconhecer a necessidade de selecionar/revalidar o arquivo, sem declarar que um upload foi recuperado apenas pelo nome. [Derivação dos AC 6–8 e dos limites da auditoria.]
- Não contornar conflitos buscando sempre a versão atual e sobrescrevendo o campo alterado em outra sessão. Comparação/merge devem preservar a intenção e rejeitar conflitos reais. Não remover autorização/obrigatoriedade para fazer testes passarem.
- As cinco etapas C01 são: Revisão de Radar → Sem viabilidade; Financeiro → Stand By, Cancelado e Processos 2x1; Operacional → Cliente cancelado. A auditoria encontrou ausência tanto de formulário quanto de campos canônicos nessas etapas. O usuário definiu o comportamento: editar somente dados existentes, sem novos campos.
- O [plano paralelo de pendências CRM](../architecture/plano-crm-pendencias-sem-novos-pipelines-20261026.md#1-objetivo-e-limites) pertence a outra solicitação e registra definições ainda necessárias; não importar suas propostas de campos/cadências/regras como requisitos desta correção de salvamento.
- Stack/padrões confirmados: Next.js 16, React, TypeScript, Prisma/LibSQL, Zustand e Vitest, conforme `package.json`, `vitest.config.ts` e preferência técnica ativa. Preservar imports absolutos e retornos estruturados seguros.
- `docs/framework/`, `docs/architecture/index.md`, os guias genéricos de arquitetura previstos no template, `.aiox/gotchas.json` e `accumulated-context.md` não foram encontrados. Usados o relatório específico, stories anteriores e código real como orientação, sem inventar arquitetura ausente. Referência de continuidade: `story-alpha-crm-correcoes-auditoria-fluxo-20261021.md`, seção QA de 26/10, e `story-crm-erro-salvar-concluir-tarefa-maria.md`, cujas proteções de ACL/CAS/retry precisam ser preservadas.

**[AUTO-DECISION] Origem e identificação:** o usuário pediu todas as correções do relatório; usar a identificação específica recebida e os achados como fonte, sem criar epic numerado ou tarefa externa fictícia. Story local é o artefato autorizado; não sincronizar ClickUp.

**[DECISÃO CONFIRMADA] Banco e C01:** executar código/testes sem mudança estrutural. O usuário escolheu editar dados já existentes nas cinco etapas sem criar campos. Uma operação estrutural futura continua sujeita ao gate Vault.

## Testing

- Testes em `tests/`, seguindo `vitest.config.ts`; componentes com happy-dom e dependências de servidor simuladas quando pertinente. Preferir ações/fluxos observáveis a testes que procuram strings no código.
- Para cada defeito, produzir regressão que exija preservação do conteúdo, confirmação verdadeira e persistência correta em nova leitura. Exercitar respostas estruturadas e rejeições de Promise, incluindo atraso A→B, reconexão, versão divergente, zero registros alterados, falha do histórico e duas requisições concorrentes.
- Usar SQLite temporário quando necessário comprovar transação/CAS/rollback; não concluir atomicidade real apenas com mock. Nenhum teste deve depender de banco de produção ou credenciais reais.
- Baseline auditada: 5.398 testes aprovados, 1 falha visual de `colorScheme` no Novo Card, 4 skipped e 1 todo; typecheck aprovado; lint de aplicação sem erros e 259 avisos, mas lint geral reprovado por 23.365 erros em `.cache`. São resultados anteriores, a reexecutar após as correções.
- Quatro gates obrigatórios, com comando, destino efetivo, exit e resumo registrados. CodeRabbit/revisão QA devem distinguir problemas novos de avisos preexistentes.
- Staging: conferir revisão/alias/banco; registros fictícios; edição permitida/negada, salvar/reabrir, limpar opcional, campo obrigatório inválido, rede/sessão, concorrência e repetição. Não substituir teste de usuário comum por acesso Admin. Smoke de disponibilidade não equivale a homologação de salvamento.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- Primary Type: Integration / correção full-stack de persistência.
- Secondary Types: API, Frontend e Security.
- Complexity: alta, com pacotes independentes e contratos compartilhados de revisão/erro.

### Specialized Agent Assignment

- @dev: implementação, regressões e Pre-Commit.
- @architect: contratos de concorrência, idempotência e autorização; @qa: gate independente e homologação; @ux-design-expert: clareza de pendência/conflito/recuperação quando necessário; @devops: publicação staging/Pre-PR. Vault/@data-engineer apenas se surgir operação de banco abrangida pela política.

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): diff, regressões, lint/typecheck/test/build e revisão dos caminhos de falha/negação.
- [ ] Pre-PR (@devops), se aplicável: compatibilidade, escopo exato e resultados dos gates.
- [ ] Pre-Deployment staging (@devops): ambiente, release, rollback de código e roteiro com dados fictícios.
- Produção fora desta autorização; não executar gate de promoção como publicação implícita.

### Self-Healing Configuration

- @dev light: até 2 iterações/15 minutos para CRITICAL; HIGH documentado e encaminhado à revisão.
- @qa full: até 3 iterações/30 minutos para CRITICAL/HIGH; MEDIUM registrado como dívida.
- @devops check: reporte, sem corrigir/publicar além do escopo autorizado.
- Se CLI não estiver instalado/autenticado, registrar a limitação e a revisão alternativa conforme degradação prevista na configuração; não inventar aprovação CodeRabbit.

### Focus Areas

Revisões antigas, rascunhos por identidade, atualizações parciais, transações reais, retries/idempotência, validação, autorização de recurso no servidor, SQL parametrizado, mensagens de erro úteis, privacidade das evidências e isolamento staging/produção.

## Validação da preparação — River

`story-draft-checklist.md` aplicado em modo autônomo.

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Pedido e relatório rastreados; limites de staging/banco e workspace explícitos. |
| Orientação técnica | PASS | Pontos de integração por achado, contratos a preservar e riscos de concorrência. |
| Referências | PASS | Links locais específicos; contexto essencial incluído neste arquivo. |
| Autocontenção | PASS | 18 ACs, todos S01–S15/C01, dependências e decisões explicitadas. |
| Testes | PASS | Resultados observáveis, fixtures/SQLite, quatro gates e roteiro staging. |
| CodeRabbit | PASS | Tipos, agentes, gates, self-healing e focos preenchidos. |

**READY, clareza 9/10.** Todos os pacotes de código têm requisitos implementáveis. C01 foi esclarecido posteriormente pelo usuário: edição dos dados já existentes, sem novos campos. Esta validação aprova a preparação, não a aplicação, testes ou deploy.

## Dev Agent Record

Implementação coordenada por Dex, em pacotes Notas, legados, CRM e Blueprint. O usuário confirmou C01: permitir editar dados já existentes nas cinco etapas sem formulário, sem criar campos. O candidato está sobre o remoto vigente aca95ddb; mudanças de CheckList e proteção global de saída já publicadas são preservadas.

O lint geral passou após excluir snapshots gerados de .cache do escopo; a expectativa de colorScheme foi alinhada ao token de tema vigente. Primeira suíte completa no checkout teve saturação por execução paralela de gates; falhas de timeout não foram convertidas em alterações de testes. O candidato terá a suíte com concorrência limitada.

A revisão independente reproduziu dois casos adicionais de rascunho entre instâncias (Blueprint e CRM). Ambos receberam token por revisão e proteção contra confirmação/limpeza antiga, com regressões específicas. Evidências em /tmp/alpha-qa-s07-fix.log e /tmp/blueprint-ownership-editor.log; nomes/quantidades finais serão conferidos no candidato.

Relatório de tratamento por achado: [correções de salvamento](../reports/correcoes-salvamento-sistema-2026-10-26.md).

### File List

- `docs/qa/correcoes-salvamento-legados-20261026.md`
- `docs/qa/evidencias/auditoria-salvamento-20261026/README.md`
- `docs/qa/evidencias/auditoria-salvamento-20261026/campos-interface.csv`
- `docs/qa/evidencias/auditoria-salvamento-20261026/execucao.json`
- `docs/qa/evidencias/auditoria-salvamento-20261026/inventario-codigo.json`
- `docs/qa/evidencias/auditoria-salvamento-20261026/lint-evidencias.log.gz`
- `docs/qa/evidencias/auditoria-salvamento-20261026/lint-resumo.json`
- `docs/qa/evidencias/auditoria-salvamento-20261026/matriz-etapas-staging.json`
- `docs/qa/evidencias/auditoria-salvamento-20261026/reproducoes-actions.test.ts.txt`
- `docs/qa/evidencias/auditoria-salvamento-20261026/reproducoes-ui.test.ts.txt`
- `docs/qa/evidencias/auditoria-salvamento-20261026/reproducoes.log.gz`
- `docs/qa/evidencias/auditoria-salvamento-20261026/suite-geral.log.gz`
- `docs/qa/evidencias/auditoria-salvamento-20261026/typecheck.log.gz`
- `docs/qa/evidencias/auditoria-salvamento-20261026/vitest.config.ts`
- `docs/qa/evidencias/correcoes-salvamento-20261026/gates.json`
- `docs/reports/auditoria-salvamento-sistema-2026-10-26.html`
- `docs/reports/auditoria-salvamento-sistema-2026-10-26.md`
- `docs/reports/correcoes-salvamento-sistema-2026-10-26.md`
- `docs/stories/story-correcoes-salvamento-sistema-20261026.md`
- `eslint.config.mjs`
- `src/actions/BlueprintDocuments.ts`
- `src/actions/Clientes.ts`
- `src/actions/Notas.ts`
- `src/actions/Reservas.ts`
- `src/actions/Tarefas.ts`
- `src/actions/bpm/Anexos.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Checklists.ts`
- `src/actions/bpm/Interacoes.ts`
- `src/actions/convites-parceiro.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardModalHost.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/EditorAnotacaoCard.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`
- `src/app/PainelAlpha/AlphaCRM/layout.tsx`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`
- `src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx`
- `src/app/PainelAlpha/PainelTarefas/PainelTarefaC/page.tsx`
- `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/page.tsx`
- `src/app/PainelAlpha/ReservaSalas/page.tsx`
- `src/app/PainelAlpha/layout.tsx`
- `src/components/AlphaBlueprint/ProjectWorkspace.tsx`
- `src/components/AlphaBlueprint/SpecificationEditor.tsx`
- `src/components/Notas/Central/CentralDeNotas.tsx`
- `src/components/Notas/Central/PainelPropriedades.tsx`
- `src/components/Notas/Central/useLixeiraNotas.ts`
- `src/components/Notas/NoteEditor/NoteEditor.tsx`
- `src/components/Notas/NoteViewer.tsx`
- `src/components/Notas/NotesGlobalTaskbar.tsx`
- `src/components/Parceiros/ModalEditarPreCadastro.tsx`
- `src/lib/blueprint/documento-persistencia.ts`
- `src/lib/blueprint/documento-rascunho.ts`
- `src/lib/blueprint/ownership.ts`
- `src/lib/bpm/campos-registrados-sem-formulario-server.ts`
- `src/lib/bpm/checklists/schemas.ts`
- `src/lib/bpm/rascunhos-locais.ts`
- `src/lib/legacy-write-access.ts`
- `src/lib/notas-tabs.ts`
- `src/lib/notas/salvamento-client.ts`
- `src/lib/reservas/intervalo.ts`
- `src/lib/validations/blueprint.ts`
- `src/lib/validations/bpm.ts`
- `tests/blueprint/documento-action.test.ts`
- `tests/blueprint/documento-editor-react.test.ts`
- `tests/blueprint/documento-persistencia-sqlite.test.ts`
- `tests/bpm/anotacao-idempotencia-sqlite.test.ts`
- `tests/bpm/campos-registrados-sem-formulario-actions.test.ts`
- `tests/bpm/campos-registrados-sem-formulario-anexos.test.ts`
- `tests/bpm/campos-registrados-sem-formulario.test.ts`
- `tests/bpm/card-save-flow.test.ts`
- `tests/bpm/checklists-card-actions.test.ts`
- `tests/bpm/ficha-reuniao-integracao-react.test.tsx`
- `tests/bpm/google-meet-convidados-input-react.test.ts`
- `tests/bpm/procedimentos-vazio-react.test.ts`
- `tests/bpm/rascunhos-crm-abas-react.test.ts`
- `tests/bpm/rascunhos-crm-saida-recuperacao-react.test.ts`
- `tests/bpm/salvamento-rascunhos-crm-react.test.ts`
- `tests/notas/editor-salvamento-react.test.ts`
- `tests/notas/salvamento-actions.test.ts`
- `tests/notas/salvamento-concorrente.test.ts`
- `tests/salvamento-legados/actions.test.ts`
- `tests/salvamento-legados/sqlite.test.ts`
- `tests/salvamento-legados/ui.test.ts`

## QA Results

### Revisão independente do candidato — Quinn, 26/10/2026

**APPROVED — código e gates para publicação em staging.** A revisão do candidato sobre `b115dd3802485e9b0a049f2a45a5010db77338b5` fechou os achados reproduzidos e confirmou os quatro gates abaixo. A aprovação é limitada ao pacote de código e à publicação autorizada em staging; a homologação autenticada do novo release continua pendente e a story ainda não comprova essa etapa. Produção permanece fora do escopo.

- **P1 — CRM, isolamento entre instâncias — corrigido:** `persistDrafts`/`setDraft` regravava o mapa local inteiro na chave do usuário. Reproduzido com dois providers da mesma conta: A mantém um envio antigo, B grava um rascunho novo na mesma chave, a confirmação de A removia também o rascunho de B. Evidência inicial: `/tmp/alpha-qa-cross-provider-repro.log`. Executor adicionou token por edição, merge por chave, remoção por ownership e modo `sync` para confirmações/metadados. Regressão permanente em `tests/bpm/rascunhos-crm-abas-react.test.ts`; revisão independente com dois outros arquivos de CRM: **3 arquivos/27 casos aprovados**, `/tmp/alpha-qa-s07-independent.log`. Correção verificada também no provider integrado do candidato.
- **P1 — Blueprint, resposta antiga regravava rascunho de outra instância:** corrigido pelo executor com token por edição e comparação de token/revisão/conteúdo/identidade/base antes de regravar metadados ou remover a cópia local. Regressões incluem A → A2 → B, sucesso de A e conflito de A2, além de colisões de conteúdo/revisão com token ou versão distintos. Correção revisada na raiz e confirmada no código e nos testes do candidato integrado.
- Verificação independente: `npx vitest run tests/notas/salvamento-concorrente.test.ts tests/notas/salvamento-actions.test.ts tests/notas/editor-salvamento-react.test.ts tests/blueprint/documento-editor-react.test.ts tests/blueprint/documento-persistencia-sqlite.test.ts --maxWorkers=1`, exit 0, **5 arquivos/43 casos aprovados**. Evidência: `/tmp/alpha-qa-notas-blueprint-focused.log`. SQLite temporário e mocks, sem escrita em banco remoto.
- Inspecionados CAS/histórico transacional e fluxo de recuperação/renomeação/arquivamento de Notas; idempotência/CAS/histórico de Blueprint; autorização, SQL parametrizado e exclusão de sobreposição de reservas no candidato legado. Nenhum novo bloqueador confirmado nesses caminhos até este ponto.
- S02/S03 devem usar a arquitetura `ChecklistAnalistas` já presente no staging; portar os arquivos antigos da raiz retiraria proteções posteriores. Preservar também `requestLeave`, `flushSavesInBackground` e o provider global do CRM durante o merge.
- **P2 — CRM, pendência recuperada permanece depois da confirmação — corrigido:** a hidratação de `pendingRef` usava a chave de rascunho `card-form`, enquanto `PainelCamposEtapaAtual` registrava/limpava a chave `card:card-form`. Reprodução real do componente: editar → remontar → reconhecer recuperação → salvar com sucesso; o armazenamento era removido, mas `getPendingFields('card')` ainda retornava `['Rascunho recuperado']`. Evidência inicial `/tmp/alpha-qa-recovered-fields-repro.log`. Executor normalizou chaves recuperadas, persistiu `pendingKey` e limpou aliases ao confirmar. Revisão independente do candidato e novo teste permanente `tests/bpm/rascunhos-crm-saida-recuperacao-react.test.ts`: **3 casos aprovados**, lint sem erros/avisos, `/tmp/alpha-qa-candidate-navigation.log` e `/tmp/alpha-qa-candidate-navigation-lint.log`. Sem montar o card, continuar preserva o texto; descartar limpa os formatos `-`/`:` e libera a saída; salvar sem editor mantém recuperação e erro visíveis. Outra conta permanece isolada.
- Revisão do merge remoto confirmou provider global com `userId` e `key` no layout/host, remount interno por identidade, preservação de `requestLeave`, `flushSavesInBackground`, navegação/frames e fechamento do card em background. `Cards.ts` contém somente o delta C01; regras remotas posteriores e filtro técnico de Instagram permanecem.
- No candidato integrado, a QA executou ainda **8 arquivos/66 casos aprovados** de Notas, Blueprint e CRM, `/tmp/alpha-qa-candidate-focused.log`. C01 foi refinado depois dessa rodada para usar fallback somente quando não há formulário nem composição canônica; revisão do diff confirmou preservação de configurações existentes, inclusive ocultas, e neutralização da obrigatoriedade condicional apenas no fallback. Os gates finais abaixo incorporam esse último delta C01.
- **P2 — Reservas, autoria por nome — mitigação conservadora verificada:** candidato adicionou `requireReservationOwner` em edição, exclusão e conclusão. Para não administradores, `usuarios.count({ where: { nome: actor.nome } })` deve retornar exatamente 1 antes de qualquer escrita; zero/homônimos retornam falha e orientação ao administrador. Administrador mantém autorização explícita e criação não recebe restrição indevida. QA revisou o delta e executou `tests/salvamento-legados/actions.test.ts`: **21 casos aprovados**, `/tmp/alpha-qa-reservas-owner-independent.log`; inclui contagens 0/2 em todos os três caminhos e ausência de chamadas de escrita, além de Admin/criação. O relatório declara a limitação remanescente de renomeação/reutilização histórica: o modelo continua sem FK, portanto a mitigação não fornece identidade durável de autoria. Não houve migration.
- **Dependências — débito preexistente, separado das regressões desta entrega:** o `npm audit` do candidato registrou 114 achados (10 critical, 45 high, 58 moderate, 1 low), evidência `/tmp/alpha-salvamento-stage-20261026/npm-audit.json`. A QA conferiu igualdade byte a byte de `package.json` e `package-lock.json` com a base remota inicial `aca95ddb402da03a5d58b7833a04bd99b018e537` e com a final `b115dd3802485e9b0a049f2a45a5010db77338b5`: nenhum delta no manifesto/lock da entrega. Os achados pertencem ao grafo já existente e não foram introduzidos por atualização de dependências desta correção. Isso não elimina o débito nem aprova sua segurança/explorabilidade; tratamento deve ter escopo e validação próprios. O gate desta story continua condicionado aos resultados finais de código/UI.
- CodeRabbit indisponível no ambiente; revisão manual e regressões executadas como alternativa prevista. Os quatro gates finais passaram; a homologação autenticada do release em staging continua obrigatória. Não há aprovação de produção.

- **Escopo e evidências:** manifesto final contém **89 caminhos**, todos com SHA-256 conferido; a File List da story coincide exatamente. Varredura dos caminhos e padrões de credenciais não encontrou arquivos de ambiente, backups, dumps, chaves privadas, sessões de navegador, JWTs ou atribuições de tokens no pacote. Isso é uma verificação delimitada do artefato, não uma garantia de ausência universal de segredos. As duas reproduções históricas arquivadas como `.test.ts.txt` foram comparadas byte a byte com os originais da raiz: conteúdo preservado, sem relaxar asserts ou `tsconfig`.

- **Suíte completa final:** `npm test -- --maxWorkers=1 --testTimeout=15000`, com coverage V8, sobre a base final `b115dd3802485e9b0a049f2a45a5010db77338b5`: **795 arquivos/6.631 casos aprovados; 4 skipped e 1 todo**, duração 374,71 s; statements 70,93%, branches 64,53%, functions 78,48%, lines 74,47%. Evidência `/tmp/alpha-salvamento-stage-20261026/final-test-budgeted.log`. O watchdog padrão de 5 s falhou antes no caso remoto de validação de reader, que restaura/verifica quatro backups SQLite sequencialmente; isolado com o padrão de 5 s passou em 974 ms (`hashreader-isolated-default.log`). O orçamento CLI de 15 s é ajuste de infraestrutura do runner, mantendo hooks de 30 s, asserts, fontes/configuração dos testes e deadlines do produto. A rodada anterior também falhou com `ENOSPC` e continua registrada como falha de infraestrutura (`final-test-current-staging.log`); ela não é apresentada como PASS. Os dois mocks de reunião foram completados com os métodos novos do contexto, sem relaxar expectativas.

### Gate pré-publicação — candidato final b115

| Gate | Comando/ambiente | Resultado final | Evidência |
| --- | --- | --- | --- |
| Lint | `npm run lint` | Exit 0; 0 erros, 1.172 avisos preexistentes | `/tmp/alpha-salvamento-stage-20261026/final-lint-current-staging.log` |
| Typecheck | `npm run typecheck`, depois do build e restauração dos arquivos gerados | Exit 0 | `/tmp/alpha-salvamento-stage-20261026/final-typecheck-current-staging.log` |
| Suíte completa | `npm test -- --maxWorkers=1 --testTimeout=15000`, coverage V8, fixtures locais sem credenciais remotas | Exit 0; 795 arquivos, 6.631 aprovados, 4 skipped, 1 todo | `/tmp/alpha-salvamento-stage-20261026/final-test-budgeted.log` |
| Build | `node build-staging.mjs` executando `npm run build`, somente ambiente staging conferido | Exit 0; 86 páginas | `/tmp/alpha-salvamento-stage-20261026/build.log`, `build-status.json` |

A primeira tentativa de build falhou no prerender de `_global-error` por duas resoluções de Next/React no diretório externo de saída. DevOps corrigiu o contêiner de saída para resolver a mesma árvore isolada e repetiu o build; não houve alteração de fonte/configuração para ocultar a falha. A tentativa com exit 1 permanece em `build-first-external.log`/`build-first-external-status.json`. QA conferiu o resultado final e confirmou diff vazio em `tsconfig.json`, `next-env.d.ts`, `package.json`, `package-lock.json` e `prisma/schema.prisma`. Manifesto final: 89 caminhos, sem alteração de hashes do runtime após os gates; somente esta seção documental muda para registrar o gate.

O percurso de navegador está preparado para a conta fictícia Admin, apenas com dados próprios `QA-SALVAMENTO-NOTAS`, `QA-SALVAMENTO-BLUEPRINT` e fixtures CRM/legadas coordenadas pelo DevOps. Será executado depois de READY do novo commit. Não há fixture comum autorizada disponível para esse percurso: autorização/negação de usuário comum foi coberta nas regressões, e não será declarada homologação de UI desse perfil nem alteradas permissões para fabricá-la.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-26 | 1.0 | Story autorizada para correções S01–S15, classificação de C01 e gates/validação staging. Preparação e checklist concluídos, sem código da aplicação. | River / @sm |
