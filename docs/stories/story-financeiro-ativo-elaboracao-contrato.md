# Story — Financeiro ativo: Elaboração de Contrato

## Status

Ready for Review — implementação e ensaio local concluídos; publicação no Turso depende do checkpoint Vault e de autorização específica. Nenhum card de produção foi alterado.

## Executor Assignment

- Executor: `@dev`
- Quality gate: `@qa`
- Ferramentas do gate: testes automatizados, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e conferência em leitura da configuração publicada.

## Story

**Como** integrante do Financeiro, **quero** elaborar e enviar o contrato com os dados conferidos em Novo Contrato, **para** acompanhar a assinatura e identificar quando alterações posteriores exigirem revisão do documento.

**Escopo atual:** etapa `Elaboração de Contrato` (`draft-stage-945a9c43-8226-48bd-b3c6-65dd5fa79396`) do pipeline Financeiro ativo (`cmuih4i54000209gmmyqrg557`, versão 8 após a publicação de Novo Contrato em 28/09/2026). O inventário informado para esta story indica que a etapa ainda não tem formulário publicado. A origem imediata é `Novo Contrato`, cujos dados cadastrais, serviço, valor bruto, forma de pagamento e condição negociada já são conferidos. O módulo interno de elaboração é **Gerador de Documentos** do Painel Alpha. A story histórica `story-financeiro-elaboracao-contrato.md` pertence a configuração anterior e serve apenas como contexto; seus IDs, automações e estado de publicação não provam o estado desta etapa ativa.

## Campos e regras

| Campo | Tipo e comportamento esperado |
| --- | --- |
| Contrato elaborado | Sim/Não; marcar Sim exige dados da contratação validados. |
| Data de elaboração | Data; obrigatória se elaborado = Sim; preencher automaticamente se vazia na primeira marcação válida. |
| Contrato enviado para assinatura | Sim/Não; Sim exige elaboração válida e referência ao contrato. |
| Data do envio | Data e hora; obrigatória se enviado = Sim; registrar o instante do primeiro envio válido. |
| Link/arquivo do contrato | Referência ao documento do Gerador de Documentos, URL ou arquivo acessível por fluxo autenticado; obrigatório se enviado = Sim. |

O formulário, as regras condicionais, os gatilhos e as ações devem ser configuráveis em **Configurações → Campos e Formulários / Automações**, usando identidades estáveis dos campos. Os cinco campos ficam disponíveis **durante** Elaboração de Contrato. O diálogo de entrada na etapa não deve exigir indicadores que serão preenchidos nela.

## Critérios de aceite

1. [ ] O formulário publicado da etapa ativa apresenta os cinco campos acima na UI do card, com tipos apropriados, rótulos, ordem, visibilidade e obrigatoriedade condicional configuráveis. Valores de cards existentes continuam legíveis. A validação usa a identidade do campo publicado, sem depender de rótulo ou chave da configuração histórica.
2. [ ] Para aceitar `Contrato elaborado = Sim`, o servidor confere CNPJ, Razão Social, Rua, Número, Bairro, CEP, Município, Estado e E-mail completos e válidos, além de Serviço contratado, Valor bruto do contrato maior que zero, Forma de pagamento e Condição negociada definidos. Esses são os valores conferidos em Novo Contrato, inclusive o valor efetivamente negociado. Se algo faltar ou estiver inválido, a marcação é recusada e informa cada pendência pelo nome do campo.
3. [ ] Quando `Contrato elaborado = Sim` é aceito, `Data de elaboração` é obrigatória e, se vazia, é preenchida automaticamente com a data da primeira marcação válida. Data informada previamente é preservada. Regravar o card não altera a data.
4. [ ] `Contrato enviado para assinatura = Sim` só é aceito se `Contrato elaborado = Sim` estiver válido. É necessário `Link/arquivo do contrato` acessível e `Data do envio`. Tentativa de envio sem elaboração ou documento é bloqueada com pendências explícitas; nenhum status ou acompanhamento é criado nessa tentativa.
5. [ ] Na primeira marcação válida de `Contrato enviado para assinatura = Sim`, o sistema registra automaticamente a data **e hora** do envio, define `Status da assinatura = Aguardando assinatura` e cria um acompanhamento da assinatura no mecanismo de tarefas do card. Salvamentos repetidos não mudam o instante original nem duplicam tarefas pendentes. A data/hora registrada deve ser legível no card.
6. [ ] Alteração posterior em qualquer dado cadastral usado no contrato, Serviço contratado, Valor bruto do contrato, Forma de pagamento ou Condição negociada, depois de `Contrato elaborado = Sim`, gera alerta visível e identificável no card para conferir se o contrato precisa de atualização. O alerta indica os campos alterados e não altera silenciosamente o documento elaborado ou já enviado. Deve funcionar também para edição feita fora do formulário desta etapa.
7. [ ] O contrato pode ser criado ou vinculado pelo **Gerador de Documentos** do Painel Alpha quando houver modelo/automação aplicável. A instância usa os valores validados em Novo Contrato e fica vinculada ao card com acesso autorizado. O link ou arquivo dessa instância pode satisfazer o campo `Link/arquivo do contrato`. Geração repetida respeita a regra configurada e não cria instâncias duplicadas para o mesmo evento. Se não houver modelo aplicável, elaboração e registro manual continuam possíveis. Não se presume provedor externo de assinatura nem envio externo sem integração configurada.
8. [ ] As automações da etapa aparecem na UI de **Automações** como **ativas e publicadas**, com gatilhos/condições e ações conferíveis: preencher data de elaboração, registrar data/hora do envio, alterar status para `Aguardando assinatura`, criar acompanhamento, alertar mudança relevante e acionar o Gerador de Documentos quando aplicável. Estar apenas implementada em código ou listada como rascunho não satisfaz este critério. Alterações administrativas válidas na configuração passam a reger o comportamento do servidor.
9. [ ] A transição real de `Elaboração de Contrato` para a próxima etapa publicada aplica no servidor os requisitos de saída configurados e informa pendências nominais. Entrar em Elaboração não exige elaboração/envio já concluídos. O envio inicia a espera por assinatura; esta story não presume assinatura concluída como pré-condição para sair sem que uma regra publicada a exija.

## Tarefas / subtarefas

- [x] Inventariar em leitura o Financeiro ativo v8, a etapa sem formulário nem cards, campos compartilhados, catálogo de automações e modelo RADAR ativo no Gerador (AC 1, 7–9).
- [x] Preparar publicação dos cinco campos, status de assinatura somente leitura e formulário com condicionais; nenhum valor/card existente é modificado pelo script (AC 1–4). Aplicação em produção pendente.
- [x] Conectar validação no salvamento e na transição, com lista de pendências, datas automáticas idempotentes e referência de anexo vinculada ao card/campo (AC 2–5, 9).
- [x] Preparar 18 automações com versões ativas de datas, status/tarefa, alertas e Gerador de Documentos; ensaio em cópia local confirmou a publicação e o vínculo seguro do documento foi revisado (AC 5–8). Aplicação em produção pendente.
- [x] Testar validação de dados, envio, datas, vínculo de documento e visualização de pendências do rascunho. Alteração posterior no card Financeiro usa gatilhos de campo do motor central (AC 2–8).
- [x] Rodar lint, typecheck, suíte completa e build; criar backup Vault dedicado e ensaiar a transação em cópia restaurada (AC 1–9). Autorização e publicação em produção pendentes.
- [ ] Aplicar configuração após autorização específica, conferir campos/requisitos/automações ativos na UI/banco, atualizar este registro e realizar smoke autenticado sem alterar card real.

## Dev Notes

- `docs/stories/story-financeiro-ativo-novo-contrato-validacao.md`: descreve os campos e a publicação da etapa predecessora no pipeline ativo. A etapa atual deve consumir os valores que foram conferidos ali, sem criar outra fonte para valor/contratação.
- `docs/stories/story-financeiro-elaboracao-contrato.md`: documenta a implementação antiga e demonstra cuidados com entrada prematura, datas, tarefa e integração. Não reutilizar suas evidências de produção para afirmar que a nova etapa está configurada.
- `src/lib/bpm/pipeline-financeiro.ts`: chaves estáveis dos dados de Novo Contrato. `src/lib/bpm/validacao-salvamento-configurado.ts` e `src/lib/bpm/transicao-command.ts`: pontos a verificar para validação no servidor. `src/lib/bpm/automacoes/central-runtime.ts`, `src/lib/bpm/automacoes/executor.ts` e `src/lib/bpm/automacoes/catalogo-modulos.ts`: suporte existente a `CRIAR_TAREFA` e `GERAR_CONTRATO`; inventariar antes de reutilizar.
- `[AUTO-DECISION]` O campo `Data do envio` representa data e hora porque a automação requerida registra ambos. Um documento interno vinculado, URL válida ou arquivo autenticado pode satisfazer a referência, conforme o tipo configurável suportado pelo sistema.
- `[AUTO-DECISION]` “Acompanhamento da assinatura” é uma tarefa interna do card, sem enviar mensagens ou contratos a terceiros. O pedido identifica o Gerador de Documentos interno, mas não fornece contrato de integração com assinador externo; integração externa só se aplica se já estiver configurada.
- O Gerador cria para serviço RADAR um rascunho `CONFERENCIA` ao entrar na etapa, usando os dados conferidos em Novo Contrato. O anexo gerado é ligado ao campo `Link/arquivo do contrato`; a prévia mostra variáveis do modelo ainda pendentes. Não há envio ao assinador externo. A data de assinatura permanece desconhecida antes da assinatura.
- Os 15 alertas cobrem alterações nos valores do próprio card Financeiro depois da elaboração, inclusive em outra etapa do mesmo pipeline. Mudanças diretas no cadastro mestre ou no card Comercial de origem não alteram o snapshot financeiro e não emitem esse alerta. Se dados e a primeira marcação de elaboração forem salvos na mesma atualização, o motor pode mostrar um alerta redundante.
- `accumulated-context.md` e `.aiox/gotchas.json` não existem nesta worktree. A coerência entre stories foi conferida com os artefatos acessíveis acima.

## Testes de aceite

1. Sem qualquer obrigatório ou com CNPJ/E-mail/CEP/UF/valor inválido, tentar marcar elaborado falha e nomeia os campos; com dados válidos, marca Sim e registra data uma vez.
2. Enviar sem elaboração ou sem documento falha sem mudar status/criar tarefa. Com elaboração e documento válido, grava data/hora, status e uma tarefa; repetição não duplica nem muda o instante.
3. Alterar dado relevante depois da elaboração exibe alerta e preserva o contrato; alterar campo irrelevante não gera alerta indevido.
4. Modelo aplicável do Gerador produz/vincula documento com dados conferidos e acesso pelo card; sem modelo, fluxo manual continua; tentativa sem permissão não expõe documento.
5. UI administrativa mostra todas as automações esperadas ativas e publicadas. Simular desativação/configuração em ambiente de teste comprova que o runtime respeita a publicação.
6. Entrada em Elaboração com indicadores ainda vazios é permitida; saída respeita as regras publicadas e mostra pendências nominais.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** integração interna, backend, frontend e configuração de dados; complexidade alta pela validação contextual, documentos e idempotência.
- **Specialized Agents:** `@dev` implementa; `@qa` revisa cenários e regressões; `@architect` revisa identidade de campo/eventos; `@ux-expert` revisa formulário e alerta; Vault revisa mutação protegida; `@github-devops` conduz publicação quando autorizada.
- **Quality Gates:** Pre-Commit (`@dev`): lint, typecheck, testes, build e revisão. Pre-PR (`@github-devops`): compatibilidade de cards antigos, autorização e idempotência. Pre-Deployment (`@github-devops`): configuração ativa, evidência Vault e rollback.
- **Self-Healing (Story 6.3.3):** `@dev` light, até 2 iterações/15 min, corrige CRITICAL e documenta HIGH; `@qa` full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; `@github-devops` check, apenas reporta.
- **Focus Areas:** validação por identidade publicada, entrada versus saída, instante único do envio, tarefa única, mudanças posteriores, permissão do documento e automações realmente ativas na UI.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-ativo-elaboracao-contrato.md` — story, checklist, inventário e plano Vault.
- `scripts/configurar-elaboracao-contrato-financeiro-ativo.mts` — prévia e publicação transacional protegida pelo Vault.
- `src/lib/bpm/validacao-salvamento-configurado.ts` — validação antes de elaborar/enviar e datas automáticas.
- `src/lib/bpm/transicao-command.ts` — aplica validação da etapa ao avançar.
- `src/actions/bpm/Cards.ts` — executa automações após salvar campos financeiros.
- `src/lib/bpm/automacoes/schemas.ts` — campo de destino opcional na ação Gerar contrato.
- `src/lib/bpm/automacoes/executor.ts` — vincula anexo gerado ao campo do contrato sem sobrescrever valor existente.
- `src/lib/bpm/automacoes/central-runtime.ts` — notifica a atualização do card após gerar contrato.
- `src/app/api/bpm/anexos/[anexoId]/preview/route.ts` — informa pendências do modelo padrão no rascunho.
- `src/components/bpm/anexos/VisualizadorAnexoCard.tsx` — mostra pendências do rascunho.
- `tests/bpm/validacao-salvamento-configurado.test.ts` — cenários de validação e datas.
- `tests/bpm/anexo-preview-route.test.ts` — prévia autenticada com pendências.
- `tests/bpm/excluir-card-action.test.ts` — preserva constantes reais no mock do Financeiro.

## Evidências locais e plano Vault (28/09/2026)

- Inventário somente leitura: Financeiro ativo v8; etapa `draft-stage-945a9c43-8226-48bd-b3c6-65dd5fa79396` sem formulário, campos, requisitos ou cards; template RADAR padrão ativo `cmthgdqel00000akvfblyma6y` e contratada ativa identificados. A etapa Novo Contrato contém os campos validados que serão reutilizados.
- Prévia do script: 6 campos (5 solicitados e status de assinatura), 14 requisitos de conferência dos dados da etapa anterior mais 3 regras, 18 automações (15 alertas, data de elaboração, envio/status/tarefa e Gerador RADAR). O Gerador cria rascunho quando serviço contratado contém Radar; formulário/automação ficam editáveis nas UIs de configuração existentes.
- Backup completo dedicado em `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-28T21-45-54-109Z.sql` e manifesto adjacente: 179.973.936 bytes, 332 tabelas, 190.472 linhas, SHA-256 `4847df280422928b70da4096a51b3cd56942fe92909f6351ab47bcaf90abe4b4`; restauração, integridade, FK e contagem de linhas verificadas. Não versionar dump/manifesto.
- `prisma migrate diff --script` retornou migração vazia; nenhuma alteração de schema é proposta. Ensaio transacional em cópia restaurada chegou a Financeiro v9, 1 formulário, 6 configurações de campo, 17 requisitos, 18 automações e 18 versões `ATIVA`. A cópia temporária foi removida.
- Gates: lint sem erros (1.191 avisos existentes), typecheck, 553 arquivos/4.060 testes e build passaram. QA aprovou o patch local, com ressalva do alerta redundante quando dados e elaboração são salvos na mesma atualização.
- Comando de produção previsto: `npx tsx scripts/configurar-elaboracao-contrato-financeiro-ativo.mts --apply --approval=AUTORIZO_ELABORACAO_FINANCEIRO_ATIVO --expect-financeiro=8 --admin-id=1 --backup=<dump verificado> --manifest=<manifesto>`; nenhuma escrita antes de confirmação específica. Rollback preferencial: desativar as 18 automações/requisitos e retirar a composição nova depois de avaliar possíveis respostas de cards; restauração integral do dump é último recurso porque sobrescreveria escritas posteriores.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Draft da etapa ativa com campos, validações, Gerador de Documentos e automações publicadas | River (@sm) |
| 2026-09-28 | 0.2 | Implementação local, ensaio transacional, backup Vault e gates; publicação pendente | Codex |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PASS** para início do inventário, com IDs reais de campos/modelos a confirmar; referências **PASS**; autossuficiência **PASS**; testes **PASS**; CodeRabbit **PASS**. **Resultado: READY para inventário e implementação local.** Publicação no Turso depende de checkpoint Vault específico.
