# Correções dos fluxos de edição e salvamento

Entrega autorizada em 26/10/2026, a partir da [auditoria de salvamento](auditoria-salvamento-sistema-2026-10-26.md). A implementação foi organizada na [story de correções](../stories/story-correcoes-salvamento-sistema-20261026.md).

## Escopo implementado

| Achado | Tratamento |
| --- | --- |
| S01 | Autosave de Notas serializado por revisão. Identidade UUID por sessão e comparação de token, snapshot e base protegem rascunhos de outra instância contra respostas antigas. |
| S02 e S03 | O CheckList reformulado já publicado em staging usa patch parcial, revisão, identidade da operação, transação e confirmação da interface. Essa implementação foi preservada no candidato, com testes próprios; o código legado do checkout antigo não foi reintroduzido. |
| S04 | Arquivar/lixeira aguardam o salvamento do editor e só encerram a nota após confirmação positiva. Negativa e exceção preservam conteúdo e rascunho. |
| S05 | Procedimentos do CRM preservam observações dos outros itens, controlam versão e integram rascunhos e salvamento de saída ao contexto do card. |
| S06 | Anotação simples participa da fila, das pendências e da recuperação. A chave muda quando o texto realmente muda e permanece no retry sem edição, inclusive após remontagem; anotação e histórico são transacionais. |
| S07 | Rascunhos locais do CRM são separados por usuário, conservam base, exigem revisão após recuperação e avisam sobre saída. Token por edição protege rascunhos de outra aba contra confirmações/limpezas antigas. |
| S08 | Notas retomam pendências ao reconectar, oferecem nova tentativa e resolução explícita de conflito. Versão e histórico são confirmados na mesma transação. |
| S09 | Tarefas verificam resultados, inclusive na recorrência; falhas mantêm formulário. Opcionais omitidos são preservados; consultas recebem parâmetros e alterações conferem registros afetados. A leitura normaliza as flags SQLite para booleanos, mantendo a edição compatível entre drivers. |
| S10 | Escritas legadas validam sessão, usuário ativo, permissões atuais e acesso ao alvo no servidor. As regras legítimas dos módulos foram mantidas. |
| S11 | Reservas validam intervalo no cliente e servidor; teste de sobreposição e escrita são um único comando parametrizado, evitando a janela entre consultar e gravar. |
| S12 | Cadastro mestre e histórico são transacionais; o modal libera o estado ocupado em exceções e continua identificando resultados parciais do conjunto. |
| S13 | Limpar campos opcionais do pré-cadastro envia intenção explícita de limpeza, respeitando colunas obrigatórias existentes. |
| S14 | Blueprint tem criação idempotente, CAS por timestamp, histórico transacional, fila por revisão, rascunho por usuário e resolução de conflito. Tokens protegem contra resposta antiga de outra instância. |
| S15 | Renomear nota pela aba persiste o título e usa a fila do editor ativo para preservar texto pendente. |
| C01 | O usuário escolheu permitir edição dos dados existentes nas cinco etapas sem formulário. O fallback se aplica somente quando não há formulário nem composição canônica e expõe apenas campos já registrados no próprio card e revalida contexto, pipeline, ACL, visibilidade, leitura e mapeamentos. Não publica campos ou formulários nem cria requisitos/defaults. |

## Integração com o staging vigente

O checkout auditado estava 87 commits atrás da referência remota. O candidato de publicação foi criado sobre `aca95ddb402da03a5d58b7833a04bd99b018e537` e atualizado sem conflitos para `b115dd3802485e9b0a049f2a45a5010db77338b5`, preservando o CheckList reformulado, as condições de campos e a proteção global de saída do painel. As correções são integradas por escopo, com revisão das divergências; alterações concorrentes de outras tarefas não pertencem à entrega.

Antes da publicação conjunta, `staging` avançou para `4d949d4c4a6644303885e907b1af86b88a4c4284`, que já continha a primeira entrega por merge. O candidato preservou essa atualização de resiliência de sessão/indisponibilidade de banco por merge normal, sem conflitos. Os sete arquivos dos fixes adicionais conservaram seus hashes. Os quatro pontos compartilhados — layout autenticado, anexos e dois painéis de tarefas — conservaram as alterações remotas; identidade do provider, fallback C01 e controles de edição foram conferidos. A nova base altera infraestrutura e configuração de testes, exigindo gates próprios na árvore integrada; o resultado anterior de 796 arquivos não é atribuído automaticamente a esse novo conjunto.

O provider global do card recebe a identidade autenticada do layout principal e reinicia o estado ao trocar de usuário. As guardas de navegação e o salvamento em background já publicados foram preservados.

## Validação e publicação

Na base `b115dd3802485e9b0a049f2a45a5010db77338b5`, lint e tipos passaram sem erros; o lint conserva 1.172 avisos. A suíte completa aprovou **795 arquivos e 6.631 testes**, com quatro casos ignorados e um pendente preexistentes. O build de staging gerou 86 páginas. A [evidência dos gates](../qa/evidencias/correcoes-salvamento-20261026/gates.json) registra comandos, exits, cobertura e limites.

A execução final usou um worker, diretório temporário exclusivo e orçamento de 15 segundos por teste. O limite padrão de cinco segundos havia interrompido um teste antigo que restaura backups fictícios repetidamente; esse mesmo caso passou isolado em 974 ms. Também foi corrigido o destino temporário herdado, que apontava para um disco cheio. Assertions, casos e limites explícitos dos hooks foram mantidos.

O build foi executado com as duas variáveis Turso de staging verificadas e dependências isoladas. A primeira tentativa externa encontrou duas árvores de Next/React; o container de saída foi corrigido, sem alteração da aplicação, e a configuração gerada foi restaurada byte a byte. Testes de concorrência, rollback e idempotência usam SQLite temporário e dados fictícios; testes de componente usam dependências simuladas.

O audit de dependências registra débito anterior: 114 achados, incluindo 10 críticos, com manifesto e lock idênticos à base remota. Isso não constitui aprovação do audit; a entrega não alterou o grafo. A revisão independente não mantém achados de código abertos.

A primeira versão de código foi publicada como `fb0e8546d75e95f96e780f2049b43d75f6466e15`, deployment `dpl_BCXiMgDkxmJ7Sda528NqvEH3e7ek`, READY no alias staging. Foram homologados os percursos de [Notas e Blueprint](../qa/homologacao-notas-blueprint-salvamento-staging-20261026.md), [CRM](../qa/homologacao-crm-salvamento-staging-20261026.md) e [Reservas](../qa/homologacao-reservas-salvamento-staging-20261026.md), com releitura independente e limpeza dos registros próprios pela UI. O card próprio foi arquivado; os cards anteriores permaneceram intactos. A [leitura das cinco etapas sem formulário](../qa/homologacao-c01-salvamento-staging-20261026.md) encontrou todas vazias: salvar nesses formulários permanece sem comprovação visual por ausência de fixture.

A homologação real de Tarefas identificou um problema adicional: a criação e reabertura funcionavam, mas a edição era recusada porque as flags de uma leitura SQL do Turso chegavam como `0/1` e o contrato de edição exige booleanos. A correção mantém a validação estrita e normaliza a resposta de leitura. O adaptador reproduziu dois casos falhos antes do ajuste; depois passaram 30 casos focados e o ciclo criar → buscar → editar → concluir em SQLite real.

A segunda rodada aprovou **795 arquivos e 6.635 testes**, com os mesmos quatro ignorados e um pendente, além de lint, tipos e build de 86 páginas. A [evidência da correção adicional](../qa/evidencias/correcoes-salvamento-20261026/gates-pos-homologacao-tarefas.json) separa esse resultado da primeira versão. Essa rodada foi preservada como histórico do candidato, antes da revisão conjunta final.

A revisão final reproduziu ainda dois casos entre instâncias: colisão de identificador de sessão de Notas e reaproveitamento da chave de uma anotação em voo depois de remontar e editar seu texto. As correções adotam UUID por sessão, verificação completa da propriedade do rascunho e chave nova somente quando há mudança real do texto; retry sem edição mantém sua identidade. As regressões foram reproduzidas antes do ajuste e o conjunto focado aprovou 13 arquivos/87 casos.

A rodada conjunta final aprovou **796 arquivos e 6.645 testes**, com quatro ignorados e um pendente preexistentes. Lint: zero erros/1.172 avisos; tipos: exit 0 antes e depois do build; build: exit 0, 86 páginas, ambiente staging verificado. Os [gates conjuntos](../qa/evidencias/correcoes-salvamento-20261026/gates-conjunto-final.json) registram os sete arquivos congelados, comandos, exits e hashes. A publicação conjunta e os três retestes dirigidos ainda serão registrados após o novo READY; não há alegação de aprovação visual dos novos fixes antes desses percursos.

A árvore integrada `fd603144caa660eb8fdf9ab1216a781acf08603e` aprovou **804 arquivos e 6.700 testes** (quatro ignorados e um pendente), lint sem erros/1172 avisos, tipos e build de 86 páginas. Os [gates da integração vigente](../qa/evidencias/correcoes-salvamento-20261026/gates-integracao-staging.json) separam o snapshot anterior, o diagnóstico do secret sintético exigido pela fixture de auth e a execução final. O secret de teste foi usado somente no subprocesso Vitest, sem credenciais reais e sem repasse ao build ou staging. O preparo de uma fixture SQLite também excedeu o hook explícito de 30 segundos sob cobertura; seus 11 casos passaram isolados em 5,22 segundos. Somente esse timeout de preparação passou para 60 segundos, com revisão de QA, preservando asserts, casos, seeds e demais hooks. Não é prazo de produto.

Nenhuma migration, mudança estrutural de banco, backfill ou publicação em produção integra esta entrega.

## Limites do modelo existente

- Reservas identificam o autor pelo nome porque o modelo atual não possui FK de usuário. A correção aplica a regra de autoria no servidor e bloqueia alterações por não administradores quando o nome identifica zero ou mais de uma conta. Alteração ou reutilização futura de nomes continua uma limitação estrutural. Uma mudança desse vínculo exige proposta própria sob Vault.
- Alertas de tarefas não possuem armazenamento no schema atual. `CriarTarefa` pode avisar que o alerta não foi configurado; `EditarTarefa` não inclui alerta no contrato, embora a UI ainda exiba o seletor. Persistência e edição de alertas não foram homologadas e exigem definição própria. Esta entrega não implementa esse recurso nem cria coluna por migration.
- Recuperação de arquivo local ainda não enviado exige selecionar o arquivo novamente. Conteúdo de `File` não é convertido em rascunho textual persistente.
- Testes aprovados não substituem a homologação de cada combinação de campo, perfil e integração externa; os percursos efetivamente exercitados devem ser identificados na evidência final.
