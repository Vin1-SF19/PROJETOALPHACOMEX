# Contratos pendentes no Comercial — arquitetura de integração

Data: 21/10/2026. Base: `87c2e78f`, branch `staging`. Arquitetura: Aria.

## Decisões e limites

O usuário escolheu **“Após finalizar no Financeiro, mantendo a conferência atual”**. Para o contrato gerado, a minuta em `CONFERENCIA` não libera documento, cor verde, tarefa ou notificação. A liberação conserva a exigência de contrato elaborado, documento `FINALIZADO`, PDF válido e identidade BPM comprovada.

Adotar **projeção de documentos somente para leitura**, calculada no servidor. Não duplicar `BpmCardAnexo`, apontar um campo comercial para o ID de anexo financeiro, copiar blob ou gravar URL do armazenamento no DTO. Não alterar schema, configurações publicadas, dados em lote, contratos antigos ou produção. Leituras não materializam tarefas, estados, históricos ou notificações.

O contrato assinado é independente: disponibilidade de um arquivo válido no campo canônico de assinado não exige nem estabelece `STATUS_ASSINATURA=Assinado`, pagamento ou conclusão financeira. Preservar MIME e nome dos uploads válidos já suportados pelo CRM; não introduzir uma restrição global a PDF. Documento oriundo do gerador continua PDF.

## Resolução e segurança

Evoluir `carregarAcompanhamentoComercial` em `src/lib/bpm/contratacao-comercial-server.ts` para resolver os dois documentos. Antes de consultar arquivos, exigir:

1. Comercial autorizado, pipeline comercial/Revisão de Radar e etapa Contrato fechado, preservando os bloqueios de arquivamento/cancelamento existentes.
2. Exatamente um Financeiro ativo vinculado e exatamente uma negociação comercial de origem inequívoca, conforme o contrato atual de vínculos. **Empresa do Comercial igual à empresa do Financeiro**, sem aceitar seleção por empresa como substituto do vínculo.
3. Cada arquivo deve ser o valor atual do seu campo financeiro canônico, pertencer ao mesmo Financeiro e ao mesmo `campoId`. Não procurar outro anexo arbitrário quando o valor atual não existir.

Slots:

| Slot comercial | Fonte financeira | Critério documental |
| --- | --- | --- |
| `alpha.radar.fechado.contrato_para_envio` | `CHAVES_CAMPOS.LINK_CONTRATO` | `CONTRATO_ELABORADO=Sim`; arquivo próprio válido. Para referência do gerador: `FINALIZADO`, PDF seguro e `__bpmCardId` igual ao Financeiro. |
| `alpha.radar.fechado.contrato_assinado` | `CHAVES_CAMPOS.ANEXO_ASSINADO` | Arquivo próprio válido no campo assinado; sem depender do slot para envio ou do status financeiro de assinatura. |

Uploads diretos/legados seguem os validadores e allowlists de armazenamento existentes, com nome/MIME reais. Referências do gerador seguem a validação específica de token, status, origem e prefixo de PDF; não reutilizar a rota genérica de anexo BPM para elas. IDs, token, pathname, URL física e variáveis internas permanecem no contexto do servidor.

Vínculo ambíguo ou documento ausente/inválido não derruba a leitura integral do card: os slots ficam pendentes, sem link, com diagnóstico público seguro quando necessário. A rota de arquivo recusa o acesso correspondente. Não escolher silenciosamente um dos vínculos.

## Contrato do DTO

Acrescentar propriedade aditiva ao retorno de `ObterCardBpm`; objetos de campo e `anexos` locais conservam seus contratos persistidos:

```ts
type TipoContratoComercial = "para_envio" | "assinado";
type DocumentoContratacaoComercial = {
  id: string; // identidade de apresentação estável por Comercial + slot
  nome: string;
  tipo: string; // MIME validado; gerador => application/pdf
  urlAcesso: string; // somente endpoint local abaixo
  origem: "CONTRATACAO";
  somenteLeitura: true;
};
type SlotContratoComercial = {
  estado: "PENDENTE" | "DISPONIVEL";
  documento: DocumentoContratacaoComercial | null;
};
type DocumentosContratacaoComercial = {
  paraEnvio: SlotContratoComercial;
  assinado: SlotContratoComercial;
};
// CardDetalhe.documentosContratacao: DocumentosContratacaoComercial | null
// null => card fora do escopo comercial/fechamento.
```

`DISPONIVEL` significa que a referência atual e a elegibilidade documental foram verificadas no servidor; o stream ainda pode retornar indisponível se o objeto físico não existir. Não fazer chamadas ao armazenamento dentro da transação para colorir a interface.

Os dois campos publicados exibem sua projeção: PENDENTE com pulsação discreta e `motion-reduce`, ou disponibilidade verde com nome/abrir. Essa apresentação é somente leitura e não produz rascunho, campo alterado, autosave ou payload de transição. Não marcar obrigatoriedade como satisfeita gravando o ID financeiro no Comercial.

**Compatibilidade com uploads comerciais existentes:** o DTO acima representa exclusivamente documentos elegíveis do Financeiro; não acrescentar fallback de arquivo comercial ao resolvedor nem mudar seu domínio. Na apresentação do campo, o documento financeiro projetado disponível tem prioridade. Se ele não estiver disponível e já existir um anexo local válido do Comercial naquele campo, mostrar esse arquivo pelo acesso genérico existente, identificado como **Anexado no Comercial**; seu verde indica somente disponibilidade desse arquivo e não finalização pelo Financeiro. Não criar alerta financeiro por esse fallback visual. Quando ambos existirem, o anexo local continua listado e acessível na aba Anexos, sem remoção ou alteração silenciosa. Sem anexo local e com minuta financeira em CONFERENCIA, o slot permanece pendente. Isso se aplica aos dois campos, sem novos fallbacks especiais no servidor para assinado.

Os validadores das mutações continuam recusando referências de arquivo que não pertencem ao card/campo autorizado. Não criar exceção de escrita para o ID projetado; qualquer defesa específica dos dois slots deve ser aplicada no servidor, sem alterar a configuração publicada de campos em lote.

Na aba Anexos, combinar anexos locais com até dois documentos projetados disponíveis, uma entrada por slot. A contagem da aba e sua lista devem usar a mesma coleção combinada; não somar um item novamente se houver referência de apresentação repetida. Não oferecer excluir, substituir ou enviar o ID projetado a `ExcluirAnexoBpm`. `_count.anexos` do banco continua contando registros físicos; não o apresentar como total da coleção combinada. Contadores de outras telas que incorporarem projeções devem usar o mesmo cálculo, sem uma consulta documental por card no Kanban.

`VisualizadorAnexoCard` atualmente constrói a URL pelo ID e ignora URLs do anexo. Estender seu contrato para aceitar URL local de acesso tipada/validada, mantendo `/api/bpm/anexos/{id}` como comportamento padrão dos anexos reais. Aceitar para projeções exclusivamente a rota canônica com ID comercial e tipo enumerado; não habilitar URLs arbitrárias ou externas.

## Endpoint autenticado

Evoluir `GET /api/bpm/cards/[cardId]/contrato?tipo=para_envio|assinado`; ausência de `tipo` mantém `para_envio` para compatibilidade. Validar ID e tipo. Nenhuma URL, pathname, token ou ID financeiro vindo da requisição seleciona o arquivo.

Revalidar sessão/usuário ativo, ACL de leitura do Comercial, vínculo/empresa, campo proprietário e elegibilidade atual em **cada GET**. O closer autorizado no Comercial pode ler somente esses documentos vinculados sem receber acesso geral ao Financeiro. A permissão é documental e não concede edição, exclusão ou leitura de outros anexos financeiros.

Servir stream usando o token correto do armazenamento de origem, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, MIME validado e nome sanitizado no Content-Disposition. Usar inline somente quando a visualização segura existente suportar o formato, caso contrário download. Sem redirect para URL física. Respostas 401/403 para autenticação/ACL, 400 para tipo inválido, 404 para documento não elegível/ausente; erros de armazenamento não expõem referências internas.

## Transações e efeitos após o commit

Reutilizar `disponibilizarContratoComercial`, separando resolução documental de efeitos negociais. Ordem obrigatória:

1. Resolver ambos os slots independentemente; mudança no assinado deve invalidar a projeção mesmo quando já existe tarefa de envio ou envio acompanhado.
2. Preservar as regras atuais que impedem regredir acompanhamento após envio/assinatura/pagamento. Tarefa concluída não é reaberta por atualização documental.
3. Somente para documento de envio elegível e fluxo ainda aguardando envio: criar a tarefa determinística existente `idTarefaContratacao("envio", comercialId, financeiroId)` se ausente; definir alerta imediato e manter destinatário no responsável comercial canônico.
4. Identificar a revisão documental no servidor: anexo atual e, para gerado, documento/PDF finalizado atual. Usar hash dessa identidade em chave estável de evento de disponibilidade. Replay da mesma finalização/referência não altera alertaEm, não duplica tarefa, evento ou notificação. Nenhuma URL física vai para payload público.
5. Reaproveitar tarefa pendente em nova revisão válida sem criar uma segunda tarefa. Somente nova revisão de envio, ainda elegível ao acompanhamento, pode renovar seu alerta; assinatura isolada não renova o alerta de contrato pronto para envio. Reexecução da mesma revisão é no-op. Serializar disputa pelo CAS comercial existente e chave única de evento dentro da transação.
6. Retornar efeitos após commit, por exemplo `{ cardId, pipelineId, tarefaAlertaId? }`. Chamadores publicam realtime comercial para atualizar campos/Anexos e, quando houver alerta novo, carregam `tarefaAlertaSelect` e chamam `dispararAlertaTarefaBpm` depois do commit.

Manter título da tarefa **Enviar contrato**; descrição deve dizer **Contrato pronto para envio** e incluir empresa/documento de modo útil ao closer. `alertaEm=agora` integra sino, toast, recuperação por polling e deduplicação já existentes; não criar outro modelo/store/canal de notificações. Falha no Pusher não desfaz finalização ou upload confirmado; captura isolada mantém recuperação pelo sistema de alertas.

O destinatário é o responsável comercial persistido e elegível: conta ativa, acesso CRM e leitura do Comercial. Conferir isso antes da entrega, sem substituir silenciosamente pelo financeiro ou pelo ator que finalizou. Mudança de responsável e revogação seguem a ACL atual; a recuperação de alertas não pode expor documentos fora do acesso vigente.

Pontos de integração do backend: finalização do gerador, registro/substituição de anexo dos dois campos financeiros e atualização dos campos de contratação; central e legado devem ter o mesmo efeito. `__bpmCardId` deve ser gravado pelo servidor para **todos os templates gerados a partir do BPM**, não apenas o contrato padrão. Não confiar nesse valor vindo de edição do cliente e não consertar documentos antigos por backfill.

Não interromper sincronização de assinado com o retorno antecipado atual que encontra tarefa existente. Toda mutação de documento deve poder devolver invalidação comercial, mesmo sem nova tarefa, mudança de status ou novo alerta.

**Revisão documental para recuperação:** quando uma mutação financeira mudar a projeção (inclusive assinado, substituição ou remoção), atualizar `updatedAt`/`versao` do Comercial por CAS, sem alterar estados financeiros ou reabrir tarefa. Registrar fingerprint documental dos dois slots em histórico existente e comparar com o último estado conhecido: somente mudança real gera nova revisão; replay idêntico é no-op. Não usar apenas a existência da tarefa como marcador. A chave de evento deve incluir a revisão/causa da mudança, pois a sequência disponível → pendente → disponível → pendente é legítima e não pode ser suprimida por uma chave global constante para o fingerprint pendente.

Na base, o sinal realtime recebido já incrementa `realtimeRevision` do modal aberto mesmo sem alteração no manifesto. Porém o polling do board não atualiza o modal enquanto o card permanece no manifesto. Para recuperar eventos perdidos, comparar a revision anterior e a nova do **card selecionado**, antes de substituir o manifesto, e incrementar a revisão do detalhe quando ela mudar. O CAS comercial acima torna essa mudança observável. Atribuir explicitamente esse pequeno ajuste do Board ao owner frontend; não disparar leitura de documentos ou armazenamento por card do Kanban. Alternativa equivalente é polling autenticado do detalhe aberto, acordado com a coordenação, nunca HEAD do armazenamento.

## Regeneração, substituição e exclusão

Projeção acompanha somente o valor/revisão atual. Regeneração em CONFERENCIA volta a pendente até nova finalização quando o campo passa a apontar para essa nova minuta; PDF finalizado anterior não autoriza a nova referência. Finalização repetida da mesma revisão não renotifica.

Substituição/exclusão/limpeza do campo financeiro remove a disponibilidade projetada na leitura seguinte e emite invalidação comercial após commit. Não criar/remover registros de anexo comercial, não apagar blob compartilhado e não alterar assinatura/pagamento para esconder o arquivo. Preservar os guards atuais de exclusão financeira e de blobs. Campo de envio e campo assinado podem mudar separadamente; falha/remoção de um não disponibiliza nem apaga o outro.

Uma notificação já reconhecida não é reaberta por leitura. A tarefa é trabalho de envio, não um segundo registro de arquivo; a abertura do card/arquivo sempre revalida a disponibilidade atual. Não prometer acesso a uma revisão removida pelo fato de existir alerta antigo.

## Ownership e validação

Aria possui somente este documento. Backend: helper, DTO em Cards, rota, Anexos, gerador e executores. Frontend: campos/apresentação, lista/contagem da aba, visualizador e acompanhamento. SM possui a story; coordenação define arquivos compartilhados antes de edits. Preservar alterações de outros agentes.

Testes mínimos:

- CONFERENCIA não libera; FINALIZADO + origem correta + elaborado libera envio e alerta uma vez; todos os templates BPM recebem identidade confiável.
- Replay/finalizações concorrentes: uma tarefa, uma revisão notificada e eventos idempotentes; Pusher falho não reverte o documento.
- Assinado válido aparece com tarefa já existente e status financeiro ainda não assinado; ausência/arquivo de outro campo/card/empresa não aparece.
- MIME/nome preservados em upload permitido; token/status/origem/prefixo inválidos do gerador recusados; ausência física retorna erro seguro.
- Closer sem ACL financeira acessa somente os documentos da contratação comercial autorizada; outro Comercial/empresa, revogação, vínculo ambíguo e tipo/URL forjados são recusados.
- Campos projetados não entram no save; PENDENTE/verde independentes; preview usa endpoint correto; aba conta exatamente as entradas que exibe e projeções não têm excluir.
- Upload local comercial continua disponível como tal, sem alegar finalização financeira ou emitir alerta; quando coexistir com projeção financeira, ambas as entradas legítimas permanecem na aba Anexos.
- Substituição, regeneração, exclusão e limpeza invalidam a projeção; não recriam tarefa concluída nem regredem acompanhamento/assinatura/pagamento.
- Mudança isolada do assinado gera revisão comercial recuperável no polling do detalhe; replay idêntico não incrementa versão, e ciclos repetidos de disponibilidade/remoção não são perdidos pela deduplicação.
- Leituras repetidas não escrevem nada; nenhum teste executa worker global ou escreve em produção. Gates exigidos pela story no staging.


## Integração concorrente — baseline de staging atualizada

A worktree autoritativa desta entrega passa a ser `crm-contratos-pendentes-integrado-20261021`, baseada em `2f4d788bd6276dd0e092e6e5c1595151ac0f1bbb`. Foram preservadas a integração Instagram `50e53866` e a consistência de Líder Operacional `2f4d788b`; nenhuma alteração de ambiente, execução de script cadastral, configuração de banco ou publicação de produção foi realizada. Os 31 caminhos da feature desenvolvida sobre `87c2e78f` foram transferidos por patch binário com merge de três vias e cópia apenas dos arquivos novos. Cards, PipelineBoardClient e o teste de polling foram mesclados automaticamente preservando ambos os deltas. O delta adicional de `2f4d788b` não tem sobreposição com estes 31 caminhos.

A worktree original, logs e evidência dos gates sobre `87c2e78f` permanecem preservados. A suíte original apresentou mock incompleto de validações no teste de exclusão; o owner corrigirá o mock na worktree integrada. Novos quatro gates e QA sobre a árvore combinada são obrigatórios antes do push somente para staging. Esta nota não declara esses gates ou o reteste remoto concluídos.
