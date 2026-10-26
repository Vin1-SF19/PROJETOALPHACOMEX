# Correções dos fluxos de edição e salvamento

Entrega autorizada em 26/10/2026, a partir da [auditoria de salvamento](auditoria-salvamento-sistema-2026-10-26.md). A implementação foi organizada na [story de correções](../stories/story-correcoes-salvamento-sistema-20261026.md).

## Escopo implementado

| Achado | Tratamento |
| --- | --- |
| S01 | Autosave de Notas serializado por revisão. Respostas antigas não limpam texto posterior nem rascunhos de outra instância. |
| S02 e S03 | O CheckList reformulado já publicado em staging usa patch parcial, revisão, identidade da operação, transação e confirmação da interface. Essa implementação foi preservada no candidato, com testes próprios; o código legado do checkout antigo não foi reintroduzido. |
| S04 | Arquivar/lixeira aguardam o salvamento do editor e só encerram a nota após confirmação positiva. Negativa e exceção preservam conteúdo e rascunho. |
| S05 | Procedimentos do CRM preservam observações dos outros itens, controlam versão e integram rascunhos e salvamento de saída ao contexto do card. |
| S06 | Anotação simples participa da fila, das pendências e da recuperação. Chave estável na operação impede duplicação no retry; anotação e histórico são transacionais. |
| S07 | Rascunhos locais do CRM são separados por usuário, conservam base, exigem revisão após recuperação e avisam sobre saída. Token por edição protege rascunhos de outra aba contra confirmações/limpezas antigas. |
| S08 | Notas retomam pendências ao reconectar, oferecem nova tentativa e resolução explícita de conflito. Versão e histórico são confirmados na mesma transação. |
| S09 | Tarefas verificam resultados, inclusive na recorrência; falhas mantêm formulário. Opcionais omitidos são preservados; consultas recebem parâmetros e alterações conferem registros afetados. |
| S10 | Escritas legadas validam sessão, usuário ativo, permissões atuais e acesso ao alvo no servidor. As regras legítimas dos módulos foram mantidas. |
| S11 | Reservas validam intervalo no cliente e servidor; teste de sobreposição e escrita são um único comando parametrizado, evitando a janela entre consultar e gravar. |
| S12 | Cadastro mestre e histórico são transacionais; o modal libera o estado ocupado em exceções e continua identificando resultados parciais do conjunto. |
| S13 | Limpar campos opcionais do pré-cadastro envia intenção explícita de limpeza, respeitando colunas obrigatórias existentes. |
| S14 | Blueprint tem criação idempotente, CAS por timestamp, histórico transacional, fila por revisão, rascunho por usuário e resolução de conflito. Tokens protegem contra resposta antiga de outra instância. |
| S15 | Renomear nota pela aba persiste o título e usa a fila do editor ativo para preservar texto pendente. |
| C01 | O usuário escolheu permitir edição dos dados existentes nas cinco etapas sem formulário. O fallback se aplica somente quando não há formulário nem composição canônica e expõe apenas campos já registrados no próprio card e revalida contexto, pipeline, ACL, visibilidade, leitura e mapeamentos. Não publica campos ou formulários nem cria requisitos/defaults. |

## Integração com o staging vigente

O checkout auditado estava 87 commits atrás da referência remota. O candidato de publicação foi criado sobre `aca95ddb402da03a5d58b7833a04bd99b018e537` e atualizado sem conflitos para `b115dd3802485e9b0a049f2a45a5010db77338b5`, preservando o CheckList reformulado, as condições de campos e a proteção global de saída do painel. As correções são integradas por escopo, com revisão das divergências; alterações concorrentes de outras tarefas não pertencem à entrega.

O provider global do card recebe a identidade autenticada do layout principal e reinicia o estado ao trocar de usuário. As guardas de navegação e o salvamento em background já publicados foram preservados.

## Validação e publicação

Na base `b115dd3802485e9b0a049f2a45a5010db77338b5`, lint e tipos passaram sem erros; o lint conserva 1.172 avisos. A suíte completa aprovou **795 arquivos e 6.631 testes**, com quatro casos ignorados e um pendente preexistentes. O build de staging gerou 86 páginas. A [evidência dos gates](../qa/evidencias/correcoes-salvamento-20261026/gates.json) registra comandos, exits, cobertura e limites.

A execução final usou um worker, diretório temporário exclusivo e orçamento de 15 segundos por teste. O limite padrão de cinco segundos havia interrompido um teste antigo que restaura backups fictícios repetidamente; esse mesmo caso passou isolado em 974 ms. Também foi corrigido o destino temporário herdado, que apontava para um disco cheio. Assertions, casos e limites explícitos dos hooks foram mantidos.

O build foi executado com as duas variáveis Turso de staging verificadas e dependências isoladas. A primeira tentativa externa encontrou duas árvores de Next/React; o container de saída foi corrigido, sem alteração da aplicação, e a configuração gerada foi restaurada byte a byte. Testes de concorrência, rollback e idempotência usam SQLite temporário e dados fictícios; testes de componente usam dependências simuladas.

O audit de dependências registra débito anterior: 114 achados, incluindo 10 críticos, com manifesto e lock idênticos à base remota. Isso não constitui aprovação do audit; a entrega não alterou o grafo. A revisão independente não mantém achados de código abertos.

A publicação e os percursos autenticados do novo SHA ainda serão registrados após READY em staging.

Nenhuma migration, mudança estrutural de banco, backfill ou publicação em produção integra esta entrega.

## Limites do modelo existente

- Reservas identificam o autor pelo nome porque o modelo atual não possui FK de usuário. A correção aplica a regra de autoria no servidor e bloqueia alterações por não administradores quando o nome identifica zero ou mais de uma conta. Alteração ou reutilização futura de nomes continua uma limitação estrutural. Uma mudança desse vínculo exige proposta própria sob Vault.
- A estrutura atual de tarefas não possui o armazenamento de alerta usado pelo formulário legado. A tarefa pode ser salva com aviso explícito de que o alerta não foi persistido; não há migration implícita para criar a coluna.
- Recuperação de arquivo local ainda não enviado exige selecionar o arquivo novamente. Conteúdo de `File` não é convertido em rascunho textual persistente.
- Testes aprovados não substituem a homologação de cada combinação de campo, perfil e integração externa; os percursos efetivamente exercitados devem ser identificados na evidência final.
