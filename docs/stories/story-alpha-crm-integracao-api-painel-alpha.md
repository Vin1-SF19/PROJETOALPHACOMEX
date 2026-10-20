# Story: Integração do AlphaCRM independente com o Painel Alpha

## Status

In Progress

## História

Como usuário do CRM/BPM, quero que o AlphaCRM independente e o Painel Alpha se comuniquem por uma API autenticada, para que todos os dados e as automações disponíveis no CRM possam ser usados pelos dois projetos, mantendo o banco do CRM separado do banco do Painel Alpha.

## Contexto e escopo

- Origem funcional: `src/actions/bpm/`, `src/lib/bpm/` e `src/app/PainelAlpha/AlphaCRM/` do Painel Alpha.
- Destino: projeto irmão `../AlphaCRM`, com Prisma e conexão Turso própria, configurada posteriormente por variáveis de ambiente.
- A integração deve cobrir o inventário de recursos do CRM/BPM existente, inclusive pipelines, etapas, cards/oportunidades, empresas, contatos, tarefas, campos, formulários, checklists, histórico, membros, anexos, cadências, regras e automações. Recursos que dependam de serviços externos devem ter a dependência e o estado de disponibilidade documentados.
- O contrato entre os projetos usa API HTTP autenticada por token de servidor. O contrato deve ser versionado e documentado para que ambos consumam as mesmas operações e formatos.
- Nenhum dado de produção é migrado por esta story. Alterações estruturais de banco exigem o fluxo de backup e confirmação previsto em `AGENTS.md`.

## Critérios de aceite

1. Existe um inventário verificável das operações e automações do CRM/BPM no Painel Alpha, com correspondência de leitura, criação, atualização e exclusão na API quando a operação existir; lacunas são registradas explicitamente.
2. O Painel Alpha consegue consultar e operar os dados do CRM independente pela API, e o AlphaCRM consegue receber as operações necessárias, sem acesso direto de um projeto ao banco do outro.
3. A API exige token de servidor, valida entrada e autorização, não expõe segredos ao navegador e responde de forma consistente a token ausente/inválido, entrada inválida e recurso inexistente.
4. As duas aplicações usam identificadores, formatos de payload, paginação, erros e política de repetição documentados; chamadas repetidas que criam dados ou disparam automações não duplicam efeitos indevidamente.
5. Automações, cadências e eventos relevantes podem ser configurados e acionados pela integração, com execução no sistema responsável, rastreabilidade e proteção contra ciclos entre os projetos.
6. O AlphaCRM lê e escreve somente no banco Turso próprio configurado em suas variáveis de ambiente; o Painel Alpha mantém a própria conexão. Há exemplos de `.env` sem credenciais reais e instruções de configuração.
7. Testes cobrem autenticação, validação, isolamento dos bancos, operações representativas de cada grupo de recursos e ao menos um fluxo completo de automação entre os projetos.
8. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam nos projetos afetados, ou cada limitação preexistente é registrada com evidência.

## Checklist

- [x] Remover o botão “Abrir CRM independente” e sua propriedade no layout, conforme correção solicitada pelo usuário em 20/10/2026.
- [x] Story criada a partir do pedido do usuário e do inventário inicial dos módulos CRM/BPM.
- [x] Expor snapshot paginado dos recursos do BPM e manifesto de 66 recursos para a sincronização do CRM.
- [x] Implementar autenticação por token de servidor, cliente HTTP e exemplo das variáveis de integração no Painel Alpha.
- [x] Integrar consulta e criação de oportunidades do CRM independente no Painel Alpha.
- [x] Substituir o login próprio do AlphaCRM por entrada assinada a partir da sessão e da permissão CRM do Painel Alpha.
- [x] Confirmar que a entrada do Painel Alpha responde 401 sem sessão; ticket inválido responde 401 no CRM e ticket válido cria sessão sem tela de login.
- [ ] Mapear contratos, permissões e dependências externas de cada recurso e automação além do snapshot.
- [ ] Completar operações de escrita e execução das automações avançadas entre os dois projetos.
- [ ] Confirmar cobertura funcional e registrar lacunas do CRM original.
- [x] Verificar 401 sem token, manifesto autenticado, paginação do snapshot e sincronização do CRM em execução local.
- [ ] Completar testes de contrato e integração para todos os grupos de recursos e automações.
- [x] Executar `npm run typecheck`, `npm run lint` e `npm test` no Painel Alpha; lint passou com warnings preexistentes.
- [x] Confirmar `npm run build` após o ajuste final no campo chave do snapshot; execução final concluiu com exit 0.
- [x] Atualizar esta checklist, a File List e o status com o escopo efetivamente entregue até aqui.

## Estado da implementação

O Painel Alpha expõe um snapshot paginado para sincronização e consulta/criação de oportunidades via ponte HTTP. O manifesto autenticado lista 66 recursos. As definições de automação são preservadas no snapshot, mas a execução das automações avançadas continua no Painel Alpha. Os critérios de aceite de paridade completa, escrita genérica e fluxo completo de automação permanecem abertos.

O link do Painel Alpha agora emite um ticket assinado de 30 segundos para o AlphaCRM. O CRM cria uma sessão curta e não oferece tela, senha ou cadastro de login próprios. O navegador precisa entrar pelo Painel Alpha. A publicação pública do CRM ainda depende de uma URL alcançável e das migrações na base Turso escolhida.

## File List

- `docs/stories/story-alpha-crm-integracao-api-painel-alpha.md` — criação desta story.
- `.env.example` — variáveis da conexão HTTP com o AlphaCRM.
- `src/lib/alpha-crm/bridge-auth.ts` — autenticação do token de integração.
- `src/lib/alpha-crm/client.ts` — cliente HTTP do AlphaCRM independente.
- `src/app/api/integrations/alpha-crm/snapshot/route.ts` — snapshot paginado do CRM/BPM.
- `src/app/api/integrations/alpha-crm/opportunities/route.ts` — consulta e criação de oportunidades via CRM independente.
- `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx` — botão “Abrir CRM independente” removido por solicitação do usuário.
- `src/app/PainelAlpha/AlphaCRM/layout.tsx` — removido envio da URL de entrada independente ao layout.
- `src/app/api/integrations/alpha-crm/entry/route.ts` — entrada assinada após sessão e permissão no Painel Alpha.
- `package.json` e `package-lock.json` — declaração direta da dependência `jose` usada para assinar tickets.

## Change Log

| Date | Description |
| --- | --- |
| 2026-10-20 | Removido o botão “Abrir CRM independente”, criado sem solicitação do usuário, e o parâmetro que o exibia no layout. |
| 2026-09-26 | Story criada para integração bidirecional do CRM/BPM com banco separado e API autenticada. |
| 2026-09-26 | Atualizado escopo implementado, verificação local e lacunas de paridade. |
| 2026-09-26 | Removido login próprio do CRM; adicionada entrada assinada pelo Painel Alpha. |
| 2026-09-26 | Typecheck e build dos dois projetos concluídos; teste local do ticket e da entrada sem sessão concluído. |
| 2026-09-26 | Corrigido o redirecionamento do CRM sem sessão para a entrada assinada; usuário sem sessão no painel volta à página inicial do painel. A rota pública da entrada ainda não foi implantada. |

## Dev Agent Record — remoção do botão (20/10/2026)

- Pedido: remover o botão “Abrir CRM independente”, que o usuário informou não ter solicitado.
- Removidos o link, ícone e propriedade `standaloneUrl`; layout não envia mais o endereço da entrada independente. Navegação “Voltar” preservada.
- Checklist e File List atualizados. Nenhuma alteração de banco.
- `npm run typecheck`: exit 0; `npm run lint`: exit 0, warnings registrados no log; `npm test`: 661 arquivos e 5.021 testes aprovados, 4 ignorados e 1 todo.
- Evidências: `/tmp/alpha-remove-crm-button-{typecheck,lint,tests}.log`. Build não executado nesta correção visual. Sem commit/push naquele momento; solicitação posterior atendida pela entrega abaixo.


### Entrega isolada para staging — 20/10/2026

Correções preparadas sobre `80078d9e43530fd7d4babbd153dc695ea36688b2`, com commit/push solicitado pelo usuário. Alterações concorrentes mantidas fora deste patch.

- `npm run typecheck`: exit 0, `/tmp/alpha-vendedor-staging-typecheck.log`.
- `npm run lint`: exit 0, zero erros e 1.193 warnings, `/tmp/alpha-vendedor-staging-lint.log`.
- `npm test`: 641 arquivos aprovados, 4 com falha e 1 ignorado; 4.809 testes aprovados, 6 com falha, 7 ignorados e 1 todo. Falhas idênticas às já documentadas na base: Builder (3), scroll do modal (1), Próximo Contato (2) e importação da suíte de arquivamento. Nenhuma falha nova no delta. `/tmp/alpha-vendedor-staging-tests.log`.
- Build equivalente aprovado: Prisma/player oficiais, `next build --webpack`, heap de 4.096 MiB e uma CPU, sem alterar package/configuração versionada. Exit 0, 147,57 segundos; `/tmp/alpha-vendedor-staging-build-result.json` e `/tmp/alpha-vendedor-staging-build.log`.
- A suíte do workspace integrado registrada acima e esta validação isolada possuem conjuntos diferentes de alterações. As falhas preexistentes não são apresentadas como aprovação global.
- Nenhuma migration ou escrita no banco realizada nesta entrega.
