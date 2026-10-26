# Auditoria de edição e salvamento do Painel Alpha

Data: 26/10/2026. Responsável: Quinn / QA. Pedido: verificar campos, formulários, etapas, edições e anotações, com relatório sobre a confiabilidade do salvamento.

**Parecer: o sistema ainda apresenta falhas que impedem afirmar que o usuário pode editar e salvar tudo com segurança.** Foram identificados 15 achados: 8 de prioridade alta e 7 de prioridade média. Há perda de observações, perda de rascunhos, sucesso exibido sem confirmação da operação e diferenças importantes entre os mecanismos de salvamento dos módulos.

A auditoria combinou inventário do código, revisão dos fluxos de maior risco, execução da suíte existente, 18 reproduções isoladas e leitura dos metadados de todas as etapas do CRM em staging. Não representa um teste manual autenticado de cada campo com todos os perfis. As conclusões sobre código local e configuração publicada estão separadas abaixo.

## Escopo e versão examinada

| Item | Evidência e limite |
| --- | --- |
| Código | Cópia de trabalho na branch `staging`, HEAD `392ec53e5b6dfbf3717f3dbf31e19824afe13b51`, incluindo alterações locais preexistentes. |
| Referência remota disponível | `origin/staging` em `aca95ddb402da03a5d58b7833a04bd99b018e537`; branch local 2 commits à frente e 87 atrás dessa referência. Não houve fetch, merge ou atualização da aplicação. |
| Configuração CRM | Consulta SELECT ao banco definido em `.env.staging.local`. Fingerprint SHA-256 abreviado do endereço: `7fdd160737ba`. |
| Separação de bancos | `.env.local` e `.env` apontam para outro endereço, fingerprint `3a07b72d638b`; não foram usados para consultar ou alterar dados. |
| Dados consultados | Somente definições de pipelines, etapas, formulários, seções, componentes e configurações de campos. Nenhum conteúdo de card, anotação, cliente ou credencial foi exportado. |
| Escrita em ambientes reais | Nenhuma. Sem migrations, backfills, alteração de configuração ou publicação. |
| Testes | Prisma, sessão e integrações simulados nas reproduções. Suíte geral com destino padrão de banco local isolado e token vazio; fixtures SQLite dos testes permanecem locais. |
| Publicação de staging | Não foi identificada a revisão efetivamente servida pelo site. Defeitos do código local não são apresentados como incidentes comprovados do site publicado. |

Não há base para afirmar ocorrência de perda em registros reais ou quantificar usuários afetados. Os cenários abaixo descrevem condições reproduzidas ou cadeias verificadas no código.

## Inventário e cobertura

O levantamento sintático percorreu **2.082 arquivos de código em `src`**, com **1.437 ocorrências de componentes de campo**, **58 elementos `form`**, **431 arquivos que importam actions**, **184 arquivos de actions** e **131 páginas do painel**. Esses números incluem filtros, buscas e componentes reutilizáveis; não são contagem de campos de negócio únicos nem prova de execução de todas as telas. Campos montados dinamicamente não podem ser contados somente pelo JSX.

No CRM de staging foram encontrados **4 pipelines ativos, 37 etapas ativas e 148 definições distintas de campos publicadas em 680 posições de formulário**. As posições abrangem 15 tipos: seleção, texto, CNPJ, e-mail, moeda, texto longo, usuário, percentual, data, data/hora, URL ou arquivo, CPF, URL, arquivo e booleano.

O resolvedor local de formulários aceitou a composição de **32 etapas**. Nas outras **5**, não existe formulário canônico publicado. Não encontrou componentes inválidos entre os formulários presentes nessa leitura. A avaliação depende da versão local do resolvedor e não incorpora valores de cards, condições de visibilidade ou permissões de um usuário específico.

| Área | Verificação realizada | Resultado no escopo examinado |
| --- | --- | --- |
| CRM: campos por etapa | Todas as composições de staging; renderer, inputs, action central, rascunhos, fila, conflitos e testes de salvamento manual | Núcleo protegido; ressalvas S05–S07 e C01. |
| CRM: anotações e procedimentos | Interface e actions; reproduções de digitação, fechamento/remontagem e recarga de outro item | Perda de rascunho reproduzida. |
| CRM: transições, pagamentos, NF, arquivos e follow-up | Revisão dos pontos de integração e testes existentes | Há flush, validação e recuperação; não houve operação de negócio real. |
| Bloco de Notas | Editor, versões, armazenamento local, ações laterais e abas; reproduções de resposta atrasada, offline, recuperação e negativa do servidor | Falhas S01, S04, S08 e S15. |
| CheckList operacional autônomo | Tela, atualização de item, observação e progresso; action real com banco simulado | Falhas S02 e S03. É um domínio separado dos procedimentos do CRM. |
| Tarefas de Serviços Gerais | Criação, edição, conclusão, montagem do SQL e consumo dos resultados | Falhas S09 e S10. Não confundir com tarefas BPM. |
| Reserva de salas | Criação/edição e consistência dos horários; actions com banco simulado | Falhas S10 e S11. |
| Cadastro de clientes / CS e NPS | Botão unificado, gravação parcial, sócios e histórico cadastral | Há indicação de falhas parciais; risco S12 no cadastro mestre. |
| Parceiros | Edição de pré-cadastro, payload parcial e action; limpeza de campo reproduzida | Falha S13. |
| AlphaBlueprint | Especificação, canvas, actions de documento e histórico; falha de histórico reproduzida | Falha S14. |
| Calendário Alpha | Formulário, controlador, conflito remoto e testes de concorrência | Controles de conflito e rollback presentes; sem gravação remota autenticada. |
| Apresentações | Autosave, fila por slide, revisão de edição e troca/exportação de slide | Proteções contra resposta antiga presentes e cobertas por testes. Fechamento do navegador não foi exercitado. |
| Gerador de documentos | Templates, cláusulas, variáveis, estado pendente e confirmação do PDF | Feedback e bloqueios presentes; sem geração ou salvamento real de documento nesta auditoria. |
| Estoque | Cadastro, validação e sequência cadastro → foto/nota fiscal | Comunica salvamento parcial se anexo falhar, mas fecha o modal; recuperação manual de arquivo merece teste autenticado. |
| Comissões | Responsável, lançamento e pagamento; respostas de sucesso/erro e suíte existente | Validações e mensagens presentes na amostra; sem operação financeira real. |
| Perfil e administração de usuários | Actions de senha, avatar, preferências e atualização administrativa | Guardas e validações presentes na amostra; não foram alteradas contas. |
| Demais módulos | Inventário sintático e suíte geral, incluindo Metas, Chamados, Pré-análise, Extratos, Explorer, SEO, Chatbot, Schools, RH e integrações | Cobertura indireta. Não equivale a homologação individual de formulários. |

O [CSV de campos](../qa/evidencias/auditoria-salvamento-20261026/campos-interface.csv) identifica arquivo, linha, componente, handlers e restrições de cada ocorrência detectada. O [inventário completo](../qa/evidencias/auditoria-salvamento-20261026/inventario-codigo.json) também registra imports de actions e chamadas de mutação Prisma.

## Matriz das etapas do CRM

“Composição válida” significa configuração aceita pelo resolvedor local; não indica teste de gravação autenticada. A coluna Campos conta posições publicadas, inclusive campos de leitura e campos repetidos em etapas diferentes. Blocos especiais podem existir sem campos comuns.

| Pipeline | Etapa | Campos | Blocos especiais | Configuração |
| --- | --- | ---: | --- | --- |
| Revisão de Radar | Novo Lead | 3 | — | Composição válida |
| Revisão de Radar | Agendar Reunião | 0 | Agendamento de reunião, Próximo contato | Composição válida |
| Revisão de Radar | Reunião Agendada | 14 | Transcrição | Composição válida |
| Revisão de Radar | Em tratativa | 19 | Próximo contato, Checklist de follow-up | Composição válida |
| Revisão de Radar | Contrato fechado | 21 | Pós-fechamento | Composição válida |
| Revisão de Radar | Lost | 2 | — | Composição válida |
| Revisão de Radar | Sem viabilidade | 0 | — | Sem formulário |
| Revisão de Radar | Stand-by — follow-up semanal | 2 | Próximo contato, Follow-up standby | Composição válida |
| Revisão de Radar | Monitoramento | 0 | Verificação automática | Composição válida |
| Financeiro | Novo Contrato | 31 | — | Composição válida |
| Financeiro | Elaboração de Contrato | 7 | — | Composição válida |
| Financeiro | Formalização | 6 | — | Composição válida |
| Financeiro | Confirmação de Pagamento | 14 | — | Composição válida |
| Financeiro | Emissão de Nota Fiscal | 7 | — | Composição válida |
| Financeiro | Concluido | 23 | — | Composição válida |
| Financeiro | Stand By | 0 | — | Sem formulário |
| Financeiro | Cancelado | 0 | — | Sem formulário |
| Financeiro | Processos 2x1 | 0 | — | Sem formulário |
| Operacional | Boas vindas | 37 | — | Composição válida |
| Operacional | Alinhamento Estratégico Agendado | 22 | — | Composição válida |
| Operacional | Envio do Check List Atualizado | 23 | — | Composição válida |
| Operacional | Documentação em análise | 23 | Procedimentos | Composição válida |
| Operacional | Revisão | 24 | — | Composição válida |
| Operacional | Revisado | 27 | — | Composição válida |
| Operacional | Revisão do protocolo | 30 | — | Composição válida |
| Operacional | Aguardando despacho | 30 | — | Composição válida |
| Operacional | Petição | 30 | — | Composição válida |
| Operacional | Exigência Fiscal | 30 | — | Composição válida |
| Operacional | Resposta | 30 | — | Composição válida |
| Operacional | Processo deferido | 30 | — | Composição válida |
| Operacional | Processo indeferido | 30 | — | Composição válida |
| Operacional | Cliente cancelado | 0 | — | Sem formulário |
| REVISÃO DO RADAR - ASSESSORIA SMART | Contratos Stand-by | 33 | — | Composição válida |
| REVISÃO DO RADAR - ASSESSORIA SMART | Envio do checklist e boas vindas | 33 | — | Composição válida |
| REVISÃO DO RADAR - ASSESSORIA SMART | Documentação em análise | 33 | — | Composição válida |
| REVISÃO DO RADAR - ASSESSORIA SMART | Enviar para REVISÃO | 33 | — | Composição válida |
| REVISÃO DO RADAR - ASSESSORIA SMART | CLIENTES CANCELADOS | 33 | — | Composição válida |

O JSON anexo detalha os 148 campos distintos e suas configurações por etapa, permitindo localizar cada posição da tabela.

## Achados e correções recomendadas

Prioridade alta (**P1**): risco de perda de conteúdo, confirmação enganosa ou ausência de proteção de escrita. Prioridade média (**P2**): recuperação, consistência e comportamento incompleto de edição. A prioridade indica ordem de tratamento, sem afirmar frequência de ocorrência em produção.

### S01 — P1 — Nota pode mostrar Salvo e perder o rascunho mais recente

**Cenário reproduzido:** o texto A é enviado; enquanto a resposta demora, o usuário digita B. A resposta de A marca a nota como salva e remove o rascunho local de B. O próximo envio ainda depende do temporizador. Recarregar/fechar a página nessa janela deixa B sem a cópia local que deveria protegê-lo.

**Causa:** o sucesso não compara a revisão enviada com a revisão atual antes de limpar o rascunho e mudar o indicador. Referência: `src/components/Notas/NoteEditor/NoteEditor.tsx:117` e `:140`.

**Correção:** capturar revisão/conteúdo por envio; serializar gravações por nota; limpar somente o rascunho correspondente à confirmação. O indicador deve continuar pendente enquanto houver revisão posterior. Evidência: teste N01.

### S02 — P1 — Mudar o status do checklist apaga a observação

**Cenário confirmado na action:** o usuário altera somente o status de um item do CheckList autônomo. A tela envia `{ status }`; o servidor transforma a ausência de observação em `null`. Texto previamente salvo é removido do campo persistido. O estado local pode esconder o efeito até a próxima leitura.

**Referências:** `src/app/PainelAlpha/CheckList/ChecklistView.tsx:150`; `src/actions/checklist.ts:365` e `:377`.

**Correção:** atualizar apenas propriedades presentes no pedido. Separar campo omitido de limpeza explícita; testar status isolado, observação isolada e limpeza. Evidência: CK01. O achado também consta da auditoria de checklist de 22/10 e continua presente nesta cópia.

### S03 — P1 — Falhas do checklist podem parecer gravação bem-sucedida

**Cadeia verificada:** a tela atualiza o status antes da confirmação e trata apenas rejeições da Promise. A action normalmente captura exceções e devolve `{ error }`, o que não aciona o `catch` da tela. Observações salvas por blur também não verificam a resposta. Além disso, item e progresso são gravados separadamente: uma falha no segundo passo devolve erro após o primeiro já ter sido persistido.

**Referências:** `ChecklistView.tsx:150` e `:163`; `src/actions/checklist.ts:373` e `:391`. Evidência CK02 reproduz a resposta de erro após a primeira escrita com adaptadores simulados; o consumo incorreto na tela foi revisado no código.

**Correção:** consumir o resultado estruturado; confirmar/reverter a alteração visual; manter o texto em caso de falha; atualizar item e progresso na mesma transação e devolver o estado confirmado.

### S04 — P1 — Arquivar ou mandar nota à lixeira pode apagar o rascunho mesmo com negativa

**Cenários reproduzidos:** o servidor devolve `success: false` e “Sem permissão”. A interface ainda mostra “Nota arquivada” ou “Nota movida para a lixeira” e executa a limpeza do rascunho local. A operação de servidor foi negada, mas o usuário recebe sucesso e perde sua cópia de trabalho.

**Referência:** `src/components/Notas/Central/PainelPropriedades.tsx:87` e `:96`.

**Correção:** verificar `res.success` antes de fechar abas, remover rascunhos, atualizar listas e emitir sucesso; preservar conteúdo também em exceções de transporte. Evidência: dois casos N06.

### S05 — P1 — Salvar outro item de procedimento pode apagar uma observação em edição

**Cenário reproduzido:** há texto ainda não salvo no item A de um procedimento do CRM. Uma gravação bem-sucedida no item B dispara `carregar()`, que substitui todas as observações pelos valores do servidor e limpa o conjunto de itens sujos. O texto de A desaparece se ainda não tiver sido persistido. Uma observação em outro item também pode ser afetada por recargas concorrentes.

**Referências:** `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx:55` e `:97`.

**Correção:** aplicar a confirmação somente ao item enviado; preservar rascunhos dos demais itens; controlar revisões e registrar pendências no contexto de salvamento do card. Evidência: C02.

### S06 — P2 — Anotação simples do CRM fica fora da proteção de saída

**Cenário reproduzido:** digitar uma anotação deixa o contexto do card sem pendências, e `flushSaves()` informa sucesso. Ao desmontar e reabrir o editor, o texto está vazio. Fechar o modal pode descartar a anotação sem o diálogo que protege os campos comuns. O mesmo contexto não acompanha a gravação da anotação em andamento.

**Referências:** `src/app/PainelAlpha/AlphaCRM/CardModal/EditorAnotacaoCard.tsx:28`; `CardFullViewModal.tsx:242`.

**Correção:** registrar rascunho, pendência e Promise de envio; incluir a anotação no diálogo de saída e na recuperação ao reabrir. Evidência: C01. A action de criação tem validação, autorização e transação; o problema identificado está na integração com a saída do editor.

### S07 — P2 — Rascunhos do CRM dependem da memória da sessão

O contexto central mantém rascunhos e pendências em `Map`/refs. Isso permite recuperação enquanto o provider continuar montado, mas não recupera o conteúdo após recarga completa, fechamento de aba ou encerramento do navegador. O diálogo de fechamento do card não cobre a saída do navegador.

**Referências:** `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx:53` e `:64`; provider no layout do CRM. A revisão não encontrou proteção de saída do navegador para estes rascunhos.

**Correção:** manter uma cópia local com identidade do usuário/card e versão-base, recuperar com verificação de conflito e avisar sobre saída com conteúdo pendente. Evitar prometer conclusão de gravações assíncronas durante o unload. Evidência: revisão estática, sem teste de fechamento real do navegador.

### S08 — P2 — Recuperação do Bloco de Notas exige nova interação e não cobre falhas completas

**Reproduções:** voltar online não reenvia a nota; restaurar um rascunho de versão compatível deixa “Alterações pendentes” sem agendar envio; um rascunho de versão diferente permanece no armazenamento, mas não é apresentado para recuperação e a interface mostra “Salvo”. Os testes não afirmam que esse último conteúdo já tenha sido apagado: ele fica oculto e pode ser substituído por uma edição posterior.

O código também não captura a rejeição de `AtualizarNota` no editor; falhas do banco podem rejeitar a action, deixando o status “Salvando...” sem conclusão controlada. A checagem de versão da nota ocorre antes da transação; uma disputa posterior pode se manifestar como erro de banco/versão única, sem resposta estruturada de conflito.

**Referências:** `src/components/Notas/NoteEditor/NoteEditor.tsx:117`, `:137` e `:165`; `src/actions/Notas.ts:84`. Evidências N02, N03, N04 e N05. A disputa entre transações foi identificada no código, sem simulação de dois bancos remotos.

**Correção:** tentativa manual visível, retomada ao reconectar, recuperação explícita de versões divergentes, `try/catch/finally` e comparação atômica de versão. Manter o rascunho até a confirmação da revisão exata.

### S09 — P1 — Criação de tarefas pode avisar sucesso após resposta de falha

O formulário de Gerenciar Tarefas aguarda `CriarTarefa`, mas não verifica o `success` retornado, inclusive no lote de dias da semana. Assim, uma resposta `{ success: false }` pode ser seguida de “Diretriz lançada!”, fechamento e limpeza do formulário. É uma confirmação enganosa identificada no código da interface.

**Outro cenário reproduzido:** concluir uma tarefa inexistente retorna sucesso mesmo quando o comando afeta zero linhas. **Contrato adicional:** a action de edição declara parâmetros opcionais que, quando omitidos, são interpolados como `undefined` no SQL e na data.

**Referências:** `src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx:279`; `src/actions/Tarefas.ts:128` e `:150`. Evidências TK01 e TK03 para os contratos de action.

**Correção:** conferir cada resultado; manter no formulário operações rejeitadas; validar payload; parametrizar SQL; conferir a quantidade de registros alterados e tratar ausência como erro. Em recorrência, retornar resultado por item ou usar uma operação transacional.

### S10 — P1 — Proteções de escrita são diferentes entre módulos

Nas actions legadas de tarefas não há consulta própria de sessão ou autorização sobre o usuário/recurso alvo. A criação usa o `userId` enviado. A edição de reserva também chega à atualização sem autenticação própria. Isso contrasta com as actions centrais do CRM, que revalidam acesso no servidor e dentro das transações.

**Referências:** `src/actions/Tarefas.ts:12`, `:128` e `:150`; `src/actions/Reservas.ts:102`. Os testes TK02 e RV02 chamam as funções reais com adaptadores simulados e mostram que a sessão não é consultada. Não houve ataque HTTP nem comprovação de acesso anônimo ao site; middleware e transporte publicado não foram exercitados.

**Correção:** garantir sessão ativa e autorização do alvo no servidor; derivar autoria da sessão, validar permissões administrativas e usar consultas parametrizadas. Aplicar a mesma regra aos caminhos equivalentes de exclusão/conclusão. Não corrigir apenas escondendo botões.

### S11 — P2 — Reserva pode ser salva com fim anterior ao início

**Cenário reproduzido na action:** início às 15h e término às 14h são aceitos se a consulta simulada não encontrar conflito. As datas são válidas individualmente, mas o intervalo não é validado. Criação/edição também consultam conflitos antes da escrita, sem proteção atômica entre essas etapas; sobreposição concorrente permanece um risco de código, não ocorrência observada.

**Referência:** `src/actions/Reservas.ts:22` e `:102`.

**Correção:** validar fim maior que início no servidor e na interface; tratar concorrência na reserva do intervalo; testar horários iguais, invertidos, sobreposição e duas requisições simultâneas. Evidência RV01 para o intervalo invertido.

### S12 — P2 — Cadastro mestre e histórico podem divergir após falha

`salvarAlteracoesCliente` atualiza o cliente e depois grava o histórico fora de uma transação. Se o histórico falhar, a action responde erro embora o cadastro já tenha mudado. Em contraste, o salvamento do serviço já agrupa suas alterações relacionadas em uma transação.

O botão unificado do modal faz várias chamadas e admite salvamento parcial; sua mensagem informa quais grupos falharam. Esse comportamento precisa continuar explícito para que “Salvar tudo” não seja interpretado como atomicidade do conjunto. Uma exceção de transporte no meio da sequência não tem um `finally` geral para liberar `salvandoTudo`.

**Referências:** `src/actions/Clientes.ts:780`; `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx:727`.

**Correção:** transação para cadastro e histórico; liberação da interface em `finally`; resumir por grupo o que foi confirmado e o que continua pendente. Evidência: revisão estática.

### S13 — P2 — Alguns campos do pré-cadastro não podem ser apagados pela tela

**Cenário reproduzido:** apagar “Complemento” envia `undefined`. A action interpreta propriedade ausente como “preservar o valor atual”. A tela informa sucesso, mas o valor antigo reaparece na próxima leitura. O mesmo padrão está no payload de outros campos opcionais, como nome fantasia, telefone e endereço.

**Referências:** `src/components/Parceiros/ModalEditarPreCadastro.tsx:102`; `src/actions/convites-parceiro.ts:406`.

**Correção:** distinguir campo não editado de campo explicitamente limpo; enviar vazio ou `null` conforme o contrato do campo. O servidor já possui conversão de vazio para nulo em vários desses atributos. Evidência P01 para Complemento; os demais foram verificados pelo padrão do código.

### S14 — P1 — Especificação Blueprint não protege todas as revisões e pode responder erro após gravar

O editor de especificação agenda salvamentos sem fila por documento, controle da revisão enviada ou rascunho local. Uma resposta antiga pode indicar “Salvo” enquanto há texto posterior pendente. A action de documento atualiza pelo ID sem uma versão-base do conteúdo; a gravação do histórico acontece depois e fora de transação.

**Cenário reproduzido:** a criação do documento é confirmada pelo adaptador simulado, o registro de atividade falha e a action responde “Erro ao salvar documento”. Como o cliente não recebe o ID criado, repetir a criação pode gerar outro documento. A duplicação é consequência possível da sequência, não foi produzida em banco real.

**Referências:** `src/components/AlphaBlueprint/SpecificationEditor.tsx:70` e `:96`; `src/actions/BlueprintDocuments.ts:31` e `:63`.

**Correção:** fila e revisão por documento, chave idempotente para criação, confirmação atômica de documento/histórico e recuperação de rascunho. Não considerar a proteção de versão do canvas como proteção do editor de texto: são actions distintas. Evidência B01 para a falha posterior à gravação; concorrência do editor revisada no código.

### S15 — P2 — Renomear nota pela aba altera apenas o estado local

O menu “Renomear nota” da barra global chama apenas `renomearAba` no store. Não atualiza o título da nota no servidor. A leitura do workspace usa `note.title`, de modo que uma sincronização/reabertura pode restaurar o título anterior.

**Referências:** `src/components/Notas/NotesGlobalTaskbar.tsx:355`; `src/store/useNotasWorkspace.ts`; `src/actions/NotasWorkspace.ts:25`.

**Correção:** definir se a ação renomeia a nota ou um apelido da aba; persistir no destino correspondente e apresentar falhas. Para renomear a nota, usar a versão atual e preservar o conteúdo pendente do editor. Evidência: cadeia estática entre callback, store e leitura do workspace.

## C01 — Cinco etapas não têm formulário publicado

O banco de staging contém etapas ativas sem `BpmEtapaFormulario`:

| Pipeline | Etapa |
| --- | --- |
| Revisão de Radar | Sem viabilidade |
| Financeiro | Stand By |
| Financeiro | Cancelado |
| Financeiro | Processos 2x1 |
| Operacional | Cliente cancelado |

O renderer local informa que não há formulário canônico publicado. Essas etapas também não têm campos canônicos configurados na leitura feita. Portanto, não há como homologar edição de campos de etapa nelas. Isso é uma limitação de configuração observada, separada dos 15 defeitos: etapas terminais podem ter sido deixadas assim por decisão de negócio. É necessário conferir essa intenção antes de propor publicação de formulários. Nenhuma configuração foi alterada.

## O que já protege o usuário

- **Campos comuns do CRM:** botão de salvamento, contagem de alterações, fila por card, confirmação da versão, rascunho em sessão e preservação de falhas para nova tentativa. Grupos de pagamento e nota fiscal são enviados juntos quando exigem validação conjunta.
- **Action central do CRM:** valida payload e tipos de campos, verifica acesso, revalida dentro da transação e confirma os valores persistidos. Falhas de notificação/realtime posteriores à gravação recebem tratamento próprio.
- **Mudança de etapa:** aguarda a fila de salvamento e bloqueia o movimento se há pendências; mantém proteção contra cliques repetidos. Isso não cobre conteúdo que o editor deixou de registrar na fila.
- **Anexos do CRM:** há verificação de upload, vínculo entre campo e card, recibos e testes de recuperação/idempotência.
- **Apresentações:** fila por slide e revisão local impedem limpar o estado sujo com uma confirmação antiga; há salvamento antes de ações de troca/exportação examinadas.
- **Calendário e documentos:** existem verificações de conflito/estado pendente nas cadeias revisadas. Aprovação integral ainda depende do percurso autenticado com dados e perfis de teste.

## Resultados dos testes e quality gates

| Checagem | Resultado |
| --- | --- |
| `npm run typecheck` | Passou no código inicial e após a validação dos artefatos finais. |
| `npm test` | **702 arquivos aprovados / 1 reprovado**; **5.398 testes aprovados / 1 reprovado / 4 ignorados / 1 todo**. Total: 703 arquivos e 5.404 casos. |
| Falha da suíte geral | `tests/bpm/novo-card-modal-react.test.ts:223`: esperava `colorScheme = dark`, recebeu `var(--crm-color-scheme, dark)`. Não é evidência de falha de gravação. O teste foi mantido sem alteração. |
| `npm run lint` | Primeira tentativa encerrou por falta de memória, exit 134. Repetição com heap de 8 GB terminou com exit 1: 23.365 erros e 129.738 avisos. |
| Origem dos erros do lint geral | Os **23.365 erros estão em `.cache`**. O resumo por diretório distingue caches, framework, aplicação e testes. Não se atribuem esses erros ao código executável de salvamento. |
| `npm run lint -- src` | Passou: **0 erros, 259 avisos**. Não substitui o gate geral que falhou. |
| Reproduções desta auditoria | **18/18 casos confirmaram o comportamento observado** em dois arquivos. Esses testes foram escritos para demonstrar os defeitos; o resultado verde não é aprovação funcional. |
| Lint das evidências | Passou: 0 erros e 0 avisos; execução separada dos testes históricos. |
| Build | Não executado nesta auditoria documental, que não alterou código da aplicação nem preparou release. Não há parecer de build/deploy. |

A suíte existente inclui testes unitários, componentes, integração com SQLite local e verificações textuais de contrato. **125 dos 703 arquivos usam leitura de arquivos**, às vezes em conjunto com outros testes; não se afirma que toda a suíte seja execução de fluxos de usuário. O volume de testes aprovados não elimina os cenários adicionais reproduzidos aqui.

## Ordem recomendada para estabilização

1. Corrigir perda de texto e confirmação enganosa: S01–S05 e S09. Cada correção deve ter regressão que exija preservar o conteúdo e indicar corretamente o resultado.
2. Uniformizar autorização de escrita dos caminhos legados S10 e proteger persistência de documento Blueprint S14.
3. Completar rascunhos, recuperação offline, fechamento e versionamento: S06–S08, S12 e S15.
4. Ajustar limpeza de campos e intervalos: S11 e S13. Conferir a intenção das cinco etapas C01.
5. Resolver o gate visual e a abrangência do lint geral; publicar correções somente em staging e executar o roteiro autenticado antes de qualquer promoção solicitada para produção.

As mudanças de código podem ser preparadas sem migration. Qualquer proposta que exija mudar estrutura, criar índices, migrar versões ou fazer backfill deve seguir Vault, backup verificado e confirmação específica antes da execução.

## Roteiro necessário para homologar todos os campos

Para cada posição publicada na matriz de etapas e cada formulário dos demais módulos, usar registro fictício e perfis de teste com permissão de edição, somente leitura e sem acesso. Em cada caso:

1. Preencher e salvar; reabrir por uma nova leitura para conferir o valor persistido.
2. Editar um campo isolado; conferir que os demais valores e observações foram preservados.
3. Limpar um campo opcional; conferir a limpeza após reabrir. Para obrigatório, exigir mensagem de validação com rascunho preservado.
4. Testar formatos inválidos, datas/horários, valores monetários, seleção e uploads aplicáveis.
5. Simular rede interrompida, resposta negativa e sessão expirada; não limpar conteúdo nem mostrar sucesso indevido.
6. Editar durante um envio lento e em duas sessões; confirmar que resposta antiga não sobrescreve ou esconde a revisão nova.
7. Fechar modal, trocar etapa/aba e recarregar com pendências; recuperar ou confirmar descarte de forma explícita.
8. Repetir o envio; conferir ausência de duplicação de anotações, tarefas, documentos, eventos e histórico.

Esse roteiro não foi executado integralmente por navegador nesta entrega. A matriz de configuração completa e as reproduções já permitem priorizar as correções sem alterar registros reais.

## Entregáveis e rastreabilidade

- [Matriz das 37 etapas de staging e seus campos](../qa/evidencias/auditoria-salvamento-20261026/matriz-etapas-staging.json).
- [Campos de interface e handlers em CSV](../qa/evidencias/auditoria-salvamento-20261026/campos-interface.csv).
- [Inventário sintático do código](../qa/evidencias/auditoria-salvamento-20261026/inventario-codigo.json).
- [Reproduções de interface](../qa/evidencias/auditoria-salvamento-20261026/reproducoes-ui.test.ts.txt) e [reproduções de actions](../qa/evidencias/auditoria-salvamento-20261026/reproducoes-actions.test.ts.txt).
- [Instruções para repetir as evidências](../qa/evidencias/auditoria-salvamento-20261026/README.md).
- [Resumo dos gates, versões e hashes](../qa/evidencias/auditoria-salvamento-20261026/execucao.json) e [origem dos diagnósticos de lint](../qa/evidencias/auditoria-salvamento-20261026/lint-resumo.json).

**Checklist de execução:** inventário concluído; 37 etapas inspecionadas por metadados; revisão dos fluxos de maior risco concluída; suíte e gates obrigatórios executados com resultados registrados; reproduções isoladas concluídas; relatório e lista de arquivos entregues. Homologação autenticada campo a campo permanece pendente e não foi marcada como aprovada.
