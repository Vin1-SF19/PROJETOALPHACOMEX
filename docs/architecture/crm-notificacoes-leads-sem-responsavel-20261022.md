# CRM — pendências compartilhadas e assunção por pipeline

Data: 2026-10-22. Base inspecionada: `6659f00c`. Desenho para implementação; não representa testes ou publicação. Story: `docs/stories/story-crm-notificacoes-leads-sem-responsavel-20261022.md`.

## Escopo confirmado e precedentes

O usuário confirmou alertas para todos os closers comerciais e todos os integrantes do setor correspondente no Financeiro/Operacional. Confirmou também nova opção **Assumir** nesses dois setores: a pessoa assume o card do seu setor, preservando o responsável comercial e, posteriormente, o financeiro. Abrir, ler ou marcar todas como lidas não equivale a assumir.

Reutilizar central, hook/store de alertas, canal privado por usuário, navegação com aba/iframe, assunções Instagram/NoLoss, ownership e helper transacional de encaminhamento. Não criar outra central, fornecedor de push, tabela de notificações, fila paralela nem responsável nulo. `BpmCard.responsavelId` obrigatório pode ser uma atribuição técnica herdada; não comprova assunção.

Comercial já possui fonte canônica: Instagram pendente é inbox `AUTENTICADO` com `eventoId=null`; NoLoss pendente é `status=pending`. `AssumirLeadInstagram`/`PromoverNolossLead` resolvem essa pendência via CAS transacional. Não deduzir assunção de responsável, primeiro acesso, etapa ou participantes.

Para novos encaminhamentos ao Financeiro/Operacional, adotar recepção explícita em histórico existente, seguida de assunção explícita. Cards legados sem recepção não passam a pendentes por inferência. Criação manual com responsável escolhido não é um encaminhamento novo e não recebe marca automaticamente. Nenhum backfill, SQL em massa, mudança de schema, seed ou configuração é necessário.

## Contrato compartilhado backend/frontend

Criar módulo puro `src/lib/bpm/notificacoes-leads.ts`, sem Prisma/auth/server imports. Exportar schemas Zod e tipos inferidos, constantes e formatadores. Contrato comum liberado aos implementadores:

```ts
type ResponsavelPipelineBpm = {
  pipelineId: string; pipelineNome: string;
  setor: 'COMERCIAL' | 'FINANCEIRO' | 'OPERACIONAL';
  usuarioId: number; nome: string;
};
type DestinoAlertaLeadBpm =
  | { tipo: 'LEAD_VIRTUAL'; pipelineId: string;
      origemLead: 'instagram' | 'noloss'; leadId: string }
  | { tipo: 'CARD'; pipelineId: string; cardId: string; recepcaoId: string };
type AlertaLeadBpm = {
  id: string; tipo: 'LEAD_SEM_RESPONSAVEL';
  fonte: 'INSTAGRAM' | 'NOLOSS' | 'ENCAMINHAMENTO';
  origem: 'INSTAGRAM' | 'SITE' | 'OUTRA';
  pipelineId: string; pipelineNome: string; etapaId: string; etapaNome: string;
  nome: string; email: string | null; telefone: string | null;
  cnpj: string | null; resumo: string | null; recebidoEm: string;
  destino: DestinoAlertaLeadBpm;
  responsaveisAnteriores: ResponsavelPipelineBpm[];
};
type RecebimentoPipelineBpm = {
  recepcaoId: string; status: 'PENDENTE' | 'ASSUMIDO'; recebidoEm: string;
  podeAssumir: boolean; motivoImpedimentoAssuncao: string | null; assumidoEm: string | null;
  assumidoPor: ResponsavelPipelineBpm | null;
  responsaveisAnteriores: ResponsavelPipelineBpm[];
};
```

Exportar `paginaAlertasLeadsBpmSchema`, `BPM_LEAD_ALERTA_EVENT = 'bpm-leads-atualizados'`, `urlLeadAlertaBpm(alerta)` e `detalhesAlertaLeadBpm(alerta)`. IDs estáveis: `lead:${pipelineId}:${fonte}:${sourceId}` e `recepcao:${historicoRecepcaoId}`. Datas ISO; nunca ID substituindo nome. Ausência de CNPJ não impede consulta, toast ou abertura.

`GET /api/bpm/leads/alertas` autenticado retorna `{ alertas: AlertaLeadBpm[], proximoCursor: string|null, snapshotEm: string }`. Sem escrita, worker, promoção, primeiro acesso ou geração de históricos. Serviço server-only em `src/lib/bpm/notificacoes-leads-server.ts` concentra projeção, fontes, audiência e fanout. Leitura direcionada `ObterLeadPendenteNotificacaoBpm(destino)` aceita somente o destino discriminado `LEAD_VIRTUAL`; em action dedicada, valida fonte, pipeline, audiência e pendência via `obterAlertaLeadPendenteBpm(userId,destino)`, então reutiliza `ListarCardsPipelineBpm(pipelineId,[leadId])`, confirma a origem virtual e retorna `{success,data:CardBpm}`. Não buscar um ID virtual na tabela física.

`ObterCardBpm` recebe campo aditivo `recebimentoPipeline: RecebimentoPipelineBpm|null`. Consultar esse estado não assume. Ownership atual já permite visualizar não membro com módulo/pipeline/etapa autorizados, como `VISUALIZADOR`; não ampliar edição global para tornar o botão acessível. Antes do claim, ações comuns continuam sujeitas ao ownership existente.

## Recepção e assunção Financeiro/Operacional

Ponto único: `executarEncaminhamentoBpm` em `src/lib/bpm/automacoes/encaminhamento.ts`, compartilhado por runtime central, legado e encaminhamento administrativo. Criar recepção somente quando realmente cria card de destino Financeiro/Operacional; identificar destinos pelos helpers/chaves canônicos existentes, nunca texto livre enviado pelo cliente ou uma empresa específica. Retornar/reutilizar card existente não cria outra chegada, não reinicia pendência e não desfaz assunção.

Na mesma transação de card/vínculo/cópia/outbox, gravar `BpmCardHistorico` com ação `RECEPCAO_PIPELINE_PENDENTE`, ID determinístico reservado `recepcao-pipeline:${cardDestinoId}` e JSON versionado `{versao:1,cardDestinoId,pipelineDestinoId,cardOrigemId,pipelineOrigemId,execucaoId,responsaveisAnteriores}`. `createdAt` é a chegada. Registrar somente em código servidor de encaminhamento, sem API genérica para publicar esse marcador. O ID determinístico impede duplicação por retry, embora o helper já deduplique destinos. Estado de recepção é o par de eventos auditáveis específico; não reutilizar `BpmCardEstado.outcome/subStatus` para uma finalidade diferente.

Snapshot de responsáveis anteriores deriva do card de origem e de recepções/assunções anteriores comprovadas, mantendo IDs, setor e nomes de apresentação. No Financeiro preservar Comercial; no Operacional preservar Comercial e Financeiro. Para origem legada, consultar somente vínculos explícitos da mesma empresa e negociação inequívoca; não escolher arbitrariamente um de vários cards da empresa. Responsável nominal de um setor ainda pendente não vira assunção histórica comprovada. Nome ausente usa rótulo honesto, sem atribuir o responsável atual de outro setor como vendedor.

Nova action `AssumirRecebimentoPipelineBpm({cardId,recepcaoId,versaoEsperada})` em `src/actions/bpm/Recebimentos.ts`, com helper server-only `src/lib/bpm/recebimentos-card-server.ts`. Ator é sempre a sessão; não aceitar `userId`, setor, responsável anterior, status ou marker do cliente. Exigir conta ativa, CRM efetivo, setor correspondente, pipeline ativo, acesso e visibilidade atual `podeVer && podeAgir`, elegibilidade a responsável, card não arquivado/cancelado/concluído, recepção legítima do mesmo destino e ainda sem assunção. Aplicar também restrições de trabalho específicas já existentes, incluindo a regra Boas-vindas Operacional; não alargar capacidade operacional por esta action.

Na transação: revalidar tudo, ler versão/updatedAt, CAS do card com incremento de `versao`, alterar **somente o responsável do alvo** para o ator e reconciliar membros do alvo como na troca canônica de responsável (um `RESPONSAVEL`, anterior preservado como participante, administradores/participantes restantes preservados). Gravar `RECEPCAO_PIPELINE_ASSUMIDA`, ID determinístico `assuncao-pipeline:${cardId}`, referenciando `recepcaoId`, ator e versão. Publicar evento existente `RESPONSAVEL_ATRIBUIDO` com chave idempotente por recepção e contexto de assunção, sem `CARD_MOVIDO`, nova entrada de etapa ou repetição do encaminhamento. Histórico, owner, membros e evento pertencem ao mesmo commit. Retry pelo mesmo vencedor devolve resultado idempotente; outro ator recebe já assumido/conflito e refresca. Falha não resolve a pendência.

**Recepção ainda pendente em origem já encaminhada:** se um Admin encaminhou Financeiro ainda não assumido ao Operacional e o card financeiro permanece `ATIVO`, a pessoa elegível do Financeiro pode assumir sua recepção depois. Assumir é uma atribuição transacional específica; não equivale a editar conteúdo e não exige remover `bloqueadoPorEncaminhamento`. As verificações de setor, `podeVer/podeAgir`, elegibilidade, estado ativo e demais guardas continuam obrigatórias. A ação não muda etapa, status, vínculos ou finalização: a regra existente de ownership mantém esse card encaminhado somente leitura para edição/trabalho após o claim. Não conceder permissão genérica de editar nem usar `editarCard` como autorização substituta da assunção. Snapshot do Operacional permanece o do instante do seu recebimento: Financeiro não assumido naquele instante não ganha responsável histórico retroativo. Testar claim permitido com posterior edição negada e snapshot de destino imutável. Card financeiro concluído/arquivado/cancelado continua inelegível a novo claim.

Claim nunca altera cards/vínculos de origem, `alpha.vendedor.a`, parceiro/origem, contrato, status financeiro, pagamentos, anexos ou campos globais de cliente. Não copiar o responsável financeiro para “Vendedor responsável”. UI apresenta “Responsável no Comercial: Nome”, “Responsável no Financeiro: Nome” e equivalente Operacional segundo snapshot/assunção; setor atual pendente indica aguardando assunção, mesmo havendo owner técnico estrutural. A nova ação **Assumir** no detalhe do card é parte do pedido explícito, não um botão paralelo de CRM.

**Fonte automática do vendedor:** preservar o valor persistido não basta se `carregarValoresCanonicosCampos` resolver o campo `alpha.vendedor.a` pela fonte `CARD.responsavelNome/Id`, que passa a apontar para o novo responsável financeiro. Resolver a identidade comercial da mesma negociação para esse campo específico, usando snapshot de recepção com setor Comercial ou vínculo comercial explícito e inequívoco da mesma empresa. Reutilizar helper comum de contexto comercial na projeção/formulário/resumo; manter semântica normal de `CARD.responsavel*` para os demais campos de responsável atual. No Comercial, vendedor continua o responsável comercial. Ausência/ambiguidade não autoriza fallback para Financeiro/Operacional: para esse campo no Financeiro/Operacional, sem snapshot Comercial comprovado ou vínculo Comercial inequívoco da mesma empresa/negociação, retornar vazio/indisponível. Esse fallback de leitura também protege cards legados sem recepção, sem alterar seus dados. Carregar somente identidade/nome necessários do contexto vinculado, sem conceder acesso ao card comercial inteiro. Se o tipo de campo canônico não carrega `chave`, acrescentar sua identidade na leitura para selecionar corretamente esta política; não alterar configuração de fonte nem dados em massa. Teste obrigatório atravessa o resolver canônico e `ObterCardBpm`: Closer A → Financeiro B → Operacional C continua exibindo vendedor A, além dos responsáveis B/C nos respectivos setores.

Pendência nativa depende da recepção não resolvida, não da etapa de entrada nem de `responsavelId`: mover o card livremente não a consome. Arquivamento/exclusão, pipeline inativo ou perda de ACL excluem a projeção autorizada, sem deixar uma entrada que abra um recurso inexistente. Não reativar automaticamente recepções ao reabrir card/reciclar vínculo; um ciclo futuro distinto exige desenho explícito.

## Audiência e origem

Todos os integrantes ativos do setor correspondente que tenham CRM efetivo, acesso ao pipeline e `podeVer` na etapa aplicável recebem a pendência, inclusive visualizadores que ainda não podem assumir. Elegibilidade a responsável, `podeAgir` e guardas específicas de trabalho são exigidas somente na ação de assunção, nunca usadas para esconder alertas de quem pode visualizar. Comercial inclui família canônica `Comercial`/`Lider Comercial`; Financeiro inclui seu setor e liderança efetivamente reconhecida; Operacional inclui `Operacional`/`Lider Operacional`. Reutilizar normalização de roles/catálogo, `listarUsuariosComAcessoCrmBpm`, `usuarioElegivelResponsavelBpm`, ACL do pipeline e visibilidade. Admin/TI/CEO global não vira closer/integrante apenas por bypass. Admin fora do setor correspondente pode visualizar segundo a política atual, mas não recebe nem assume uma recepção por bypass administrativo. Não criar lista fixa de IDs nem conceder acesso para aumentar audiência. Usuário do setor não precisa já ser participante do alvo para receber/visualizar; seu claim depende das condições de ação acima. `podeAssumir=false` mantém a pendência e traz `motivoImpedimentoAssuncao` honesto para a UI, por exemplo permissão somente de visualização/restrição da etapa. Não prometer no toast que qualquer destinatário poderá assumir. A guarda Boas-vindas permanece: audiência do setor pode visualizar sem ganhar a capacidade de trabalhar/assumir.

Instagram tem origem comprovada no adapter autenticado e destaque roxo. NoLoss não comprova automaticamente site: seu payload atual não carrega essa proveniência. Para conectar site ao ingresso real sem schemaDB, aceitar opcionais limitados `utmSource`, `utmMedium`, `utmCampaign` no endpoint NoLoss autenticado e persistir nas colunas existentes; somente chaves presentes atualizam, retry omitido não apaga dado e não reseta status/promotedCardId. `utmSource` normalizado `site`/`website` comprova SITE azul; demais/desconhecido OUTRA normal. Payload anterior continua válido. Não alterar configuração externa/env nem assumir que NoLoss proveniente de anúncio Instagram é inbox Instagram. Documentar o campo opcional do consumidor na integração existente.

## Central, transporte e navegação

Estender `useBpmTarefasNotifications`, seu store e `CentralNotificacoesPainel`; coleção de pendências separada dos flags de tarefas removidas. Reconhecimento por usuário controla toast/leitura, nunca filtra pendência da central. O item não oferece excluir. Marcar todas, clicar, fechar toast ou limpar notificações comuns não resolve essa coleção. Persistir localmente somente identidades reconhecidas por usuário, nenhum conteúdo do lead.

Bind de `BPM_LEAD_ALERTA_EVENT` na mesma subscription privada de tarefas por usuário já autenticada. Publicação pós-commit best-effort de invalidação mínima `{pipelineId,timestamp}` para destinatários elegíveis, sem nome/email/telefone/CNPJ/IDs de lead no Pusher. Usar API para conteúdo atual. Producers: ingresso novo IG/NoLoss, claim IG/NoLoss, novo destino com recepção e claim nativo. Notificar também após falhas de rede posteriores via polling; falha de realtime não desfaz transação. Não introduzir assinatura global de pipeline que conflite com cleanup da assinatura do board.

Reutilizar recuperação inicial/foco/online/reconexão/polling 30s. Ordenação determinística por chegada, fonte e ID. Se paginado, cursor versionado vinculado ao usuário/filtro e watermark `snapshotEm`, percorrer **todas** as páginas e só então trocar a coleção atomicamente. Sem truncamento silencioso/maxpages que pareça coleção completa. Erro de página/rede/schema preserva último resultado; 401/403 limpa dados da sessão. Token/generation descarta resposta antiga após claim, troca de sessão ou invalidação. Novas chegadas durante snapshot entram na próxima consulta; não omitir antigas pela aplicação de limite antes da ACL. Se coleção completa única for adotada inicialmente, `proximoCursor=null` deve significar completa de verdade, não limite oculto.

Estender o protocolo existente de navegação por união typed e manter URLs físicas de tarefas retrocompatíveis. Virtual usa `leadId+origemLead+pipelineId`; nativo usa card físico e recepção. Mesma aba CRM, handshake same-origin e fonte do iframe verificada; ACK somente para intenção atual aberta. Lookup virtual direcionado funciona mesmo fora da página/filtro do board e abre `NolossLeadModal` existente, sem promoção. Nativo abre `CardFullViewModal`; somente botão explícito chama claim. Lead assumido por outra sessão durante clique não é recriado; conciliar e mostrar estado atual, abrindo card resultante apenas após ACL própria. Clique jamais simula Assumir.

## Blueprint e ownership

| Dono | Arquivos/pontos de integração |
| --- | --- |
| Backend/Echo | Novos `notificacoes-leads.ts`, `notificacoes-leads-server.ts`, `recebimentos-card-server.ts`, `actions/bpm/NotificacoesLeads.ts`, `actions/bpm/Recebimentos.ts`, `app/api/bpm/leads/alertas/route.ts`; testes de servidor correspondentes |
| Backend/Echo | Ingestões Instagram/NoLoss, actions de assunção atuais, helper `automacoes/encaminhamento.ts`, projeção aditiva `Cards.ts/ObterCardBpm`, resolver canônico de campos e contexto vendedor da mesma negociação; documentação de payload opcional NoLoss |
| Frontend/Nova | `useBpmTarefasNotifications`, store existente, `CentralNotificacoesPainel`, `useBpmCardNotificacaoNavigation`, protocolo/parse de intenção compartilhado com compatibilidade de tarefas, page/board e modal virtual; `CardFullViewModal` e cabeçalho/contexto de responsáveis para ação nativa |
| Arquitetura | Este arquivo e atualização autorizada de escopo/ACs da story; sem runtime |
| QA/DevOps | Testes independentes, gates, deploy/alias e smoke staging; produção fora de escopo |

Coordenar arquivo compartilhado de intenção com Nova; Echo fornece os tipos neutros. Não editar schema/ownership global por conveniência. Consultar `ownership.ts`, `Membros.ts`, `resumo-contratacao-server.ts`, `usuarios-campos.ts`, `instagram-leads-server.ts`, `noloss-leads.ts` e contratos de alertas de tarefas como precedentes.

## Segurança, limites e testes de aceitação

Esta seção é análise de desenho, não auditoria Anubis executada. Boundaries: ingresso com segredo não recebe autoridade de claim; JSON histórico público/editor genérico não pode fabricar recepção; GET não escreve; sessão/candidato/ACL são revalidados em transação; histórico determinado exige card/pipeline/vínculo/execução legítimos. Fonte desconhecida não ganha tipo privilegiado pelo cliente. Escapar texto e limitar campos; payload comercial mínimo, sem raw webhook, credenciais ou publicidade excluída. Nome é apresentação; IDs permanecem referências servidoras.

Testar: IG e NoLoss sem CNPJ; site comprovado pelo ingresso opcional e demais normal; retry não apaga origem/status nem duplica toast; todos os colegas elegíveis e nenhum outro setor/bypass indevido. Ler/marcar todas/fechar toast/reload preservam central. Dois claims virtuais e dois claims nativos concorrentes: um vencedor, rollback mantém pendência, replay não duplica histórico/evento. F/O: handoff novo cria uma recepção, reutilização não recria, nomes Comercial/Financeiro preservados e vendedor/campos/status/pagamentos intactos. Antes claim visualizar não concede editar; claim não libera trabalho proibido em Boas-vindas. Mover etapa/Admin não resolve recepção; arquivado/deletado/revogado não deixa card inacessível listado.

Testar snapshots acima da página, empates de datas/fontes, falha da segunda página, revogação, respostas fora de ordem e ausência de Pusher. Deeplink virtual fora da página, destino já assumido, troca rápida A→B, iframe/origem inválidos e clique sem chamada de claim. Regressão das tarefas e notificações existentes. Gates reais: lint, typecheck, testes e build; depois revisão independente e smoke staging com fixtures sintéticas autorizadas, sem backfill nem produção. Registrar exatamente o que foi verificado; não declarar multicliente real com base só em harness.

## Trade-offs

Projeção evita tabela de notificações, cópias e jobs de limpeza. Histórico com identidades determinísticas e CAS acrescenta lifecycle auditável sem migração; exige parser compartilhado e leitura por ações/IDs conhecidos (não varrer JSON solto nem usar limite dos últimos 50 eventos do painel). A escala atual deve ser medida nos testes; se o volume exigir índice/estado materializado futuro, propor separadamente com Vault. Não degradar silenciosamente completude para contornar custo. Reverter código não apaga recibos nem assunções já auditados; preservar IDs/versionamento para rollout seguinte.
