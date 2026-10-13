# Story: Chat do ChatbotX no card do Alpha CRM

## Status

Ready for Review

## História

Como closer do Alpha CRM, quero conversar com o cliente pelo ChatbotX no formulário do card, para consultar o histórico e enviar respostas sem sair do pipeline.

## Critérios de aceite

1. O formulário do card apresenta, ao final, um botão que abre um modal de chat.
2. O modal lista conversas relacionadas ao cliente do card, permite confirmar uma conversa e exibe seu histórico em ordem cronológica.
3. O closer pode enviar texto de até 1000 caracteres; para conversas com mais de um canal, seleciona o inbox associado.
4. O navegador nunca recebe o token de workspace; ações server-side validam acesso ao card e revalidam o vínculo da conversa antes de ler ou enviar.
5. O histórico suporta paginação opaca, deduplicação por ID, atualização após envio e estados de carregamento, vazio e erro.
6. Não são adicionados anexos ou criação de conversas nesta versão.
7. A lista usa o campo personalizado CNPJ descoberto em `/contacts/filter-fields` e o `contactFilter` da Inbox; histórico e envio revalidam o valor do campo no contato.
8. Enquanto a conversa está aberta, respostas do lead aparecem por polling REST da página mais recente, sem perder o histórico carregado; a consulta pausa com a aba oculta e respeita `Retry-After` em respostas `429`.
9. Ao abrir o histórico ou receber uma nova mensagem, o painel de mensagens rola até o final; a leitura de páginas antigas não força essa rolagem.

## Checklist

- [x] Implementar operações da API pública Inbox por `conversationId` e validação dos recursos.
- [x] Adicionar ações server-side com autorização do Alpha CRM e filtragem por cliente.
- [x] Integrar modal ao final do formulário da etapa.
- [x] Cobrir contrato de paginação, envio, IDs string e validação dos parâmetros.
- [x] Documentar as variáveis server-side da API no `.env.example`.
- [x] Substituir a busca por razão social pelo filtro de CNPJ e preservar a seleção entre várias conversas.
- [x] Validar o CNPJ do contato antes de ler o histórico ou enviar uma mensagem.
- [x] Atualizar a conversa aberta periodicamente, mesclar mensagens por ID e aplicar espera progressiva após falhas.
- [x] Rolar o painel de mensagens ao final na abertura e quando chegar uma mensagem nova.
- [x] Executar os gates disponíveis e registrar as limitações ambientais.

## File List

- `src/lib/chatbot-alpha/chat-api.ts` — operações da Inbox API pública e schemas tolerantes ao contrato.
- `src/actions/AlphaCrmChatbotx.ts` — autorização do card, filtragem por cliente e proxy server-side.
- `src/app/PainelAlpha/AlphaCRM/CardModal/ChatClienteCard.tsx` — modal de seleção e conversa.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx` — botão ao final do formulário.
- `tests/chatbot-alpha/chat-api.test.ts` — testes do contrato Inbox.
- `tests/chatbot-alpha/alpha-crm-card-chat.test.ts` — testes da busca por CNPJ e da autorização de histórico e envio.
- `src/lib/chatbot-alpha/mesclar-mensagens.ts` — mesclagem cronológica do histórico com páginas recentes.
- `tests/chatbot-alpha/mesclar-mensagens.test.ts` — testes de deduplicação e ordem das mensagens.
- `tests/chatbot-alpha/doctor.test.ts` — verifica a variável canônica da URL.
- `src/lib/chatbot-alpha/doctor.ts` — diagnóstico da configuração do ChatbotX.
- `.env.example` — parâmetros de configuração da API Inbox.

## Registros do Dev

- Mensagens, tokens e dados de contato não são registrados em logs.
- A API pública do ChatbotX aplica o escopo de workspace; as ações limitam as conversas ao contato do card e exigem permissão de edição para enviar.
- `npm run typecheck` passou; `npm run lint -- src tests` passou com warnings preexistentes. `npm run lint` sem escopo não conseguiu ler uma pasta restrita em `database-backups/`.
- A suíte completa executou com envDir temporário: 4.403 testes passaram; 2 falharam em `tests/builder/embed.test.ts` por URL absoluta no happy-dom, e 2 suites dependentes de `node:sqlite` não iniciaram com a versão de Node instalada. Os testes direcionados do ChatbotX passaram (59 passed, 1 todo).
- `npm run build` não concluiu: Prisma não conseguiu ler `.env` e recebeu `EPERM` ao copiar runtime em `node_modules/.prisma/client`.
- URL do ChatbotX corrigida para a variável canônica `CHATBOTX_URL`; o cliente acrescenta `/api` para a Inbox. `CHATBOTX_API_URL` permanece apenas como fallback para instalações legadas.
- Após a correção da URL, typecheck e lint dos arquivos alterados passaram; os testes direcionados de API, doctor e actions passaram (63 passed, 1 todo).
- A busca do card agora descobre `id`, `type` e `valueType` do campo CNPJ no ChatbotX e consulta `/v1/conversations` com `contactFilter` serializado. Aceita CNPJ com ou sem máscara e preserva a paginação de cada formato.
- O token precisa de `contacts` e `inbox`; para envio, também precisa de permissão `full`. Nenhum banco ou migration foi alterado.
- Após a correção por CNPJ, `npm run typecheck` e lint dos arquivos alterados passaram; 37 testes direcionados passaram.
- `npm run lint` geral é bloqueado por `EACCES` em `database-backups/`; `npm test` padrão é bloqueado por `EACCES` no `.env`. Com configuração temporária, a suíte completa teve 4.417 testes aprovados, 2 falhas antigas em `tests/builder/embed.test.ts` e 2 suítes indisponíveis porque este Node não oferece `node:sqlite`.
- `npm run build` compilou o código e gerou as páginas, mas falhou ao coletar os traces porque a conta atual não consegue ler o `.env`; o cache `.next` também apresentou `EACCES`.
- Em 2026-10-10, a build completa passou nesta máquina com Node 22 e saída isolada em `.next-crm-chat-20261010` (Build ID `5SDnW-0TXkhC_7MFC6_zm`). `npm run lint` passou com 0 erros e 1192 warnings; `npm run typecheck` passou. A suíte completa teve 4.425 testes aprovados e 2 falhas preexistentes em `tests/builder/embed.test.ts` (URL absoluta do happy-dom). Nenhuma release foi ativada; os arquivos do colega foram preservados.
- O chat do card agora consulta a página mais recente a cada 8 segundos enquanto visível. Ao reabrir a aba, consulta imediatamente; após `429`, usa `Retry-After` e espera progressiva. A atualização preserva mensagens antigas e IDs como strings.
- Após o polling, `npm run typecheck` e lint dos arquivos alterados passaram; 39 testes direcionados passaram. O lint geral ainda encontra uma pasta restrita em `database-backups/` e `npm test` não lê o `.env`. Em configuração isolada, 4.422 testes passaram; as 2 falhas preexistentes de `tests/builder/embed.test.ts` e 2 suítes que dependem de `node:sqlite` permanecem.
- A tentativa de `npm run build` desta alteração parou em `prisma generate` por `EACCES` no `.env` e `EPERM` ao copiar o runtime para `node_modules/.prisma/client`. Nenhuma migração ou alteração de banco foi executada.
- A rolagem do histórico foi ajustada para acompanhar a última mensagem ao abrir a conversa ou receber uma nova. Páginas antigas não acionam a rolagem. O lint do componente e o typecheck passaram; `npm test` segue bloqueado por `EACCES` no `.env`.
- Em 2026-10-10, a nova build completa passou com Node 22 e saída isolada em `.next-crm-chat-20261010-r2` (Build ID `7-H4sEXj78-jjDeR66UIL`). `npm run lint` passou com 0 erros e 1192 warnings; `npm run typecheck` passou. A suíte completa teve 4.427 testes aprovados e as 2 falhas preexistentes em `tests/builder/embed.test.ts` (URL absoluta do happy-dom). Nenhuma release foi ativada.
