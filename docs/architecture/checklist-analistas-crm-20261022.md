# Contrato de implementação — CheckList por analista e vínculo CRM

Aria / Bibble · 2026-10-22 · bases Painel `69047dee`, Portal `edcf2e8e`.

Escopo aprovado: A01–A17 do relatório, duplicações, organização por analista e integração CRM B. Documento normativo para SM/Dara/Echo/Nova/Sage. Define contratos de código e defaults revisáveis; não autoriza operações de banco, configuração ou produção. Nenhum código, migration real, credencial ou ambiente foi alterado nesta etapa.

## 1. Decisões fechadas para esta entrega

1. A empresa cadastral é `Cliente.id` (Int). O atendimento/dossiê é `OperacionalClientes.id` (String). Conta externa é `ClienteOperacional.id` (String). Nunca intercambiar os três nem inferir vínculo por pasta, nome ou primeiro CNPJ.
2. Dono interno: FK nullable `OperacionalClientes.analistaId → usuarios.id`, com índice e `onDelete: SetNull`; legado permanece null sem inferência. Novos atendimentos exigem dono explícito. Um master pode ter vários atendimentos legítimos; não adicionar unique por master ou master+conta.
3. Leitura global de empresas, itens, modelos e documentos para qualquer ator interno ativo com permissão efetiva `checkList`. Escrita do atendimento/documento/item/tipo somente `analistaId === ator.id` OU setor persistido equivalente a `SETOR_LIDER_OPERACIONAL`. Admin, CEO, TI e Líder Comercial não têm bypass de escrita. Ser dono não dispensa módulo nem conta ativa.
4. Atribuição/reassociação de dono e administração de catálogo global/específico: somente Líder Operacional com módulo. Analista Operacional/Operacional pode criar atendimento para si; líder pode criar para analista elegível. Outro perfil com módulo lê, mas não cria atendimento nem gerencia conta externa por privilégio administrativo genérico.
5. Sidebar esquerda: “Todos os analistas” primeiro; consulta independente de usuários ativos dos setores normalizados `OPERACIONAL` ou `ANALISTAOPERACIONAL`, inclusive zero empresas. Inclui Líder Operacional ativo quando possui empresas, e owners referenciados fora desse catálogo como entradas legadas identificadas (inclusive inativos) para não esconder dossiês. Não incluir todos os administradores. Ator elegível é definido por `normalizeRole`/`isSameRole`, tolerando acento, espaço e pontuação; não prefixo genérico LIDER nem nome de pasta.
6. Empresas sem dono continuam em Todos; líder recebe filtro/ação de pendentes de atribuição, sem inventar analista “Sem Pasta”. “Sem Pasta” é filtro virtual e sai da navegação. Pasta “Teste” somente removida por operação conferida e autorizada sob Vault, desconectando relações sem apagar empresa/checklist/documento. Demais pastas ficam preservadas em dados legados, sem governar dono.
7. Novos modelos afetam SOMENTE checklists criados posteriormente. Edição publica nova revisão; desativação/ordem afetam materializações futuras. Instâncias anteriores preservam snapshots, inclusive concluídas. Não implementar aplicação retroativa em massa nesta entrega.
8. Um card tem zero ou um registro operacional selecionado; um registro pode ser reutilizado por vários cards da mesma empresa master. O vínculo acompanha o tipo ativo do registro operacional. Não espelha itens, arquivos ou tarefas; não conclui tarefas nem move etapas por 100%. Fluxo Excel vigente e Procedimentos BPM continuam independentes.

## 2. Fronteiras de domínio e autorização

Novos módulos internos Painel, com nomes estáveis para implementação:

- `src/lib/checklist/acesso.ts`: `obterAtorChecklist()`, `exigirLeituraChecklist(ator)`, `exigirEscritaChecklist(tx, ator, empresaId)`, `exigirLiderChecklist(ator)`, `obterCapacidadesChecklist(ator, empresa)`.
- `src/lib/checklist/schemas.ts` e `types.ts`: DTOs e validação compartilhada entre actions e UI; não importar Prisma/segredos em cliente.
- `src/lib/checklist/service.ts`: única implementação transacional de criação/seleção, PATCH, dono, documentação e resumo. Actions atuais viram fachadas autenticadas compatíveis enquanto consumidores migram.
- `src/lib/checklist/leitura.ts`: resolver ativo, projeções paginadas, catálogo de analistas e histórico.
- `src/lib/checklist/modelos.ts`: catálogo e publicação de revisões; `items.ts` contém enum/labels/seções e fórmula pura única.
- `src/lib/checklist/eventos.ts`: gravação na transação e publicação/recovery sem acoplamento ao motor de tarefas BPM.
- `src/lib/checklist/documentos.ts`: validação de recibo, ACL, download e orçamento de stream.
- `src/lib/bpm/checklist-documental.ts`: adaptador de vínculo/leitura, usando ACL canônica do card e serviço CheckList, sem criar regra de automação.

Ator é relido do banco por ID de sessão, com status/sessão versão e permissões efetivas. Usar precedentes `lib/chamados/acesso.ts`, `lib/auth/acesso-painel.ts` e `lib/permissions/effective.ts`, removendo qualquer bypass de escrita emprestado. Permissão de módulo pode ter bypass global existente para leitura; ownership nunca herda isso. Cada comando relê ator/owner na transação e faz CAS do agregado; verificar capability no cliente serve apenas à apresentação.

Capacidades DTO: `{ canRead, canEdit, canCreateOwn, canAssignOwner, canManageModels, canManagePortalAccess, canLinkCrm }`. `canManagePortalAccess` exige líder ou criação do próprio atendimento por analista elegível; não permite trocar conta externa de atendimento alheio. `canLinkCrm` exige escrita no card E escrita no registro, além das permissões efetivas CRM+CheckList. Desvincular exige escrita do card e do registro atualmente associado; elimina-se a associação, nunca o dossiê. Para atendimento sem dono, só líder escreve.

Portal tem outra identidade: autenticação `ClienteOperacional`; pode ler registros cujo `clienteOperacionalId === session.user.id` e enviar/remover seus documentos conforme contrato atual. Não pode mudar item/status/tipo/dono/modelo nem acessar outro atendimento. Revalidar sessão e propriedade em action, upload, download, notificações e cada stream.

## 3. Contratos de leitura e UI

`listarAnalistasChecklist(): Result<AnalistaDTO[]>` retorna `id, nome, imagemUrl, ativo, legado, totalEmpresas`. Counts são globais autorizados e não extraídos de uma página de empresas. Lista sempre inclui elegíveis com zero. Não vazar e-mail/usuário/permissões de todo cadastro.

`listarEmpresasChecklist({ analistaId?, semAnalista?, busca?, tipo?, status?, page=1, pageSize=25 }): Result<Page<EmpresaResumoDTO>>`; pageSize máximo100, busca máximo200 caracteres, sort estável `createdAt desc,id desc`. Retorno `{ items,totalCount,page,pageSize }`; cálculo no servidor com mesma cláusula de filtro, sem carregar todos os filhos. Sem filtro significa Todos, incluindo owner null. Mudar filtro reseta página.

`EmpresaResumoDTO`: `id, clienteId, razaoSocial, cnpj, analista, tipoAtivo, checklistAtivoId, resumo, revision, capabilities`. `resumo` discrimina `SEM_CHECKLIST`, `SEM_ITENS`, `EM_ANDAMENTO`, `COMPLETO` (estado de leitura, não workflow); inclui obrigatórios totais/concluídos/pendentes e percentual. Zero obrigatórios não implica conclusão formal; manter percentual0 e estado SEM_ITENS quando não há itens, explicitar ausência de obrigatórios quando existem opcionais.

`obterEmpresaChecklist(id,{ checklistId? })`: seleciona ativo por igualdade exata de tipo, sem fallback ao primeiro. Falta da instância ativa retorna estado explícito; não cria na leitura. Parâmetro checklistId permite consultar histórico sem mudar ativo, com `historical:true`, capabilities de escrita false e aviso. Arquivos históricos continuam sujeitos a ACL. Paginar documentos/histórico à parte (50 default,100max); catálogo também cursor/paginação real, sem `take500` silencioso.

`ChecklistView` liga o rascunho à identidade `checklistId+revision`. Criar/trocar recebe DTO confirmado completo e substitui itens/seção/progresso. Troca com rascunho pendente pede salvar/descartar antes; refresh não apaga silenciosamente rascunhos. Estado de comando inclui pending/saved/error; tratar `{ok:false}` e rejeição de transporte com finally. Status usa último valor confirmado para rollback; serializar saves por item e CAS evita respostas antigas. Observação salva apenas quando alterada; documento sai da lista/contador somente após confirmação.

UI usa Dialog/AlertDialog/Sheet/Avatar existentes, tema existente, labels, foco e navegação por teclado. Sidebar móvel em Sheet. Histórico separa alterações de processo de documentos removidos e identifica ator de exclusão real, nunca deduzido por autor do upload. Remover componentes/exports legados somente após busca de callers e gates.

## 4. Contratos de comando, CAS e idempotência

Envelope único: `Result<T> = {ok:true,data:T,requestId:string} | {ok:false,error:{code,message,fieldErrors?},requestId:string}`. Códigos: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `MODEL_EMPTY`, `MODEL_CODE_CONFLICT`, `UPLOAD_INVALID`, `LIMIT_EXCEEDED`, `RETRYABLE`, `INTERNAL`. Mensagem pública sem erro Prisma/stack; logs com requestId, entidade, operação e código sem senha/token/conteúdo documental.

Comandos sempre `{ mutationId, expectedRevision, ...payload }`, exceto criação com mutationId sem revision. MutationId UUID gerado uma vez por intenção e preservado no retry. `OperacionalClientes.revision` Int default0 é CAS agregado: updateMany onde id+revision, incrementar na mesma transação; zero linhas -> CONFLICT com instrução de recarregar. Reatribuição de owner concorre no mesmo agregado. Retry já consumado com mesma mutationId devolve resultado/identidade anterior sem repetir efeito. Payload diferente com mutationId repetida retorna CONFLICT. Cada alteração grava evento/auditoria dentro da mesma transação; publicação externa só depois.

Assinaturas de fachadas novas ou adaptadas:

- `criarAtendimentoChecklist({mutationId,clienteId,clienteOperacionalId?,novaConta?,analistaId?,tipo?})`: resolve master por ID confirmado, verifica acesso/owner, conta e vínculo na MESMA transação. Próprio analista tem dono forçado para si; líder escolhe elegível. Novo mutationId significa nova ocorrência legítima; retry do mesmo não duplica. Não buscar/reutilizar atendimento por CNPJ nem impor unique empresa. Atendimentos parecidos podem ser exibidos ao usuário como candidatos, nunca bloqueados por regra inventada.
- `selecionarTipoChecklist({empresaId,tipo,expectedRevision,mutationId})`: núcleo único usado por criar/trocar/editar empresa; find-or-create pelo unique existente empresaId+tipo; materializa catálogo publicado específico+global. Tipo sem modelos retorna MODEL_EMPTY sem criar instância vazia. Já ativo é no-op confirmado, sem novo alerta. Anteriores preservados.
- `atualizarEmpresaChecklist({empresaId,patch,expectedRevision,mutationId})`: whitelist metadados operacionais; dono/conta são comandos separados; master cadastral readonly. Validar URLs/limites. Campo omitido preservado; null explícito limpa campo nullable.
- `atualizarItemChecklist({itemId,patch:{status?,observacao?},expectedRevision,mutationId})`: resolve agregado pelo item; aceita somente ativo em escrita; omissão preserva observação, `observacao:null` limpa. Sem mudança retorna DTO atual sem evento. Atualização e cache de progresso ativo são atômicos; fórmula pura compartilhada lista/detalhe/portal/CRM.
- `atribuirAnalistaChecklist({empresaId,analistaId,expectedRevision,mutationId})`: apenas líder; destino ativo elegível; registra antes/depois e retorna capacidades atualizadas.
- `publicarModeloChecklist`, `desativarModeloChecklist`, `ordenarModelosChecklist`: líder; revisão e mutationId próprios do catálogo; não varrem instâncias existentes. Escopo GLOBAL ou um tipo. Edição cria nova revisão imutável; obrigatório/código/seção/ordem validados.
- `excluirDocumentoChecklist({documentoId,expectedRevision,mutationId})`: soft delete com ator interno/portal, primeiro deletedAt preservado no retry; histórico e objeto físico preservados. Hard-delete export sem caller deve desaparecer da superfície pública. Observação de doc removido é readonly; restauração explícita pode reativar metadata se objeto existe, apenas owner/líder e com evento, nunca resetar data sem trilha.

Consolidação: `criarChecklist`, `trocarEmbasamentoChecklist` e caminho de atualização delegam a selecionarTipo. Fórmula/calcularProgresso duplica código e passa ao helper canônico. Enum/labels/tipos derivam de catálogo único compartilhado por contrato; `CHECKLIST_TEMPLATES` sem callers e componentes antigos podem ser removidos após confirmação. Domínios BPM não são duplicação removível.

## 5. Catálogo e snapshots

Modelo tem identidade lógica por escopo+codigo normalizado, versão crescente, ativo, ordem e autoria. Publicação imutável: nova versão torna anterior não selecionável para novas instâncias; não altera ItemChecklist existente. Global+específico com mesmo código: específico prevalece para esse tipo, em vez de materializar dois; colisão dentro do mesmo escopo retorna MODEL_CODE_CONFLICT. Ordenação explícita por seção/ordem/código/id. Snapshot do item contém descrição/seção/obrigatório/código/ordem e referência à revisão que o gerou; não rejoin em leitura para trocar conteúdo antigo.

Dara prepara bootstrap de identidade para modelos existentes SEM fundir/remover códigos homônimos automaticamente; diagnóstico identifica conflitos e exige resolução explícita antes de publicar nova revisão conflitante. Não fazer backfill retroativo de itens. Checagens de órfãos anteriores a qualquer FK. Modelos antigos podem ser desativados; não hard-deletar revisão referenciada. Alterar catálogo nunca reabre silenciosamente checklist100%.

## 6. Persistência: aproveitar o existente e adicionar só o necessário

Reutilizar `Cliente`, `ClienteOperacional`, `OperacionalClientes`, `Checklist`, `ItemChecklist`, `DocumentoChecklist`, `ModeloItemChecklist`, `NotificacaoCliente` e `Auditoria`. Não reutilizar `BpmCardChecklist` ou `BpmEventoDominio` como depósito de evento sem card: esses contratos alimentam motor/efeitos do BPM. Os precedentes BPM de outbox, CAS e alertas orientam o algoritmo, sem compartilhar filas que causariam tarefas acidentais.

Dara detalha nomes Prisma/SQL e migrations aditivas consistentes nos dois clientes. Mínimo lógico:

- OperacionalClientes: owner nullable e revision; Checklist: referência à revisão publicada/metadata snapshot se necessária; Item: ordem e identidade da revisão de modelo.
- Modelo: identidade, versão, ativo, ordem e autoria; constraints de identidade/revisão após diagnóstico de legados.
- Documento: storageProvider/key/access metadata nullable para legado, tamanho/MIME verificados quando presentes, autoria de upload/remoção interna ou conta portal; URL legada preservada até migração explícita. Recibo de upload persistido com token hash, conta/empresa/item, expiração e consumo idempotente.
- `ClienteOperacional.senhaHash` nullable; `senha` legada permanece String durante compatibilidade, novo hash usa senha vazia; não persistir duas cópias de segredo novo.
- Vínculo CRM: registro único por card (`cardId` unique/FK), empresaOperacionalId indexado, revisão e autoria. Vários cards podem apontar ao mesmo atendimento; excluir vínculo não usa cascade para o atendimento.
- `ChecklistEvento`: ID estável, mutationId unique, agregadoId, revisão, tipo, ator interno/conta/sistema, dados mínimos antes/depois, data e campos de publicação/retry. É journal de comandos/outbox, não fila de automação CRM. Identidade/hash do payload permite detectar retry divergente; retorno anterior contém apenas DTO mínimo seguro e é servido após revalidar ACL atual. Eventos de publicação de catálogo usam agregado próprio.
- `ChecklistEventoLeitura`: unique(eventoId,usuarioId), lidoEm; índice por usuário/data. Não há tabela genérica de leitura de alerta compatível já localizada. Esse estado não cabe em NotificacaoCliente (destinatário conta externa), em ConfirmacaoLeituraDocumento (outro domínio), nem no store Zustand.
- `NotificacaoCliente` existente recebe referência idempotente ao evento/recipiente (unicidade adequada), mantendo id,clienteId,lida,criadaEm e rota do portal. Criada junto da mutação quando há aviso real para o cliente. `Auditoria` registra autoria interna/ação com ID do evento; eventos com conta portal ficam no journal, sem falsificar usuarios.userId.

Novos eventos e recibos são dados de domínio; paginação/retenção não pode apagar evidência necessária por limpeza automática improvisada. Nenhum backfill, índice, enum ou alteração de tabela é executado nesta etapa.

## 7. Notificações confiáveis sem duplicação

A publicação real existe no Portal: `actions/checklist.ts` emite `private-checklist-docs/novo-documento-cliente`; adaptar ambos produtores/consumidores, não assumir ausência de produtor.

1. Upload/status efetivo grava evento e eventual NotificacaoCliente na mesma transação. Upload repetido com mesmo recibo devolve doc existente. No-op não publica.
2. Publicação Pusher póscommit envia apenas eventId/revision/empresaId e dados mínimos; falha deixa evento pendente. Worker protegido por segredo e scheduler isolado (DevOps) processa lote50, claim CAS, retry exponencial limitado, logs sanitizados. Não reutilizar cron de produção no staging.
3. Endpoint interno autenticado de eventos pagina por cursor estável `(createdAt,id)` e devolve eventos+readstate autorizados. Inicialização/reconexão/retorno de foco recupera pendentes do servidor; polling único no shell cobre ausência de realtime. Montagem de widgets apenas consome store.
4. Pusher auth valida ator persistido + checkList, não role de JWT ou bypassadmin. Pode manter canal comum autorizado pela leitura global; nenhum nome/documento é publicado sem ACL do módulo. Desmontagem remove somente callback e não derruba canal alheio.
5. Store deduplica eventId, toast reage ao ID novo (não length), limite50 é de apresentação, não de banco. Clique marca leitura no servidor por evento+usuário e navega; refresh/replay não reabre lido. Não marcar todos ao apenas montar lista. Canal/drop/reconexão e51º evento têm teste.
6. O endpoint global `api/notificacoes` e CentralNotificacoesPainel incluem esta fonte sem novo poller paralelo; contador/central/widget/toast usam mesmo estado. Não usar Date.now como identidade. Notificação conta externa continua lida separadamente no portal.

## 8. Compatibilidade Portal, master, senha e enum

O Portal `edcf2e8e` usa schema antigo: clienteId conta externa e dados cadastrais locais. Adaptar runtime Prisma ao schema canônico do Painel: OperacionalClientes.clienteId Int→Cliente; clienteOperacionalId String→ClienteOperacional; include cliente para master. Usar schema completo do Painel como fonte de verdade de DB e projeção equivalente de models necessários no portal; gerar ambos e teste de paridade. Portal NÃO executa `db push`, introspecção de escrita nem migration para ressuscitar schema antigo. Compatibilidade não significa detectar e aceitar dois layouts de banco silenciosamente.

Dara fornece verificador somente leitura de fingerprint/mapping por ambiente, sem valores pessoais. Se staging efetivo ainda estiver no layout antigo, a transição master é migration separada: mapear por relação comprovada/ID, CNPJ normalizado só como candidato com diagnóstico e bloqueio de ausente/ambíguo; nenhuma criação automática de master ou transferência de conta por aproximação. Exige Vault, backup e consentimento específico antes de executar.

Enum runtime canônico será a união dos11 valores já existentes no Portal, preservando `FALAR_DR_EDVAN` e `FALAR_ANDREW` como legados. Não converter silenciosamente para PENDENTE nem perder linha durante Prisma decode. Os dois valores são exibidos com rótulo legado; novas escolhas canônicas são os9 atuais do Painel; usuário pode trocar explicitamente status legado. Só OK/DESNECESSARIO completos. Dara testa SQLite/Prisma e ambos contratos; nenhuma remoção de enum na fase aditiva.

Senha: Painel cria bcrypt com fator12 (`bcryptjs` já é padrão do projeto) em senhaHash e senha="". Portal autentica hash primeiro; só quando hash é null admite comparação legada em fluxo compatível e imediatamente faz upgrade com CAS para hash e limpa senha. Nunca logar segredo nem comparar senha com hash por igualdade. Verificação/limite de tentativas e resposta neutra no endpoint, reusar padrão disponível ou implementar limitador persistente/local compatível com ambiente (Echo explicita limite e teste). Senha nova com geração criptográfica e mínimo12 caracteres, exibição única ao criador autorizado se o wizard precisar entregá-la; sem Math.random nem texto recuperável armazenado. Reset troca por token expirável/uso único, não revela senha antiga.

Ordem de rollout futuro: primeiro leitor Portal compatível, depois escrita de hash no Painel, ambos no staging isolado e com teste; transição de contas legadas em massa apenas após Vault. Até compatibilidade validada, não ligar criação nova no ambiente antigo. O objeto de conta compartilhada não pode expor senha/hash no DTO.

## 9. Documentos, uploads e ZIP

Upload Portal ativo é Vercel Blob público, PDF/JPEG/PNG até8MiB. Corrigir endpoint para exigir empresaId+itemId, conta/ownership, tipo ativo, tamanho e magic bytes completos do tipo permitido antes de emitir recibo. Doc action consome recibo verificado (token hash/ID vinculado à conta/item/objeto); ignora autoria informada pelo cliente. Repetir recibo não cria outro documento. Upload órfão por falha é rastreado por recibo pendente e remoção de órfão é tarefa controlada, não limpeza indiscriminada.

Novos arquivos devem ir para storage privado isolado de staging; driver deve oferecer stream autenticado e metadata sem expor token/storage key. DevOps confirma suporte/configuração privada do provedor; ausência de store privado bloqueia publicação desta parte, não autoriza voltar a URL pública. Backend dos dois apps oferece download por documentoId com ACL atual e no-store; pode redirecionar só para URL temporária assinada do provedor privado. Não aceitar URL arbitrária no comando.

Legados: links persistidos ficam preservados e são lidos através de handler autenticado com allowlist exata de store/host verificada pelo DevOps e metadata. A proxy NÃO torna privadas URLs públicas já emitidas. A10 só pode ser considerado encerrado para legados após migração/copiar objetos para área privada, verificar checksums/referências e invalidar/remover originais públicos conforme plano explícito aprovado. Preparar dry-run/manifest sem executar cópias, deleções ou alteração em massa. Nenhum hardcoded hostname “permitido” inventado.

ZIP exige ACL e escopo `ATIVO` default ou `TODOS` explícito; UI anuncia o escolhido. Histórico readonly pode exportar instância específica autorizada. Caminho inclui tipo/seção/código + índice/ID curto + nome sanitizado, preservando extensão e evitando colisões de sanitização. Limites:100 documentos,25MiB por arquivo legado,100MiB agregado não comprimido, deadline global45s para rota60s; upload novo segue8MiB. Usar stream com contador/abort antes de exceder bytes mesmo sem content-length, sem arrayBuffer integral irrestrito. Concorrência no máximo3, cada fetch até10s e limitado ao restante do deadline; redirects bloqueados. Origens storage conhecidas apenas, sem fetch de DNS/URL de usuário. Para coleção além do orçamento retornar erro recuperável com orientação de escopo menor; falha parcial em arquivo aceito entra no manifesto, sem afirmar download completo. ZIP válido deve incluir cada arquivo aceito e manifesto de falhas. Echo escolhe biblioteca/stream do runtime existente ou dependência avaliada; Sage verifica consumo/limites com streams sintéticos. Não prometer streaming com JSZip mantendo todas as cópias em RAM.

## 10. Integração CRM B

`obterDossieChecklistCard(cardId)` aplica ACL canônica de leitura do card + checkList, retorna vínculo/resumo pelo mesmo resolvedor ativo e capabilities. `listarDossiesCandidatosCard(cardId,pagina)` filtra por Cliente.id do card; não autoescolhe. `vincularDossieChecklistCard({cardId,empresaOperacionalId,expectedRevision,mutationId})` confirma mesmo master, capacidade de escrever em ambos e CAS do vínculo/card conforme precedente existente. Cardinalidade unique(cardId), sem unique(empresaOperacionalId). Trocar empresa master do card com vínculo exige remover/reassociar explicitamente antes, nunca conservar vínculo cross-company.

Nova cria `CardModal/PainelDossieChecklist.tsx`, montado no contexto atual do modal (`PainelHistorico.tsx`); manter Procedimentos BPM separado. Mostra owner, tipo, resumo, pendências, indisponível/sem vínculo e abrir CheckList. Abrir usa contrato do shell para substituir/ativar módulo, não gerar aba nova a cada aviso. Edição detalhada permanece no módulo CheckList. Links preservam empresa operacional e foco de item/documento; não usam masterId como rota empresaId.

Contrato não chama reconciliacao-tarefa, monitor documental nem checklist-envio-operacional. Status100% não dispara nada no BPM. O journal pode ser consultado pelo histórico do vínculo, mas nenhum gatilho de automação é cadastrado nesta entrega.

## 11. Arquivos e responsabilidades de implementação

- **Dara:** `prisma/schema.prisma` do Painel e modelos runtime correspondentes Portal; migrations aditivas e scripts dry-run/diagnóstico/validação/rollback; contrato de paridade; nenhum banco real. Não mexer UI/actions.
- **Echo (ambos backends):** actions atuais; módulos checklist propostos; ACL, transações, CAS/eventos, uploads/download/ZIP; Portal auth/actions/API/projeções master e adapter CRM; testes de unidade/contrato próximos ao backend com Sage. Coordenar dependências com DevOps, sem tocar env real.
- **Nova:** páginas/componentes Checklist/analistas/modelos/histórico/cadastro, hooks/store/central/shell, CRM PainelDossieChecklist e ajustes UI Portal necessários ao contrato/URLs. Não inventar ACL em cliente; consumir capabilities/resultados. Preservar tema; somente arquivos no worktree.
- **Sage:** casos A01–A17, ownership, cardinalidade, Portal compatível e regressão CRM em fixtures/SQLite/streams; matriz de cobertura com evidência executada.
- **DevOps:** isolamento staging Portal/DB/storage/Pusher/cron ANTES de push/preview, gates/branches e deploy staging somente depois das dependências. Não copiar dados/env/credenciais de produção. Portal atual não tem staging e preview compartilha metadata de DB com produção: pré-requisito bloqueante de publicação, não motivo para fazer teste real no banco errado.
- **Vault:** relatório de banco/massa/objetos, backup e confirmação específica ANTES de qualquer aplicação real; preparar pode, executar não nesta etapa. Anubis/Forge/Probe/Lens validam nas fases do fluxo Bibble; nenhum especialista se autoatribui QA final.

## 12. Matriz integral de aceitação

| Achado/escopo | Contrato que encerra | Implementa | Sage deve demonstrar |
|---|---|---|---|
| A01 | Guardas persistidas em todas páginas/actions/API/Pusher; owner/líder sem bypass | Echo/Nova | Sem sessão/módulo, outro owner, admin/leads, revogação e chamadas diretas |
| A02 | PATCH preserva omitido; CAS | Echo/Nova | Status-only conserva texto; null explícito limpa; falha não simula salvo |
| A03 | Hash primeiro + upgrade legado CAS + schema master Portal | Dara/Echo | Hashnovo/legado/reset/conta alheia; sem senha no DTO; leitores compatíveis |
| A04 | Resolvedor ativo único sem primeiro/fallback + cache atômico | Echo/Nova | Duas ordens de coleção e A→B→A; CRM/portal/lista/detalhe concordam |
| A05 | Tx comando/evento/notificação, no-op, retry/CAS | Dara/Echo | Falha parcial, mutationId replay/conflito, concorrência, zero alerta no-op |
| A06 | Publicação revisionada e identidade de código + override específico | Dara/Echo/Nova | Erro/retry/colisão/concorrência não deixam catálogo parcial |
| A07 | Default futuro, snapshots, editar/desativar/ordenar | Dara/Echo/Nova | Instância antiga não muda; nova usa revisão/ordem vigente |
| A08 | Ocorrência por mutationId; master≠atendimento≠conta | Dara/Echo/Nova | Retry mesmo cria1; nova negociação pode criar outra; não uniqueempresa |
| A09 | ZIP nomes únicos, stream/abort,deadline total,escopo | Echo/Nova | Duplicados,sem length,bytes excedentes,lentidão,zip completo ou manifesto |
| A10 | Recibo/ownership/storage privado/downloadACL + plano legado | Dara/Echo/DevOps | URL forjada/cross-company/redirect recusados; storage privado; legado continua pendente até migração verificada |
| A11 | Journal + auditoria ator + softdelete/restore explícitos | Dara/Echo/Nova | Histórico antes/depois, autor real, retry conserva primeira exclusão |
| A12 | Paginação/DTO/counters sem500 truncado + erro explícito | Echo/Nova | Página/filtro/count estáveis, catálogo>500 sintético, sem overfetch filhas |
| A13 | State por identidade/revision e troca confirmada | Nova | Vazio→criar,A→B→A,IDs certos,rascunho tratado |
| A14 | Envelope Result/try-finally/rollback confirmado | Echo/Nova | Resolveerro e rejectedPromise, loading libera, docs não somem na falha |
| A15 | Master confirmado por ID, wizard reset, comando atômico | Echo/Nova | A→digitarB invalida; queries fora de ordem; retry conta/vínculo sem órfão |
| A16 | Assinatura única, eventId/readstate/recovery durable | Dara/Echo/Nova | Um evento/um áudio;51º toast;remount/reconnect não reabre lido |
| A17 | Estados distintos e histórico readonly sem reativação | Echo/Nova | Falha≠vazio; tipo antigo não muda ativo/cache; ZIP respeita scope |
| Duplicações | Serviço/fórmula/enum únicos, remover exports mortos confirmados | Echo/Nova | Busca de callers e regressões sem alterar domínio Procedimentos BPM |
| Analistas | OwnerFK,catálogo independente,sidebar+zero,Todos inclui null | Dara/Echo/Nova | Todos/analista0,legado/inativo,readglobal/writeowner+leader,atribuiçãolíder |
| Pastas | UI retira filtros legados; dados preservados | Nova/Dara/Vault | Empresa/docs permanecem; Teste só plano até confirmação |
| CRM B | Link explícito card→registro reutilizável e projeção | Dara/Echo/Nova | Crossmasternegado,sem autoescolha,doiscards1dossiê,zeroefeitoemtask/etapa |

Quality gates dos dois projetos conforme scripts reais (adicionar typecheck/teste explícitos no Portal quando ausentes, com runner do projeto escolhido por Echo/Sage), lint/typecheck/test/build no Painel; testes funcionais autenticados só em staging isolado com fixtures. A publicação depende do schema aplicado autorizado, Portal isolado, storage privado e compatibilidade verificada. Implementação de código pode avançar nos worktrees e SQLite sintético; nenhum gate pode afirmar que migração real ou privacidade dos URLs legados já aconteceu.

## 13. Dependências operacionais e rollback

SM transforma este contrato em stories/ACs mantendo todas as dependências visíveis. Dara prepara plano aditivo e diagnóstico de layouts/duplicatas/órfãos; Vault apresenta ambiente, steps, impacto, alternativa, backup válido e rollback para aprovação específica. Antes disso não aplicar migrations nem remover Teste/objetos públicos nem rehash em lote. Backup produção não é seed de staging. Código novo deve ser liberado somente sobre contrato de schema validado; evitar fallback silencioso para layout antigo.

Rollback de código exige compatibilidade dos leitores com colunas aditivas e hash introduzido; não restaurar leitor plaintext após novas contas hash. Snapshot de itens/documentos e novos eventos ficam preservados. Rollback de schema/dados só pelo plano Vault com backup verificado; nunca DROP automático para satisfazer versão antiga. Nenhuma promoção de produção está incluída na autorização de desenvolvimento desta entrega.


## 14. Adendo Aria — isolamento CheckList por polling (22/10/2026)

[AUTO-DECISION] Namespace por ambiente no app Pusher compartilhado basta? → **Não na topologia atual.** O endpoint `src/app/api/pusher/auth/route.ts` termina em `authorizeChannel(socketId, channelName, presenceData)` para canais desconhecidos de qualquer sessão autenticada. O mesmo fallback consta no commit de produção observado `28651e7f4c6a3ed1be91f7437eb638638d047f0c`, inspecionado localmente por git show; não foi feita chamada exploratória de autorização em produção. Assim a produção antiga poderia assinar um canal staging novo mesmo que o autorizador novo staging o negasse. Deny apenas no staging não corrige o outro signatário do mesmo app.

**Entrega atual usa exclusivamente journal + polling autenticado para avisos CheckList, sem publicar nem assinar canais CheckList no Pusher compartilhado.** Aprovação arquitetural para implementar este ajuste; não é QA final nem autorização de deploy/DB. Nenhuma obrigação de comprar/provisionar app novo para homologar a funcionalidade. O polling já recupera no shell, sem temporizador em widgets: montagem imediata, retorno de foco, intervalo6s visível/30s oculto, paginação por cursor, eventId/revision/readstate persistidos. Não se promete push instantâneo. Portal continua SSE próprio.

Este adendo prevalece sobre a obrigatoriedade de transporte Pusher/worker em §§7 e11 do contrato anterior. Mantém A16: aviso recuperável, sem duplicação, leitura durável e um único poller. Pusher é aceleração opcional, sem ser fonte da verdade. Os outros módulos permanecem no app compartilhado preexistente; **não se alega isolamento físico de app/keys nem correção dos seus autorizadores**.

## Contrato pequeno implementável

### Configuração pura compartilhada

Echo cria `src/lib/checklist/realtime.ts`, sem server-only, Prisma, Pusher, auth ou segredos. Expõe transporte resolvido e predicado de canal reservado, ambos testáveis por argumentos explícitos. Entrada de transporte `NEXT_PUBLIC_CHECKLIST_REALTIME_MODE`: ausente ou valor exato `polling` → polling; qualquer outro valor, incluindo `pusher`, vazio fornecido, espaços, caixa diferente ou desconhecido → configuração inválida e **nenhum transporte externo**. Não implementar opção Pusher ativável por env nesta entrega. No browser usar referência literal `process.env.NEXT_PUBLIC_CHECKLIST_REALTIME_MODE` para substituição Next; servidor passa a mesma env ao mesmo resolvedor. Não adicionar segredo/env paralelo ou inferir ambiente por NODE_ENV.

Nova deve manter polling e estado de ator funcionando mesmo se configuração for inválida; um valor inválido nunca libera assinatura nem derruba hidratação. Backend pode reportar configuração inválida sanitizada pelo worker; demais endpoints de journal continuam disponíveis. Defaults seguros também valem numa futura promoção explicitamente autorizada: polling nunca muda silenciosamente para Pusher em produção.

Predicado reserva todo nome de string que comece por `private-checklist` (inclui antigo `private-checklist-docs`, nomes futuros stage/prod e variantes malformadas desse prefixo). Não criar nomes por ambiente ativos agora. Essa reserva ampla evita cair no fallback genérico; outros namespaces permanecem intactos.

### Autorização

`src/app/api/pusher/auth/route.ts`: depois da sessão e leitura validada de formData, **antes de quaisquer autorizações e do fallback**, negar403 todo canal CheckList reservado, mesmo Admin/CEO/TI/leader, outro ambiente, canal antigo ou malformado. Não chamar authorizeChannel/ACL de CheckList neste caminho: não há canal CheckList habilitado. Garantir socket_id/channel_name strings não vazias antes de startsWith/signature (entrada inválida400 ou403). Sem sessão continua401. Remover CHECKLIST_CHANNELS e ramo antigo autorizador. Não alterar política de outros módulos.

Isso protege a versão nova e impede que clientes staging usem o autorizador staging para os canais CheckList de produção antiga. **Não bloqueia a produção antiga de assinar novos canais; por isso nenhum evento staging CheckList é publicado.**

### Worker/outbox

`src/app/api/checklist/jobs/eventos/route.ts`: manter validação Bearer constant-time primeiro. Em modo polling retornar200 `{processed:0, transport:"polling"}` **sem importar/instanciar Pusher nessa rota, sem chamar publicarPendentes, sem claim/update/retry de outbox nem trigger**. Configuração inválida retorna503 sanitizado e nenhuma mutação/rede. Segredo ausente/incorreto401, também sem DB/rede.

`publicadoEm` significa publicação externa efetiva, **não leitura nem entrega ao polling**. Portanto não marcar eventos publicados artificialmente. O endpoint de recuperação já não filtra publicadoEm, e readstate por usuário continua sendo comprovação de leitura. Manter serviço publicarPendentes e testes como preparação inativa, sem caller produtivo nesta entrega; não apagar histórico ou backlog. Skip anterior ao claim evita loop de tentativas/backoff por transporte desligado.

**Não instalar/habilitar timer desta entrega em modo polling.** Templates/runner de DevOps podem permanecer preparados e seus testes existentes válidos; a instrução operacional de enable é suspensa por este adendo. Não executar --once remoto para fingir validação de publicação. Se no futuro reativar Pusher, definir corte/backlog com eventId/readstate, sem apagar eventos antigos e sem reabrir lidos.

### Cliente

`src/hooks/useChecklistNotifications.ts`: consumir config pura, manter inicialização/reset de store por ator/permissão e opt-out iframe; **remover dependência/import de pusherClient, subscribe/bind/connected/unbind CheckList**. Não derrubar singleton global nem unsubscribe de outros módulos. Não criar novo intervalo; `src/components/NotificacaoFlutuante.tsx` já é único poller global. Widgets/central/toast consomem store como antes. Mudança de ator ignora respostas antigas, permissão revogada é validada no endpoint e não apaga leitura persistida.

## Ownership serial e testes exigidos

1. **Echo:** helper puro novo, rota auth e rota worker; testes novos `tests/checklist-analistas/realtime-isolation.test.ts` (ou dois arquivos focados auth/worker); adendo doc API. Nenhum Portal/source cloud/schema necessário.
2. **Nova, após FINAL Echo:** hook cliente e `tests/checklist-analistas/notifications-subscription.test.tsx` adaptado de assinatura única para **zero assinatura CheckList e um poller global**. Usar helper entregue sem criar configuração concorrente; preservar testes/eventos recovery. Nenhuma mudança no singleton `src/lib/pusher.ts`.
3. Rodar checks focados reais e posteriormente Forge global/Probe/Anubis/Lens/Sage conforme Bibble. Não aprovar por análise estática.

Casos mínimos: config ausente/polling/inválida/pusher; todas retornam zero subscribe/trigger. Auth nega canais antigo, stage, prod, sufixo malformado e Admin; spy authorizeChannel não chamado; semsessão401; formFile/null inválidos; regressão canal conhecido outro módulo. Worker token inválido401; polling200 processed0; config inválida503; DB claim/update e Pusher nunca chamados; rows/readstate preservados. Cliente monta/desmonta widgets sem nova assinatura/timer, ator muda sem dados atrasados; recuperação real journal→JSON→parser→store mantém51ºevento/página2/leitura/replay/falha parcial e áudio/toast único. Testes existentes B02/eventos-recovery e SQLite são evidência reutilizável se fontes não mudarem.

## Trade-offs e futuro

Polling tem latência de aproximadamente6s com aba visível, mais duração da requisição; usa o tráfego de consulta global já existente, sem assinatura externa ou nova fila. Indisponibilidade temporária conserva coleção confirmada e recupera depois. Ausência de push não perde eventos persistidos. Não é promessa de tempo real estrito.

App Pusher dedicado seria necessário para reativar push staging **sem tocar produção antiga**: credenciais legítimas próprias, nenhum outro autorizador com acesso ao seu secret, namespace estrito por ambiente, ACL persistida no mesmo ambiente, worker e singleton específicos e testes cruzados. Alternativa futura: atualizar por promoção explícita todos os autorizadores que compartilham o app para negar namespaces estrangeiros; isso permite isolamento lógico de canais, mas não isola comprometimento do secret, administração ou quotas compartilhadas. Requisito de segurança contra secret comprometido, isolamento de operação/quotas ou terceiros não confiáveis exige app dedicado. Não implementar mecanismo criptográfico alternativo ou mudar todos módulos agora.

## Rollout revisto

A configuração private Blob continua bloqueada por403 challenge_required; manter CHECKLIST_PRIVATE_BLOB_TOKEN, sem alias/fallback global, sem contornar step-up. Host Portal clientes-staging.alpha-comex.com foi associado/verificado, **ainda sem deployment READY/HTTP comprovado**. Nenhum link de reset deve ser enviado agora.

Após código e gates, Vault e consentimento específico:
1. Backup staging completo restaurado/verificado<=48h + diagnóstico/fingerprint/CAS atualizados.
2. Aplicar somente schema aditivo, bootstrap de3modelos e grant preservatório5vínculos exatamente aprovados. Revalidar contagens; ownerNULL não inferido. Sem Teste/storagelegado se contagens permanecerem0.
3. Publicar **Portal leitor compatível primeiro**, custom staging, READY/host/TLS/DB binding/auth/hashlogin/sessãoversion comprovados. Prova reader-evidence honesta, sem inventar E2E nem seeds.
4. Publicar **Painel escritor de hash novo depois**, somente staging; READY e runtime DB conhecido, validar que criação/alteração/reset novos não gravam plaintext. Cessar/impedir escritor antigo (incluindo requisições/deployments antigos ainda invocáveis) antes da etapa seguinte; não expor novas operações até leitor estar validado.
5. Só então executar hash-contas legado sob aprovação/backup/prova/CAS, confirmar que2legados esperados ou delta conhecido tornam-se hash, senha vazia, sessão preservada. Rodar reconciliação de contagem para detectar qualquer escritor antigo remanescente; divergência bloqueia encerramento. Rollback nunca volta a leitor plaintext após novos hashes.
6. Validar avisos pelo polling autenticado sem Pusher; **não habilitar worker timer enquanto transporte polling**. Finalizar homologação staging; promoção produção continua dependendo de pedido explícito posterior.

Esquema/role/hash são operações distintas protegidas; esta decisão documental não autoriza nenhuma delas. Nenhuma modificação real DB/cloud/Git/código foi feita por Aria. Apenas docs e este handoff.

## Validação arquitetural desta rodada

Alinhamento A16/segurança/compatibilidade/dependências/rollout e ownership: contrato definido. Namespace sozinho: REPROVADO na topologia atual por fallback produção legado. Journal+polling sem tráfego Pusher: APROVADO PARA IMPLEMENTAR. Não houve gate global, teste novo, release nem QA final nesta rodada. Persona/task/checklist lidos; .Codex/commands/AIOX/agents/architect.md e .aiox/gotchas.json ausentes no worktree, usado fallback .aiox-core/development/agents/architect.md e skill AIOX architect disponível. Escopo da checklist aplicado apenas à decisão focal, sem alegar revisão geral da feature.
