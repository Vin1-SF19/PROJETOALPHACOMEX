# Minuta configurada após movimento livre — desenho mínimo

Data: 21/10/2026. Base `daf88fb7`. Escopo de implementação/publicação: staging primeiro. Aria/Scout possui somente este desenho; outros agentes possuem story, runtime e testes.

## Diagnóstico e decisão

A coordenação confirmou o caso real de movimento administrativo suprimido. O código trata Admin/líder autorizado como reposicionamento livre, grava `CARD_MOVIDO` com `automacoesSuprimidas=true` e não aciona a fila de movimento/cadências/flush central. O materializador também ignora eventos suprimidos. Assim, entrar em Elaboração de Contrato por esse caminho não basta para gerar a minuta configurada.

A condição real **Serviço contratado contém Radar** do caso CARNES SANTA CATARINA ainda é objeto de leitura do DevOps: este desenho não afirma que ela foi atendida nem substitui a inspeção da versão/configuração efetiva.

Permitir somente a geração automática de **minuta documental configurada** após novos movimentos livres autorizados. Não criar botão, encaminhar setor, remover conferência ou reativar as demais automações. Não inserir configuração ou evento retroativo para reparar a empresa de produção. O Gerador manual não é um substituto: `GerarDocumento` não estabelece o vínculo/identidade BPM financeira e filtra `__bpmCardId` recebido do cliente.

## Marcador de evento e compatibilidade

`transicao-command.ts` mantém `automacoesSuprimidas: true` e o registro de `movimentoLivre` existentes. Acrescenta `permitirMinutaConfigurada: true` ao `valorNovo` do evento **somente quando o servidor acabou de autorizar um movimento livre MANUAL**, com ator `USUARIO` identificado. Nunca aceitar a flag do payload cliente como autoridade ou propagar autorização pessoal para automação/webhook.

Eventos anteriores sem o novo marcador continuam suprimidos. Não alterar sua marca, limpar execuções IGNORADA, falsificar novo evento, publicar versão para reaproveitar histórico, executar SQL de backfill ou mover cliente de produção. O primeiro evento elegível será um movimento novo explícito após a publicação autorizada da correção.

Não remover as condições `!movimentoLivre` que impedem a fila legada de movimento, ativação/processamento de cadências e flush geral em `Cards.ts`. A exceção é resolvida pelo materializador/worker **central**, não pela liberação de todas as filas. Automações legadas sem versão central ativa não ganham fallback genérico nesta correção.

**Corroboração da origem:** reutilizar o histórico `CARD_MOVIDO` já relacionado por `evento.causationId`; conferir ID/card/usuário, etapa de origem/destino, versão resultante e autoridade `movimentoLivre` concordantes entre histórico e evento, além da chave `transition:` já emitida pelo comando. O marcador sozinho não basta. Na via manual normal, `causationId` já recebe o ID desse histórico. Se uma chamada interna tiver outra cadeia de causa que não permita essa prova, falhar fechado para esta exceção, sem remendar histórico nem conceder autorização pela flag. Não criar nova tabela, assinatura, API ou novo parâmetro de autoridade do cliente para provar a origem.

## Flush imediato, estritamente direcionado, após commit

A geração não deve depender de cron nem de intervenção manual no staging. Depois do commit de um **novo** movimento livre autorizado, o comando chama um orquestrador estreito, por exemplo `executarMinutaConfiguradaDoMovimentoLivreAgora({ cardId, eventoId })`, usando exclusivamente IDs retornados pela transação do próprio movimento. Nunca derivar o evento de um parâmetro arbitrário do usuário nem buscar “o último evento” por nome de empresa/etapa.

O helper estreito pode reutilizar as funções do engine mediante escopo discriminado equivalente a `{ modo: "MINUTA_MOVIMENTO_LIVRE", cardId, eventoId }`:

O novo escopo é opt-in e exclusivo dessa via. Chamadas existentes sem esse modo mantêm sua semântica global/por card; não aproveitar a correção para alterar seleção ou recuperação de filas de outros fluxos.

1. Materializar somente o evento com esse ID/card, apenas versões ativas de gatilho ENTRAR_COLUNA aprovadas pelo classificador e por todos os gates documentais. Não varrer outros eventos do mesmo card. A unicidade versão/evento continua impedindo duplicação.
2. Processar somente execuções centrais pendentes desse card/evento e aprovadas pelo mesmo classificador. Uma lista explícita de `execucaoIds` recém-criados também é válida se a seleção/validação continuar ligada ao mesmo evento. Não chamar o flush genérico do card.
3. Reutilizar claim e lease `card:{id}` existentes. **Também limitar ao escopo o resgate de EM_EXECUCAO antigo:** o `updateMany` global hoje presente no início de `processarFilaAutomacoesCentraisBpm` não pode tocar outras execuções quando usado pelo helper estreito. Seleção, resgate, claim e retries precisam preservar esse isolamento.
4. Revalidar evento/histórico, ator, card/etapa, configuração/classificador e condição global no worker antes de qualquer efeito. Nenhuma execução antiga/sem marcador, mista ou de outro card é processada pelo flush.

Escolha mínima de integração: aguardar o flush **após commit** em bloco try/catch independente, conforme o padrão atual de efeitos imediatos. Falha de renderização/PDF/Blob fica registrada na execução; indisponibilidade da materialização/worker fica diagnosticada, mas nunca transforma movimento confirmado em rollback/erro de movimento nem altera sua auditoria para fingir sucesso do documento. Sem transação de movimento aberta durante geração/rede. O cron continua recuperação de pendências pelo caminho normal, não pré-requisito do primeiro disparo. Se o módulo do orquestrador importar central-runtime e este importar transicao-command, evitar ciclo de inicialização usando carregamento tardio no efeito pós-commit ou fronteira já existente equivalente.

Retry idempotente do movimento não forja evento novo nem repete efeitos concluídos. Retentativas do documento obedecem status/tentativas/disponívelEm existentes; não resetar FALHA para PENDENTE como efeito oculto de um clique de movimento repetido.

## Classificador documental compartilhado

Adicionar helper puro, por exemplo `src/lib/bpm/automacoes/minuta-movimento-livre.ts`, reutilizado pelo materializador e pelo worker. Primeiro validar o grafo pelo schema central; depois admitir estritamente:

- Exatamente dois nós válidos, com IDs distintos.
- `inicioId` aponta para um nó `ACAO`, ação exatamente `GERAR_CONTRATO`, parâmetros válidos pelo schema já existente.
- Seu `proximoId` aponta diretamente para o outro nó, do tipo `FIM`.
- Sem outro nó, branch, espera, temporizador ou ação adicional, inclusive nó não alcançável.

A condição global da versão permanece permitida e é avaliada normalmente pelo motor. Não extrair `GERAR_CONTRATO` de um grafo misto: executar parcialmente poderia ignorar uma condição ou disparar um fluxo com semântica diferente. Não autorizar por nome de etapa, empresa, template ou texto do título da regra.

O classificador não grava dados, não executa ações nem escolhe parâmetros novos. Se a regra real não tiver essa forma estrita, permanecerá suprimida; sua expansão precisará de desenho próprio, sem flexibilização silenciosa.

## Gate antes de materializar

Em `automacoes/eventos.ts`, preservar a regra normal para eventos não suprimidos. Para um evento suprimido, somente admitir a exceção se **todos** os pontos abaixo forem verdadeiros:

1. Tipo `CARD_MOVIDO`, flag nova igual a `true`, `movimentoLivre` administrativo/de liderança presente e ator `USUARIO` com ID válido.
2. Automação ativa, versão central ATIVA e gatilho `ENTRAR_COLUNA`; configuração de gatilho corresponde ao pipeline e destino do evento.
3. Grafo aprovado pelo classificador documental.
4. Card do evento/execução é o card atual esperado, pipeline coincide e card ainda está na etapa de destino, ativo para operação; não arquivado/cancelado. Empresa, identidade e vínculos permanecem intactos.
5. Ator persistido continua ativo, com CRM e autoridade canônica de movimento livre no card/pipeline, revalidada pelo servidor. Nome/cargo/string enviada pelo cliente não concede autoridade. Reutilizar ownership e `resolverAutoridadeMovimentoLivre` existentes.

Preservar os limites atuais de data de ativação, profundidade, cadeia e unicidade versão/evento. Materialização não gera minuta nem torna uma condição global falsa verdadeira. Não confundir execução IGNORADA por evento suprimido com erro de geração.

## Gate antes de executar

O worker central repete a classificação e a verificação do evento/ator/card **antes de qualquer ação** da execução excepcional. A versão/configuração e o estado podem ter mudado desde o enfileiramento. Se perdeu autoridade, mudou de etapa/pipeline ou passou a ter grafo não permitido, encerrar sem ação com estado/diagnóstico seguro; não repetir efeitos nem cair num executor genérico.

Avaliar a condição global existente, inclusive Serviço contratado, sem bypass administrativo. Condição não atendida continua IGNORADA. Após os gates, executar o fluxo central existente, que delega `GERAR_CONTRATO` ao adaptador legado do gerador. Não acrescentar outra implementação de geração.

Preservar template ativo, contratada válida/configurada, campo financeiro permitido, variáveis e `permitirPendencias` definidos pela versão. Admin/líder livre não passa a dispensar os requisitos próprios do gerador. Metadados de empresa/Financeiro são obtidos do card autorizado; `__bpmCardId` continua injetado pelo servidor.

## Resultado e efeitos preservados

O produto é um `DocumentoGerado` em **CONFERENCIA**, com anexo virtual próprio e vínculo ao campo configurado quando ainda vazio. PDF de rascunho, quando gerado, não significa documento FINALIZADO. Nenhuma assinatura, pagamento, NF, liberação operacional, envio externo ou aprovação é criada por este caminho.

Manter a conferência/Finalizar já existentes. O Comercial só recebe disponibilidade/verde/alerta quando a elegibilidade atual de finalização for atendida. A geração de minuta não adianta a notificação “Contrato pronto para envio”. Não remover arquivo manual ou sobrescrever campo preenchido para demonstrar sucesso.

Deduplicação permanece por evento/versão no motor e pelo documento/anexo do mesmo template/card no gerador. Reentrada na etapa pode gerar nova execução legítima, mas reutiliza o documento existente conforme o contrato atual. Não fabricar um novo documento só para reanimar a automação.

## Blueprint de integração

- [ ] **Criar:** helper puro `src/lib/bpm/automacoes/minuta-movimento-livre.ts` para classificar o grafo estrito, compartilhado materializador/worker.
- [ ] **Editar:** `src/lib/bpm/transicao-command.ts` — marcador emitido pelo servidor em novos movimentos livres autorizados; supressão geral preservada.
- [ ] **Editar:** `src/lib/bpm/automacoes/eventos.ts` — gate seletivo antes de materializar e dados mínimos de versão/grafo/evento/ator necessários.
- [ ] **Editar:** `src/lib/bpm/automacoes/central-runtime.ts` — gate repetido antes da execução excepcional; usar o gerador já integrado.
- [ ] **Editar:** `src/lib/bpm/automacoes/orquestrador.ts` — helper estreito por novo evento; materializador e processador recebem escopo exato, inclusive no resgate de execução antiga. O comando chama somente esse helper após commit com falhas isoladas.
- [ ] **Consultar:** `ownership.ts`, `lideranca-setor.ts`, `automacoes/central-schemas.ts`, `automacoes/executor.ts`, `automacoes/orquestrador.ts`, `Cards.ts`, `contratacao-comercial-server.ts` e configuração real inspecionada pelo DevOps.
- [ ] **Testar:** materialização, movimento livre/eventos, execução central, geração BPM e preservação de conferência/projeção comercial. Fixtures de banco exclusivamente privadas; nenhuma execução de worker global real.
- [ ] **Controles conferidos:** menu/registry, atalhos, novas rotas, middleware/auth e schema não precisam de alteração: não há botão, módulo, endpoint ou modelo novo. ACL existente deve ser reutilizada, sem conceder permissão adicional de edição/encaminhamento.
- [ ] **Memória:** Scribe/Kowalski registram a exceção documental e seus limites após implementação/revisão; SM possui a story separada.

## Matriz mínima de testes

1. Novo Admin e novo líder válidos: flag apenas server-side; movimento continua livre e não enfileira envio/cadências.
2. Evento antigo sem marcador, ator forjado/desativado/revogado, automação sem versão ativa, etapa/pipeline divergente, card arquivado/cancelado: zero geração.
3. Grafo exato GERAR_CONTRATO → FIM: permitido; grafo misto com criar card, alteração de campo, comunicação/HTTP, espera, condição em nó ou nó extra: bloqueado integralmente antes de materializar e antes do worker.
4. Condição Serviço falsa: IGNORADA; template/contratada inválidos ou variáveis ausentes sem permissão configurada: falha diagnóstica, sem aprovação inventada.
5. Minuta criada em CONFERENCIA com identidade BPM/campo corretos, sem alerta Comercial, assinatura/pagamento ou filhos de setor; finalizar continua ação separada.
6. Replay/reentrada/concorrência: sem documento/anexo duplicado, sem tocar PDF manual existente. Mudança de autoridade, estado ou grafo entre materialização e execução impede efeito.
7. Flush imediato com filas sentinela: materializar/processar somente novo card/evento elegível; pendências do mesmo card de evento anterior, grafos mistos, outros cards e EM_EXECUCAO vencidos fora do escopo ficam byte a byte preservados. Lease ocupado não permite ampliar escopo. Minuta pode falhar, mas o movimento já confirmado permanece sucesso.
8. Evento marcado sem histórico causal correspondente, com ator/card/etapa/versão discordantes ou chave de origem incompatível é recusado antes da materialização e no worker. Marcação antiga não é reconstruída por leitura.

## Reteste no staging sem destruir a fixture anterior

O plano inicial de reutilizar a empresa fictícia 3066 pressupunha que o encaminhamento permitisse um Financeiro novo para outra negociação. A UI real informa que o envio cria o Financeiro somente quando a empresa não possui card financeiro ativo; portanto esse cenário não garante um destino fresco e não deve reutilizar o Financeiro manual antigo para comprovar geração.

Fixture remota escolhida: criar **uma empresa fictícia nova e um par Comercial → Financeiro** pelos caminhos normais da UI (uma empresa, dois cards), com CNPJ sintético válido e não utilizado, e razão/fantasia identificadas como **AUDITORIA MINUTA AUTO...**. Conferir aceitação pelo formulário e ausência de cadastro anterior antes de executar; não alterar configuração nem contornar os validadores para preparar o teste. A empresa 3066 e seus cards/arquivos permanecem intactos. Isso é preparação de teste, não mudança de regra do produto. “Nenhuma empresa nova” era uma hipótese sujeita à verificação da UI, não uma contagem garantida.

Preencher o Serviço aplicável na nova negociação, encaminhar explicitamente ao Financeiro e entrar em Elaboração como Admin depois do deploy de staging. Verificar um documento CONFERENCIA, seu anexo/identidade do novo Financeiro e ausência de efeitos prematuros. Reentrada comprova reuso. Comparar snapshot restrito da fixture antiga antes/depois para comprovar preservação de seu PDF/campo/versões, sem apagar ou baixar dados de clientes reais.

Esse mínimo comprova Admin remoto; líder fresco remoto exige outro par e credencial legítima. Se líder for exercitado apenas em testes locais, declarar esse limite. Casos negativos de grafo/configuração usam fixtures locais, sem alterar automações publicadas para ensaio.

Produção permanece somente em diagnóstico nesta tarefa. Qualquer correção passa por story, gates, staging e pedido explícito de promoção; não executar geração por CLI nem mover o card real de CARNES SANTA CATARINA para realizar o reteste.
