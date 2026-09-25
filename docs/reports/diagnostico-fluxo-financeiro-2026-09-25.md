# Diagnóstico do fluxo do pipeline Financeiro — 25/09/2026

> **Atualização da implementação local (25/09/2026):** as seções abaixo descrevem o estado encontrado no HEAD antes da retirada do legado. O código ainda não foi publicado. O estado após a correção e as pendências estão em “Resultado da intervenção local”, ao final.

## Escopo e evidência

Auditoria somente leitura do código local (HEAD `18d67b7d`) e da configuração ativa no Turso. Nenhum card, campo, transição ou dado foi alterado. O código local da segunda etapa ainda não tem evidência de deploy ou smoke autenticado. Há três cards ativos, todos em `Solicitação de Contrato`; por isso as etapas posteriores foram conferidas por código e configuração, não por movimento real de card.

## Caminho efetivo

`SalvarRequisitosEMoverCardBpm`/`MoverCardBpm` → `executarMovimentoCanonico` (`src/actions/bpm/Cards.ts`) → `executarTransicaoBpm` (`src/lib/bpm/transicao-command.ts`) → requisitos e campos publicados → `validateCanonicalFinancialTransition` (`src/lib/bpm/pipeline-financeiro.ts`) → gravação, histórico e automações centrais.

A função `executarMovimentoLegadoDesativado` em `Cards.ts` não é chamada no movimento atual; `validateFinancialTransition` valida por **rótulos**, mas só é chamada nesse bloco morto. Logo, retirar apenas essa função não resolve os bloqueios atuais. O validador **canônico**, que roda em produção quando esta versão estiver publicada, também contém requisitos fixos por etapa.

## Estado publicado e transições

| Etapa | Formulário publicado | Saída exigida pelo validador canônico | Desalinhamento |
| --- | --- | --- | --- |
| Solicitação de Contrato | 31 campos, versão 5; 35 configurações ativas, quatro fora da composição | Cadastro, serviço, valor, forma, condição, vendedor, origem e validações de formato; parceiro e tributos condicionais | Regras codificadas por chave; quatro campos ativos ocultos. Três chaves `alpha.legacy.*` inativas ainda configuradas, mas não exigidas pelo caminho canônico. |
| Elaboração do Contrato | Cinco campos, versão 2 | Elaboração e envio `Sim`, datas, referência do contrato e pré-requisitos da etapa anterior | Correção local no commit `18d67b7d`; sem card nessa etapa e sem smoke autenticado. `Data do envio` é campo `data`; hora completa fica no histórico. Não há automação ativa `GERAR_CONTRATO` para esta etapa. |
| Formalização | 23 campos, versão 2 | Assinatura `Assinado`, contrato anexado, regimes, pagamento, IRRF/CSRF, valor bruto e cálculo | O formulário apresenta conceitos duplicados com chaves diferentes; só a versão `alpha.financeiro.*` é lida pelo validador. |
| Confirmação de Pagamento | Oito campos, versão 2; uma chave antiga inativa | Confirmação, valores esperado/recebido positivos e forma de pagamento | Formulário mostra dois tipos de comprovante; nenhum é exigido pela saída. Data do pagamento é preenchida no avanço. `Pagamento no êxito` não participa da guarda. |
| Emissão da Nota Fiscal | Cinco campos, versão 2 | Emissão `Sim`, número, data, valor positivo, arquivo/link e confirmação anterior | Nome de anexo contendo `nota` ou `nf` também satisfaz arquivo, sem vínculo explícito com o campo. |
| Contratação Finalizada | 13 campos, versão 2 | Sem próxima etapa | Seis campos marcados obrigatórios no formulário não são cobrados na entrada, pois `obrigatorioEntrada=false`. Há transições de retorno permitidas na configuração, mas o validador financeiro impede qualquer saída desta etapa. |

Nenhum campo das seis etapas usa `obrigatorioEntrada`, `obrigatorioSaida` ou condição de obrigatoriedade. Os requisitos antigos observados estão inativos. Assim, o administrador consegue editar formulários, mas não consegue reproduzir ou ajustar a maior parte das condições efetivas de avanço sem alterar código. A configuração de transições também diverge da sequência fixa de seis etapas no validador.

## Achados prioritários

1. **Fonte dupla de regras (alta).** `transicao-command.ts` aplica configurações de `BpmCampoEtapaConfig`/`BpmRequisito`, mas sempre chama `validateCanonicalFinancialTransition`, que tem seis etapas, campos e condições escritos no código. Um campo preenchido e publicado pode continuar bloqueado por outra chave; uma alteração feita no editor pode não alterar a política real. A resposta nominal usa o nome do campo associado à chave fixa, o que dificulta enxergar essa diferença.
2. **Duplicidade de dados em Formalização (alta).** `Status da assinatura` (`alpha.status.da.assinatura`), `Status do contrato` (`alpha.status.do.contrato`) e `Status do contrato/assinatura` (`alpha.financeiro.status.contrato.assinatura`) aparecem juntos; o último controla o avanço. `Valor do IRRF` e `Valor IRRF`, `Valor do CSRF` e `Valor CSRF`, `Valor líquido a pagar` e `Valor líquido para pagamento` também duplicam conceitos. As versões duplicadas não canônicas estavam sem valores de card na leitura; as canônicas de cálculo já tinham três valores. Não desativar nem migrar em produção sem inventário e checkpoint de banco.
3. **Regra tributária aceita ausência como zero (alta).** Na saída de Formalização, `numero(null)` devolve zero e a condição `>= 0` aceita alíquota vazia quando IRRF/CSRF = Sim. A primeira etapa usa `numeroDeclaradoValido`, mas o teste da terceira etapa é inconsistente. O cálculo pode registrar retenção zero sem alíquota declarada.
4. **Datas podem declarar evento não ocorrido (média).** `Data da assinatura` é criada ao mover Formalização → Pagamento mesmo sem data de assinatura informada. `Data do pagamento` é criada ao mover Pagamento → NF. A data fica associada ao movimento, não necessariamente ao evento real. `today` no validador usa UTC; a elaboração usa o dia local de São Paulo.
5. **Referências de arquivo por nome (média).** Um anexo cujo nome contém `contrato`, `nota` ou `nf` pode satisfazer a guarda sem prova de que corresponde ao documento do campo e da etapa. Isso precisa ser vinculado ao registro/arquivo correto para impedir avanço indevido.
6. **Proteção de calculados por rótulo (média).** `AtualizarCardBpm` em `Cards.ts` e `automacoes/distribuicao-oportunidades.ts` chamam `campoFinanceiroSomenteLeitura(campo.nome)`. Renomear o campo publicado pode enfraquecer a proteção; a transição já usa chave estável para essa regra.
7. **Preset destrutivo ainda exportado (alta, latente).** `ConfigurarPipelineFinanceiro` em `src/actions/bpm/PipelineFinanceiro.ts` identifica pipeline/etapas/campos por nome, pode mover cartões em massa de etapas excedentes, desativá-las e sobrescrever as 30 transições. O botão que o chama não apareceu montado em nenhuma página na busca atual, mas a Server Action continua exportada. Não executar esse preset sobre a configuração atual.
8. **Código morto confunde manutenção (média).** `executarMovimentoLegadoDesativado` em `Cards.ts` ainda contém validação por rótulo, automações manuais e semântica anterior de campos obrigatórios. `validateFinancialTransition`, `hasConfiguredFinancialPipeline` e `FINANCIAL_FIELDS` conservam dependência de nomes. Remover o caminho morto após regressão do comando canônico; manter apenas constantes de domínio que sejam realmente usadas.
9. **Snapshot do valor negociado tem fallback mutável (média).** O validador usa `Valor bruto do contrato` ou, se vazio, valor global da origem. Para card sem snapshot, mudança posterior no valor global pode afetar cálculo/contrato. A compatibilidade precisa ser explicitada e validada em cards históricos antes de retirar esse fallback.

## Fluxo alvo derivado dos requisitos existentes

1. `Solicitação`: validar cadastro e contratação; gravar valor contratado estável no card; explicar cada pendência pelo campo visível.
2. `Elaboração`: permitir marcar elaboração apenas com dados anteriores válidos; data automática estável; envio somente após elaboração com referência do contrato; registrar instante do envio, status `Aguardando assinatura`, acompanhamento e alerta de alteração posterior. Usar o Gerador de Documentos quando houver automação/template configurado; o caminho manual continua.
3. `Formalização`, `Pagamento` e `NF`: manter a sequência existente e suas invariantes de negócio; alinhar cada condição ao campo canônico exibido, definir os eventos reais para datas e referências de documentos. A decisão de obrigatoriedade dos comprovantes e de `Pagamento no êxito` ainda não consta dos requisitos examinados.
4. `Finalizada`: tornar coerente a configuração das transições de retorno e a obrigatoriedade na entrada com a política aprovada para reabertura. Não inferir reabertura apenas das transições atualmente gravadas.

## Ordem segura de correção

1. Criar uma story específica para saneamento do fluxo completo, com critérios por etapa. A story existente `story-financeiro-elaboracao-contrato.md` cobre só a segunda etapa; `story-rm-2026-dbef25-remover-regras-financeiras.md` descontinua outro módulo e preserva expressamente o validador canônico.
2. Fixar inventário `chave → campo ativo → componente publicado → valor histórico` e escolher uma identidade por conceito. Corrigir o bug da alíquota e a proteção por chave com testes de transição.
3. Remover a função de movimento morta e o validador por rótulos; desativar/retirar com segurança o preset `ConfigurarPipelineFinanceiro`. Preservar o comando canônico e as regras de contrato da segunda etapa.
4. Reconciliar formulários, requisitos, transições e automações na configuração persistida; usar as chaves canônicas já ativas e preservar leitura histórica. Para alterar estrutura, configuração persistida em massa ou migrar valores: Vault, backup completo verificado de até 48 horas, plano de rollback e confirmação explícita específica antes de qualquer escrita.
5. Executar regressões de salvar/mover em cada etapa, inclusive legado e anexos, e smoke autenticado dos três cartões da primeira etapa sem movimentá-los sem autorização operacional. Depois rodar lint, typecheck, testes e build.

## Limites da verificação

Não houve movimento real, edição de cartão, deploy ou mutação de configuração. Só há cartões na primeira etapa; por isso os bloqueios das etapas posteriores são inferidos diretamente do código e da configuração publicada. A correção local de Elaboração já está commitada, mas sua publicação não foi confirmada nesta auditoria.

## Resultado da intervenção local

- O movimento manual e o `MOVER_CARD` das automações agora passam pelo mesmo comando de transição. O validador financeiro fixo, o caminho morto de movimento por rótulos, o preset de reconfiguração do Financeiro e os hooks financeiros de salvamento foram retirados. As arestas, campos publicados, requisitos e regras genéricas decidem o avanço. O controle antigo para a automação ignorar requisitos saiu do editor; parâmetros antigos são aceitos apenas para leitura compatível e não dispensam validação.
- Requisitos vinculados a `campoId` voltaram a ser carregados quando o campo está ativo e publicado. Condições de obrigatoriedade podem ser editadas e publicadas no formulário, com checagem das referências. A avaliação de regras no movimento recebe também os valores enviados na própria tentativa de transição.
- O editor e o servidor permitem configurar obrigatoriedade condicional por identidade de campo. A automação `ALTERAR_CAMPO` passou a validar tipo e pertinência do campo ao pipeline. Os placeholders `agora.data` e `agora.instante` permitem configurar datas de eventos em automações; a idempotência e a preservação do primeiro registro ainda devem ser avaliadas em cada automação publicada.
- Simulação somente leitura com os três cartões ativos na primeira etapa e a configuração atual: a transição para `Elaboração do Contrato` foi aceita para os três, sem pendências. Nenhum cartão foi movido. Como não há cartões nas etapas seguintes, o comportamento delas exige teste controlado posterior.
- **Configuração ainda pendente:** requisitos antigos estão inativos e não há automações publicadas para reproduzir toda a política anterior. Portanto elaboração/envio, acompanhamento de assinatura, alertas, cálculo tributário, datas de eventos e documentos só estarão completos depois da configuração campo a campo e dos testes correspondentes. A regra de cálculo existente no motor genérico ainda não substitui automaticamente a memória do cálculo financeiro removido.
- **Inventário antes da limpeza física:** quatro campos inativos `alpha.legacy.*` e quatro configurações associadas, sem valores, anexos, componentes, requisitos ou mapeamentos na auditoria do Vault. Esses oito registros foram removidos após autorização específica, conforme o resultado ao final. Duplicidades ativas de Formalização e Pagamento permanecem para reconciliação posterior, preservando histórico.
- A consulta opcional de CNPJ da primeira etapa ainda usa mapeamento de chaves para preencher cadastro. Ela não define obrigatoriedade nem bloqueia avanço. As regras de autenticação, integridade e autorização genéricas do BPM continuam aplicáveis.
- Gates locais: `npm run lint` (sem erros), `npm run typecheck`, `npm test` (510 arquivos, 3.837 testes aprovados), `npm run build` e 72 testes direcionados passaram. A primeira execução paralela de testes/typecheck com o build falhou por arquivos gerados concorrentes; as repetições isoladas passaram. `git diff --check` passou.
- As duas tentativas de exportação SQL pelo Turso falharam. O Vault então criou um backup binário dedicado da réplica sincronizada em `database-backups/pre-change/painelalpha_turso_pre_change_financeiro_legacy_4_2026-09-25T17-14-14-423Z.db` (169.885.696 bytes, SHA-256 `1eeedafc6e4f3887b8f6f79c8cb235e5f43fcfe0e531552cb479ee85d631a19d`). A restauração em cópia local passou: 331 tabelas, 171.118 linhas, `integrity_check=ok`, zero violações de chave estrangeira e os quatro campos legados presentes. Um snapshot seletivo dos quatro campos e configurações também foi preservado. O backup foi concluído antes da escrita autorizada descrita abaixo.

### Plano de limpeza física pendente de confirmação

> **Executado após autorização explícita do usuário em 25/09/2026.** O plano abaixo registra o escopo e as salvaguardas aplicadas.

- **Ambiente e banco:** produção, Turso `banco-alpha-alphacomex.aws-us-east-1.turso.io`, pipeline `cmsd9yw74000adzggrw91um3j`.
- **Alvo exato:** quatro `BpmCampo` inativos com chave `alpha.legacy.*`: `cmt36ivlv0009kw0ahb5x0en4`, `cmt36ivoe000zkw0ay6otrlc8`, `cmt36ivp50015kw0axn2uwmh4`, `cmt36ivve002pkw0a82cim2ge`. A exclusão em cascata prevista remove suas quatro `BpmCampoEtapaConfig`. Outros campos, inclusive duplicidades ativas, ficam para a etapa de configuração campo a campo.
- **Passos planejados:** em transação, reler IDs, pipeline, chaves, estado inativo e todas as referências; abortar diante de qualquer valor, anexo, componente, requisito, mapeamento ou contagem divergente; excluir somente os quatro IDs com filtros de pipeline/chave/inatividade; exigir `count=4`; conferir ausência deles e preservar campos canônicos, formulários e arestas. Depois repetir simulação somente leitura das transições.
- **Impacto e risco:** remoção irreversível por CRUD normal de quatro definições inativas e quatro configurações; dependência criada após o snapshot, cascata inesperada ou indisponibilidade lógica do formulário são riscos. As travas de pré-execução abortam a operação nesses casos. Alternativa sem exclusão: manter os quatro registros inativos, que já não participam do fluxo publicado.
- **Rollback:** recriar seletivamente os quatro campos e as quatro configurações com IDs originais a partir de `database-backups/pre-change/financeiro-legacy-campos-4-snapshot-2026-09-25T17-05Z.json`, em transação, após validar conflitos. O backup completo permite recuperação em banco isolado; uma restauração global exigiria plano separado pelo impacto em dados posteriores.

### Resultado da limpeza autorizada

- O hash SHA-256 e tamanho do backup dedicado foram conferidos imediatamente antes da escrita. A transação releu os quatro IDs, pipeline, chaves e inatividade; conferiu 13 relações por chave estrangeira: apenas quatro `BpmCampoEtapaConfig`, uma por campo, e zero nas demais. O `DELETE` filtrado por IDs, pipeline, inatividade e prefixo `alpha.legacy.*` removeu exatamente quatro `BpmCampo`; a cascata removeu exatamente quatro configurações. A transação confirmou ausência dos oito registros antes do commit.
- Consulta independente após o commit: zero campos `alpha.legacy.*` e zero configurações associadas no pipeline. Comparação com o backup: 55 campos ativos, seis etapas ativas, três cartões ativos e 30 arestas antes e depois. Nenhum card foi editado ou movido.
- Simulação somente leitura após a limpeza: os três cartões ativos na primeira etapa continuam aptos a avançar para `Elaboração do Contrato` com a configuração publicada atual; três resultados `success=true`, sem pendências. As regras de elaboração, envio, assinatura, cálculo e documentos ainda precisam da configuração campo a campo descrita acima.
