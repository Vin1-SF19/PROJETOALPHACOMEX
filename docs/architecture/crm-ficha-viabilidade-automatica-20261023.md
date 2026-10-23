# CRM — Ficha automática de análise de viabilidade

Data: 2026-10-23. Base: staging `296185df`. Escopo derivado do pedido do usuário, sem publicação em produção.

## Decisão e precedentes

A entrada futura de um card do funil Revisão de Radar em Reunião Agendada solicita a geração da mesma ficha da Pré-Análise. A solicitação é persistida na transação da entrada; PDF e upload são feitos depois do commit. Falha da ficha não desfaz uma reunião ou transição já confirmada.

Reutilizar `FichaAlphaPDF`/`ModalPDF`, o armazenamento privado e o visualizador de anexos do CRM. Não criar modelo paralelo, plataforma de notificações, tabela, coluna, seed, backfill, configuração remota de automação ou varredura retroativa de cards.

Precedentes existentes: `google-meet-compensacao.ts` já mantém trabalho pendente/retry em `BpmCardHistorico`; `BpmAutomacaoLease` oferece recurso único e fencing; `BpmCardAnexo` tem unicidade `(cardId,url)`; `anexos-storage.ts` define token privado e referência `bpm-blob:`; `transicao-command.ts` concentra transições futuras e já executa efeitos pós-commit.

[AUTO-DECISION] Configurar uma regra remota, acoplar apenas ao clique do navegador ou integrar a entrada canônica? → Integrar a entrada canônica com solicitação durável. Isso cobre agendamento pelo motor, movimento manual e movimento livre Admin sem depender de uma aba aberta, sem ativar outras automações suprimidas e sem modificar configuração em massa.

## Fluxo e escopo

1. `AgendarReuniaoGoogleMeetBpm` persiste a reunião e publica `REUNIAO_AGENDADA`; o motor existente move o card para Reunião Agendada.
2. `executarTransicaoBpm` identifica a entrada real no destino pela chave semântica de etapa/pipeline, com fallback de nome somente para cadastro legado sem chave. Uma mudança de outra etapa ou de outro funil não solicita ficha.
3. Na mesma transação da entrada, cria uma intenção idempotente específica desta funcionalidade no histórico. Um replay da transição não cria outra intenção.
4. Depois do commit, tenta concluir a intenção. O cron existente `/api/bpm/jobs/automacoes` recupera somente intenções explicitamente criadas por esta versão. Não procurar todo card que já está em Reunião Agendada.
5. A geração lê dados do próprio card/empresa e cache de Pré-Análise do mesmo CNPJ. Persiste PDF privado, anexo e snapshot/revisão; só então informa sucesso.
6. A ação do usuário pode retornar o descriptor confirmado para seu próprio navegador. Para conclusão posterior por retry, usar consulta autenticada com escopo do card/ator e os recursos atuais de atualização; evento privado de usuário é alternativa se necessário. Nunca emitir toast de sucesso com broadcast do pipeline.
7. O toast verde diz `Ficha de análise de viabilidade gerada para: [nome da empresa]`. O clique abre/reabre o card correto na aba Anexos, mesmo se o modal anterior já foi fechado.
8. A linha da ficha, na aba Anexos, tem acima o botão `Complementar Ficha`, quando o usuário pode editar. O botão abre o próprio `ModalPDF` com o snapshot preenchido e as ações Salvar/Fechar. A ficha abre no visualizador interno existente.

Entrar novamente na etapa ou reagendar não pode apagar os campos de uma ficha já complementada. A geração automática é `ensure` da ficha atual por card/empresa: reentrada real e replay encontram o descriptor existente, sem outra geração/toast. Somente o salvamento explícito de complemento produz nova versão. O download legado de `GerarFichaViabilidadeBpm` continua compatível para consumidores antigos.

O botão atual de gerar ficha no `PainelReuniao` passa a usar a operação persistida nova para geração manual/retry e a mesma ficha Pré-Análise, sem continuar baixando o modelo divergente de duas páginas. Preservar a API legada por compatibilidade não obriga a interface atual a continuar acionando esse download. Intenção, estado atual, snapshot e revisão no histórico são obrigatórios; apenas a adaptação de labels do histórico visual depende dos eventos escolhidos.

## Persistência sem alteração de schema

As alterações são CRUD normal de cada card, executadas em resposta à entrada futura ou à ação explícita Salvar. Não há migration, operação em massa nem necessidade de cópia entre bancos.

- **Intenção:** registro em `BpmCardHistorico`, com ID determinístico da entrada/idempotencyKey, ação específica pendente e JSON validado contendo `schemaVersion`, `cardId`, `empresaId`, `eventoId`, `actorUserId`, tentativas e próxima tentativa. Não armazenar credenciais ou mensagens externas brutas.
- **Cabeçalho atual da ficha:** identidade determinística por card/empresa, também em histórico. Contém `anexoId`, `revision`, snapshot normalizado `dados`, nome do emissor, empresa/ator e estado. A implementação pode usar um único registro de estado quando isso preservar as mesmas invariantes de intenção e revisão. Não inferir identidade pelo nome do arquivo.
- **Arquivo:** `BpmCardAnexo` normal `application/pdf`, vinculado ao card que vincula a empresa. ID estável após a primeira criação. O snapshot guarda também `empresaId` explicitamente; revalidar a empresa atual na confirmação e em cada salvamento. Não inventar campo `empresaId` no anexo existente.
- **URL:** referência privada `bpm-blob:bpm/<cardId>/...pdf`, gerada pelo servidor. Upload com `BLOBCRM_READ_WRITE_TOKEN`, `access: private`; não usar `BLOB_READ_WRITE_TOKEN`, `gerarFichaServer` público ou URLs assinadas persistidas como identidade.
- **Versões:** cada alteração usa pathname imutável novo. Transação final atualiza URL/tamanho do mesmo anexo e o snapshot/revisão por CAS. Antes de confirmar, verifica a empresa do card, o lease/fencing e a revisão esperada. Uma resposta antiga nunca substitui uma versão nova.
- **Auditoria:** registrar eventos legíveis de ficha gerada/complementada com IDs/versão, sem despejar dados pessoais do snapshot no texto da timeline. Intenções internas não devem virar mensagens confusas no histórico visual. Arquivos enviados sem commit devem seguir a limpeza/reconciliação de anexos existente.

Serializar geração e complementação com lease de recurso próprio `ficha-viabilidade:<cardId>`; não reutilizar o recurso genérico `card:<id>`, pois o motor pode estar segurando seu lease ao chamar a transição. CAS continua obrigatório mesmo com lease, inclusive na retomada após expiração. Limitar tentativas e adotar backoff controlado; falha permanente fica explícita e permite retry autorizado, sem loop de renderização.

## Paridade com Pré-Análise

O render novo usa `FichaAlphaPDF` com `finalidade: pre-analise` **e payload sem a propriedade `viabilidade`**. Hoje `montarFichaAlphaDoCard` inclui essa propriedade e o renderer acrescenta uma segunda página mesmo com finalidade Pré-Análise; só mudar a finalidade não preservaria a ficha solicitada.

Reaproveitar o mapeamento seguro de dados da empresa/contato/cache do mesmo CNPJ. A ficha pode nascer com campos opcionais vazios; não chamar fornecedores externos obrigatoriamente para concluir o agendamento. Não fabricar dados ausentes.

O campo emitido por representa o ator da geração quando identificado. O responsável comercial continua sendo um dado da negociação, sem substituir a identidade de quem executou. O legado de duas páginas e o gerador público do Bibble permanecem independentes, salvo reuso interno compatível comprovado por testes.

## Contrato backend/frontend

DTO da ficha confirmada, exportado em módulo neutro de tipos/esquemas, sem importar Prisma/Node no cliente:

```ts
type FichaViabilidadeDTO = {
  anexoId: string;
  empresaId: number;
  empresaNome: string;
  dados: FichaAlphaDados;
  userLogado: string;
  revision: number;
};
```

Campos extras aceitos são somente os nove já presentes no ModalPDF: `dataSituacao`, `horaSituacao`, `mesProtocolo`, `telefone`, `email`, `nomeResponsavel`, `observacoes`, `origemLead`, `origemLeadDetalhe`. Validar limites e formatos apropriados com Zod. A operação não altera reunião Google, campos do CRM, empresa master ou `ConsultaPreAnalise` como efeito colateral de complementar um documento.

APIs recomendadas em `src/actions/bpm/FichaViabilidade.ts`:

- `ObterFichaViabilidadeBpm({cardId})`: requer sessão e acesso de leitura ao card. Retorna `{success:true,data: FichaViabilidadeDTO | null}` para uma ficha persistida; pendência/falha deve ser representada explicitamente se exposta. Nunca retornar o estado de outra empresa após troca de master.
- `SalvarComplementoFichaViabilidadeBpm({cardId, expectedRevision, extras})`: requer acesso de edição ao card; monta a empresa/autor pelo servidor, gera nova versão privada e devolve `{success:true,data:FichaViabilidadeDTO}` somente após commit. Em conflito, manter o rascunho aberto e oferecer releitura; não aplicar last-write-wins.
- Uma operação de ensure/retry do próprio card pode ser exposta quando necessária, com autorização de edição e validação da intenção/etapa; não aceitar upload URL, anexoId arbitrário, empresaId ou actorUserId fornecidos pelo cliente como autoridade.
- `AgendarReuniaoGoogleMeetBpm` pode acrescentar `fichaViabilidade?: FichaViabilidadeDTO` e/ou estado pendente ao resultado atual, preservando `googleEventId`/`avancoConcluido`. Incluir o campo confirmado somente quando o ator autenticado corresponde ao ator da intenção.

Identidade do ator: entrada manual usa `input.ator.userId`; entrada por automação resolve o ator usuário pelo evento causal do agendamento/execução, com limite de profundidade e validação. Nunca usar `automacao.criadoPorId` (configurador), o closer atribuído ou usuário enviado pelo cliente como destinatário substituto. Se não existir ator usuário, executar a geração sem emitir toast pessoal indevido.

Quando não houver ator causal humano, `BpmCardAnexo.enviadoPorId` exige um usuário técnico válido: pode usar o responsável do card somente para satisfazer essa atribuição persistida, mantendo `actorUserId: null` no estado da geração. Esse fallback não concede toast, não identifica falsamente quem clicou e não deve ser mostrado como autoria humana; indicar geração automática no snapshot quando necessário.

ModalPDF compartilhado, mantendo comportamento padrão Pré-Análise:

```ts
modo?: 'gerar' | 'complementar';
dadosManuaisIniciais?: NonNullable<FichaAlphaDados['extra']>;
onSalvar?: (extras: NonNullable<FichaAlphaDados['extra']>) => Promise<void>;
```

No modo complementar, callback rejeita em `{success:false}`; modal mantém busy/erro/finally, desabilita repetição e fecha só após sucesso. Não invocar `upsertConsulta` nem abrir janela de impressão nesse modo. Prefill é aplicado ao abrir por identidade card/revisão; realtime não descarta rascunho sujo. Fechar sem salvar não persiste alterações.

Toast deve ser deduplicado por intenção/anexo/revisão, sem confundir revalidação do card com uma nova geração. Navegação carrega intenção `abaInicial: anexos` no contrato de abertura do card, não um evento local lançado antes de o modal montar. O toast inteiro deve ser clicável e acessível por teclado, sem ação de assumir lead ou fechar/substituir outro card silenciosamente.

## Blueprint de integração e ownership

### Backend — editar

- [ ] `src/lib/bpm/transicao-command.ts`: registrar intenção na mesma transação e disparar processamento pós-commit, somente para o escopo desta ficha; preservar supressão das outras automações do movimento livre.
- [ ] `src/lib/bpm/ficha-viabilidade-server.ts`: manter a API legada e adicionar/reusar leitura/render seguro sem segunda página para a operação nova.
- [ ] `src/lib/bpm/ficha-viabilidade-dados.ts`: aproveitar a fonte própria do card; snapshot novo remove `viabilidade`, sem regressão do mapeamento legado.
- [ ] `src/actions/bpm/FichaViabilidade.ts`: leitura/complemento/retry autenticados e respostas sanitizadas.
- [ ] `src/actions/bpm/GoogleMeet.ts`: retorno opcional da ficha/estado confirmado para o ator; não desfazer reunião por falha do PDF.
- [ ] `src/app/api/bpm/jobs/automacoes/route.ts`: recuperar lote limitado de intenções específicas; manter autenticação cron antes do trabalho.
- [ ] `src/lib/bpm/historico-descricao.ts`/`timeline.ts`, se necessário: apresentar eventos de ficha legíveis e ocultar detalhes internos, sem expor snapshot bruto.

### Backend — criar

- [ ] `src/lib/bpm/ficha-viabilidade-documento.ts`: tipos/esquemas cliente-servidor e identificação do descriptor. Nome pode ser ajustado antes da implementação, mantendo módulo neutro.
- [ ] `src/lib/bpm/ficha-viabilidade-automatica-server.ts`: intenção, lease, render/upload, CAS, estado atual, complemento e reconciliação; separar helper puro quando facilitar testes.
- [ ] Testes focados em `tests/bpm/` para persistência/concorrência/entrada, sem acessar banco remoto ou serviços reais.

### Frontend — editar (ownership separado)

- [ ] `src/components/ModalPdf.tsx`: props opcionais do modo complementar; preservar geração Pré-Análise.
- [ ] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`: botão acima da ficha, modal compartilhado e visualizador interno; dados confirmados e autorização.
- [ ] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`: toast pessoal após resposta confirmada, estado pendente/falha quando aplicável.
- [ ] Contrato de navegação do board/card (`PipelineBoardClient`, `CardFullViewModal` e hooks de abertura) quando necessário para transportar aba Anexos e reabrir o card correto.
- [ ] Testes React de ModalPDF/anexos/toast/navegação, incluindo fechar o card antes de clicar no toast.

### Consultar e preservar

`GerarFicha.tsx`, `SistemaPreAnalise/BlocoResultados.tsx`, `anexos-storage.ts`, `anexos-lifecycle.ts`, `VisualizadorAnexoCard.tsx`, proxy `/api/bpm/anexos/[anexoId]`, `GoogleMeet.ts`, `automacoes/orquestrador.ts`, `automacoes/central-runtime.ts` e `google-meet-compensacao.ts`.

Não há menu, módulo, atalho, papel ou permissão nova. Reutilizar ACL canônica `visualizar`/`editarCard`; nenhuma alteração necessária de `auth.ts`, `middleware.ts`, schema ou Next config. Novo contrato de intenção de navegação pode exigir os hooks já existentes, sem criar outra rota de CRM.

## Matriz mínima de validação

- Entrada futura por agendamento real: um PDF privado válido, mesma ficha Pré-Análise, um anexo no card/empresa e sucesso apenas após persistir.
- Entrada manual/Admin movimento livre: somente a ficha nova é ativada; outras automações continuam com suas regras e supressões.
- Replay do comando, duas requisições concorrentes e dois workers: uma ficha atual, sem duplicação ou sobrescrita por lease expirado.
- Falha PDF/Blob/banco após upload: reunião permanece salva, sem toast verde falso; retry controlado conclui e não duplica; órfão fica reconciliável.
- Card legado já na etapa ao publicar: nenhuma intenção/geração retroativa. Cron limitado trabalha só novas intenções.
- Complemento: nove campos reaparecem, Fechar não salva, Salvar persiste nova versão do mesmo anexo; versão antiga conflita sem perder rascunho; reentrada não apaga complemento.
- Não autorizado/outro card/empresa alterada: leitura ou gravação recusada sem expor PDF/snapshot; consulta de outro CNPJ nunca contamina a ficha.
- Ator diferente do closer/configurador: toast só para ator correto; nenhum toast para outro usuário que recebe atualização genérica. Dedupe entre resposta/poll/realtime evita repetição.
- Clique no toast com card fechado/outro card aberto: abre o card correto diretamente em Anexos; clique na ficha usa visualizador interno.
- Regressões: Pré-Análise continua gerando via modal padrão, download legado CRM continua compatível, outras abas e anexos intactos; lint/typecheck/test/build completos antes de staging.

## Limites operacionais

Staging primeiro, commit/push por DevOps após gates e validação da versão publicada. Produção não autorizada. Não executar teste de agendamento real com convite externo sem avaliar o efeito; preferir integração isolada e reuniões de teste claramente identificadas. Nenhum banco remoto foi consultado ou alterado neste desenho.
