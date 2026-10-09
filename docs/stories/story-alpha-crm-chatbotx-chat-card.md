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
6. Não são adicionados anexos, criação de conversas ou polling nesta versão.

## Checklist

- [x] Implementar operações da API pública Inbox por `conversationId` e validação dos recursos.
- [x] Adicionar ações server-side com autorização do Alpha CRM e filtragem por cliente.
- [x] Integrar modal ao final do formulário da etapa.
- [x] Cobrir contrato de paginação, envio, IDs string e validação dos parâmetros.
- [x] Documentar as variáveis server-side da API no `.env.example`.
- [x] Executar os gates disponíveis e registrar as limitações ambientais.

## File List

- `src/lib/chatbot-alpha/chat-api.ts` — operações da Inbox API pública e schemas tolerantes ao contrato.
- `src/actions/AlphaCrmChatbotx.ts` — autorização do card, filtragem por cliente e proxy server-side.
- `src/app/PainelAlpha/AlphaCRM/CardModal/ChatClienteCard.tsx` — modal de seleção e conversa.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx` — botão ao final do formulário.
- `tests/chatbot-alpha/chat-api.test.ts` — testes do contrato Inbox.
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
