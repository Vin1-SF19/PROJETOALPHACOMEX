# Story — Financeiro ativo: conferência e cálculo em Novo Contrato

## Status

In Progress — implementação local e prévia de publicação prontas; aplicação no Turso e preenchimento dos dois cards dependem das confirmações específicas do procedimento Vault.

## Executor Assignment

`executor: @dev` · `quality_gate: @qa` · `quality_gate_tools: [npm run lint, npm run typecheck, npm test, npm run build]`

## Story

**Como** integrante do Financeiro, **quero** conferir no card de Novo Contrato os dados originados da negociação comercial e preencher os dados financeiros, **para** liberar a elaboração do contrato somente com informações válidas e cálculo auditável.

**Escopo atual:** pipeline Financeiro ativo recriado (`cmuih4i54000209gmmyqrg557`, versão 7 no último inventário), etapa `Novo Contrato` (`draft-stage-92d707af-9b90-4f71-a9be-58ec7fbe98f8`), seguida de `Elaboração de Contrato`. O card é criado por automação após o fechamento no pipeline comercial `Revisão de Radar` (`cmuih48la000009gmzw3wwuzf`), com vínculo ao card de origem. No inventário inicial, `Novo Contrato` tinha apenas `Valor acordado no contrato` e `Forma de pagamento` no formulário, ambos opcionais. Essas informações são uma fotografia de leitura e devem ser verificadas novamente antes de publicar a configuração.

Esta story não reativa o pipeline Financeiro antigo, sua etapa `Solicitação de Contrato`, seus 31 campos publicados em 25/09 nem regras financeiras removidas. As stories históricas são contexto de conceitos e testes, não evidência de configuração atual.

## Campos a conferir e completar

| Grupo | Dados | Origem e tratamento |
| --- | --- | --- |
| Cadastrais | CNPJ; Razão Social; Rua; Número; Complemento; Bairro; CEP; Município; Estado; E-mail; Regime tributário do cliente | Exibir os valores disponíveis no Comercial; permitir conferência e correção controlada no Financeiro. Complemento é opcional. |
| Contratação | Serviço contratado; Valor bruto do contrato; Forma de pagamento; Condição negociada; Vendedor responsável; Origem do cliente; Parceiro responsável | Exibir os valores disponíveis no Comercial, preservando o valor efetivamente negociado. Parceiro é condicional. |
| Financeiros | Regime tributário do prestador; IRRF aplicável; Alíquota IRRF; Valor IRRF; CSRF aplicável; Alíquota CSRF; Valor CSRF; Total de retenções; Valor líquido para pagamento; Vencimento; Link/dados para pagamento | Preenchimento ou confirmação pela equipe do Financeiro. Valores de retenções e totais são resultados calculados a partir de entradas confirmadas e regras cadastradas. |

**Identidade e origem:** mapear cada dado para uma identidade estável de campo e sua fonte no card de Revisão de Radar. Registrar em inventário quais campos são compartilhados por cliente e quais precisam de cópia/snapshot no card Financeiro. Campo ausente na origem fica vazio para conferência; não preencher com um valor presumido. A cópia na criação não pode sobrescrever depois uma correção manual do Financeiro. Rótulos e apresentação permanecem editáveis em `Configurações > Campos e Formulários`, sem que a regra dependa do texto do rótulo.

## Critérios de aceite

1. [ ] Ao concluir a negociação em `Revisão de Radar`, o card Financeiro ativo é criado na etapa `Novo Contrato`, vinculado ao card comercial, sem duplicação em repetição do gatilho. Os campos cadastrais e da contratação existentes na origem são apresentados ao Financeiro por mapeamento configurável, com valor efetivamente negociado preservado; dados ausentes aparecem vazios e identificáveis para correção.
2. [ ] O formulário publicado de `Novo Contrato` mostra os três grupos e todos os campos listados acima, com tipo, opções, ordem, rótulo, visibilidade e regras de obrigatoriedade administráveis na UI. Os dados cadastrais e da contratação são conferidos pelo usuário; os financeiros são preenchidos/confirmados no Financeiro. A UI distingue valor trazido da origem, valor corrigido e resultado calculado sem criar duas fontes editáveis para o mesmo conceito.
3. [ ] Antes da saída para `Elaboração de Contrato`, exigem-se CNPJ, Razão Social, Rua, Número, Bairro, CEP, Município, Estado, E-mail, Regime tributário do cliente, Serviço contratado, Valor bruto do contrato, Forma de pagamento, Condição negociada, Vendedor responsável e Origem do cliente. Complemento é opcional. Parceiro responsável é obrigatório quando a origem envolver parceiro. A condição usa opção/vínculo configurado, não inferência por substring do rótulo.
4. [ ] No salvamento e na transição, o servidor valida CNPJ, E-mail, CEP e UF; Valor bruto do contrato deve ser maior que zero; Regime tributário e Forma de pagamento devem corresponder a opções válidas da configuração publicada. Erro ou pendência bloqueia a transição e identifica nominalmente todos os campos afetados no card e na lista de destinos.
5. [ ] Ao preencher CNPJ válido, a consulta de CNPJ existente pode sugerir Razão Social e endereço, município, UF e CEP quando disponíveis. Resposta parcial, erro ou indisponibilidade mantêm o preenchimento manual. Consulta não substitui dados já conferidos nem presume o regime tributário usado para retenções quando a fonte não for confiável para essa finalidade.
6. [ ] Com os regimes tributários pertinentes e o valor bruto confirmados, o Financeiro consegue selecionar/confirmar se IRRF e CSRF se aplicam e as alíquotas correspondentes de acordo com regras tributárias cadastradas e editáveis. `Sim` exige alíquota válida e valor calculado. Ausência de regra ou dado necessário produz pendência explícita; nenhuma alíquota ou incidência é inventada, e `Não` resulta em retenção zero para aquele tributo.
7. [ ] O cálculo é feito no servidor com `Total de retenções = Valor IRRF + Valor CSRF` e `Valor líquido para pagamento = Valor bruto do contrato - Total de retenções`, usando precisão monetária adequada e sem valor líquido negativo silencioso. Mudança de valor bruto, regime, indicador ou alíquota invalida/recalcula resultados dependentes. O card registra memória de cálculo auditável com entradas, regra/versão aplicada, resultado, data e responsável pelo ato de confirmação.
8. [ ] Dados de pagamento só podem ser gerados ou registrados após cálculo válido. Vencimento e Link/dados para pagamento devem estar preenchidos antes de colocar o status financeiro em `Aguardando pagamento`; sem eles, a mudança de status é bloqueada com pendências nominais. As informações ficam disponíveis para envio ao cliente. Não há envio ou cobrança externa automática sem integração aprovada.
9. [ ] A única transição liberada por este escopo é a aresta publicada de `Novo Contrato` para `Elaboração de Contrato`; com obrigatórios e condicionais satisfeitos, o card avança; com pendências, permanece em `Novo Contrato`. O cálculo financeiro e o status de pagamento seguem seus próprios pré-requisitos sem criar bloqueio oculto que contradiga o formulário publicado.
10. [ ] Administrador consegue alterar, validar e publicar no editor as identidades/mapeamentos, campos, opções, obrigatoriedade estática/condicional, regras de retenção aplicáveis, composição do formulário e automações deste fluxo. O resultado é executado no servidor sem codificar alíquotas, incidência ou nomes exibidos; valores e histórico dos cards existentes são preservados.
11. [ ] Depois da implementação e publicação validadas, os dados faltantes dos dois cards Financeiro de teste identificados no inventário são preenchidos com valores explicitamente fictícios e reconhecíveis como teste, sem alterar dados reais de cliente nem disparar cobrança/envio. A lista exata de campos e valores é revisada antes da escrita; a operação tem backup, autorização específica e conferência pós-gravação conforme Vault.

## Tarefas / checklist

- [x] Inventariar somente leitura o pipeline Financeiro ativo, sua etapa/aresta, formulário, campos/opções/regras, automação de handoff e campos equivalentes de `Revisão de Radar`; produzir tabela `campo destino → identidade → fonte → tipo → editabilidade → regra` (AC 1–3, 10).
- [x] Definir mapeamento configurável e proteção de snapshot do valor negociado; confirmar semântica de campos compartilhados por cliente antes de copiar valores (AC 1, 2).
- [x] Preparar os três grupos no formulário e as regras de obrigatoriedade/validação do servidor, inclusive dependências de parceiro, IRRF e CSRF, sem depender dos nomes de rótulo (AC 2–4, 6, 9). Publicação pendente.
- [x] Integrar consulta de CNPJ com preenchimento assistido e fallback manual, sem inferência tributária não confiável (AC 5). A action e a UI existentes passam a usar o campo publicado.
- [x] Implementar cálculo auditável com indicadores e alíquotas informados pelo Financeiro, sem presumir regra fiscal; resultados protegidos contra edição manual divergente (AC 6, 7, 10).
- [x] Preparar registro dos dados de pagamento e guarda do status `Aguardando pagamento`; dados ficam no card para conferência e envio manual (AC 8). Publicação pendente.
- [ ] Testar entrada idempotente, cópia/snapshot, validações, condicionais, cálculo, recálculo, status, publicação e mensagens de pendência; rodar lint, typecheck, test e build (AC 1–10). Gates locais passaram; integração publicada pendente.
- [ ] Executar Vault e obter confirmação específica antes de qualquer publicação de configuração protegida em produção; registrar versão, backup, diff, verificação posterior e rollback na story. Atualizar checklist e File List (AC 10).
- [ ] Inventariar os dois cards Financeiro de teste, preparar valores fictícios por campo e realizar o preenchimento somente após a implementação/publicação e o checkpoint Vault específico para esse backfill; conferir sem efeitos de cobrança ou envio (AC 11).

## Decisões e dependências

- **Regras tributárias:** o usuário definiu que o Financeiro informa aplicabilidade e alíquotas de IRRF/CSRF. O servidor calcula com esses valores confirmados, sem escolher incidência ou porcentagem pela API de CNPJ. A memória registra entradas, resultados, data e usuário.
- **Origem com parceiro:** `[AUTO-DECISION]` usar vínculo ou opção de origem que a configuração marque como relacionada a parceiro. A lista atual de origens e sua marcação serão inventariadas antes de publicar; não presumir que qualquer indicação exige parceiro.
- **Pagamento:** `[AUTO-DECISION]` “gerar/registrar dados” significa registrar dados conferidos para envio, porque o pedido não informa provedor de cobrança, credenciais ou contrato de integração. Não declarar cobrança automática concluída a partir de um link manual.
- **Fronteira de etapas:** o pedido cita `Aguardando pagamento` como status financeiro, não como nova coluna do pipeline. Confirmar no inventário a identidade desse status antes de publicar. A etapa seguinte permanece `Elaboração de Contrato`.
- **Legado:** `docs/stories/story-financeiro-novo-contrato.md` e `docs/reports/financeiro-novo-contrato-publicacao.md` descrevem publicação no pipeline antigo. `docs/stories/story-financeiro-fluxo-configuravel-sem-legado.md` registra remoção de parte do motor hardcoded. Não reutilizar ID, versão ou regra daquele pipeline como configuração atual.
- **Código a verificar:** fluxo de movimento em `src/lib/bpm/transicao-command.ts`; criação do card vinculado em `src/lib/bpm/automacoes/central-runtime.ts`; campos e composição em `src/actions/bpm/Campos.ts`, `src/actions/bpm/FormulariosEtapa.ts` e `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`; formulário do card em `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`; cliente CNPJ em `src/lib/cnpj/receita-federal.ts`. São pontos de investigação, não afirmação de que já suportam o comportamento.
- **Banco:** configurações de campos/formulário/regras e eventual migração/mutação em massa exigem o checkpoint Vault do `AGENTS.md`: ambiente/banco e comandos/impacto/risco/alternativa/rollback informados, backup completo verificado de até 48 horas em `database-backups/pre-change/` e confirmação específica do usuário antes de executar. Nenhuma autorização anterior para Lost ou Stand By abrange esta publicação.
- **Cards de teste:** o usuário pediu preencher dados faltantes dos dois cards Financeiro de teste com valores fictícios depois de finalizar a configuração. `[AUTO-DECISION]` Não selecionar cards por posição ou presumir que registros vinculados a clientes reais são descartáveis: confirmar identidade e campos alvo no inventário e submeter os valores propostos ao checkpoint Vault antes do backfill. Não preencher antes de concluir e validar o fluxo.

## Inventário e prévia local (28/09/2026)

- Financeiro ativo `cmuih4i54000209gmmyqrg557`, versão 7; Novo Contrato possui 2 campos publicados. Revisão de Radar `cmuih48la000009gmzw3wwuzf`, versão 21; Em tratativas e Fechado possuem formulários ativos.
- `scripts/configurar-novo-contrato-financeiro.mts --preview`: 31 campos no formulário Financeiro, sendo 2 existentes e 29 novos; 16 campos novos comerciais publicados em Em tratativas e Fechado; 18 mapeamentos `COPIAR`. Os dados cadastrais mestre usam fontes `CLIENTE`, `CONTATO`, `CARD` ou `PARCEIRO`; os demais são preenchidos no Comercial antes do fechamento. Os financeiros não têm fonte comercial.
- O campo existente de valor negociado mantém ID e valores, passando a usar a chave estável de valor bruto; a forma de pagamento também mantém ID/valores. `Origem do cliente` é uma seleção nova (`Direto`, `Parceiro`, `Outro`) para tornar configurável a condição de parceiro, preservando o antigo `Canal de origem` livre no Comercial.
- A lista de regimes inclui todos os cinco valores não nulos observados em `Cliente.regimeTributario` mais `Outro`; nenhuma categoria foi inferida de CNPJ para calcular imposto.
- Os cards de teste são `cmuini24h000a09gmadd2zmu0` (Concluído) e `cmulnujrr00060agmrmuf4t8i` (Novo Contrato). O backfill cria somente valores de campos vazios no card, preserva valor negociado/forma já presentes e não altera `Cliente`; o card concluído não recebe status `Aguardando pagamento`.
- Backup dedicado pré-mudança: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-28T20-24-36-883Z.sql` e manifesto adjacente; 179.547.070 bytes, 332 tabelas, 189.528 linhas, SHA-256 `acc0198adcf291f793fed733e7e645a67564d149048f0c4f316fa5b18d9a0995`; restauração de verificação passou. Nenhuma escrita executada.
- Ensaio de integração em cópia local restaurada desse backup passou: configuração transacional chegou a Financeiro v8 e Comercial v22, com 31 campos financeiros, 16 fontes comerciais e 18 mapeamentos. O backfill local preencheu 27 e 26 campos vazios, preservou os dois valores anteriores do segundo card, criou histórico de proveniência em ambos e deixou o card Concluído sem status pendente. A cópia temporária foi removida.
- Gates locais: lint sem erros (avisos preexistentes), typecheck, 551 arquivos/4.044 testes e build passaram. A publicação e teste integrado dependem da autorização Vault.
- QA: `APPROVED` para o patch local após correções de transição e proveniência; produção permanece pendente do Vault.
- **Contexto acumulado:** `accumulated-context.md` e `.aiox/gotchas.json` não estão presentes nesta worktree. `[AUTO-DECISION]` A coerência entre stories foi conferida com os artefatos existentes, sem presumir conteúdo ausente.

## Testes de aceite

1. Fechar negociação em Revisão de Radar cria um único card vinculado em Novo Contrato com dados disponíveis; repetição não duplica nem sobrescreve correção posterior.
2. Retirar cada obrigatório, usar CNPJ/E-mail/CEP/UF inválido, valor zero ou opção inexistente bloqueia o avanço com nomes claros; complemento vazio passa; parceiro ausente bloqueia somente na origem configurada.
3. Consulta CNPJ completa/parcial/falha preenche apenas dados disponíveis que ainda não foram conferidos e mantém edição manual; regime tributário não é inferido sem fonte adequada.
4. IRRF/CSRF em cada combinação Sim/Não, alíquota ausente/inválida e regra ausente produzem cálculo correto ou pendência; mudança de entrada produz nova memória e nenhum resultado obsoleto.
5. Status Aguardando pagamento exige cálculo válido, vencimento e dados de pagamento; não altera status em erro. Transição para Elaboração de Contrato respeita a configuração publicada e a lista de pendências.
6. Alterar configuração pelo editor e publicar muda o comportamento do card/servidor de forma coerente, preservando valores de cards anteriores.
7. Os dois cards de teste identificados recebem apenas os valores fictícios aprovados; verificação posterior mostra o preenchimento, a origem de teste e nenhum envio/cobrança externo.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** principal integração; secundários backend, frontend e configuração de dados; complexidade alta por validações e cálculo.
- **Specialized Agents:** @dev implementa; @architect revisa identidade/snapshot e modelo de regra; @qa verifica cenários; Vault atua antes de mutação protegida; @github-devops atua em PR/deploy.
- **Quality Gates:** Pre-Commit (@dev): lint, typecheck, test, build e revisão; Pre-PR (@github-devops): regressão de handoff e cards históricos; Pre-Deployment (@github-devops): diff de configuração, backup/rollback e verificação de produção.
- **Self-Healing (Story 6.3.3):** @dev light, até 2 iterações/15 min, corrige CRITICAL e documenta HIGH; @qa full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; @github-devops check, apenas reporta. Respeitar o gate real configurado no repositório.
- **Focus Areas:** identidade estável, autorização, idempotência, proteção dos dados comerciais, precisão monetária, ausência de inferência fiscal, configuração publicada, acessibilidade e rollback.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-ativo-novo-contrato-validacao.md` — story e checklist. A implementação deve acrescentar todos os arquivos alterados.
- `scripts/configurar-novo-contrato-financeiro.mts` — prévia e publicação transacional protegida pelo Vault.
- `scripts/preencher-cards-teste-novo-contrato.mts` — prévia e backfill restrito aos dois cards de teste.
- `src/lib/bpm/pipeline-financeiro.ts` — identidades estáveis dos campos.
- `src/lib/bpm/financeiro-config.client.ts` — leitor da chave de valor bruto.
- `src/lib/bpm/novo-contrato-financeiro.ts` — validações e cálculo monetário.
- `src/lib/bpm/validacao-salvamento-configurado.ts` — cálculo no salvamento.
- `src/lib/bpm/transicao-command.ts` — validações e cálculo na transição.
- `src/actions/bpm/Cards.ts` — atribuição do ator à memória de cálculo.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` — origem e estado de conferência dos valores no formulário.
- `tests/bpm/novo-contrato-financeiro.test.ts` — cenários de cálculo e validação.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Draft para o Financeiro ativo recriado e pedido de conferência/cálculo | River (@sm) |
| 2026-09-28 | 0.2 | Inventário, implementação local, backup e prévia protegida; publicação pendente | Codex |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PARTIAL** (identidades atuais e matriz tributária precisam ser inventariadas); referências **PASS**; autossuficiência **PASS**; testes **PASS**; CodeRabbit **PASS**. **Resultado: READY para inventário e implementação local; publicação tributária fica condicionada ao cadastro/validação das regras e ao checkpoint Vault.**
