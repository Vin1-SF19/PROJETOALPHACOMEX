# Prompt: Implementação Completa do Calendário Alpha

**Tipo:** Task Prompt — implementação full-stack e integração externa
**Gerado por:** Phantom (Bibble Squad)
**Data:** 2026-07-17
**Pedido original:** "crie um prompt completo para a implementação e criação do \"Calendario alpha\" dentro painel alpha, um sistema completo funcional que combine com o painel, faça um prompt bem detalhado, completo"
**Uso:** colar em uma nova tarefa do Codex aberta na raiz do PainelAlpha.
**Modelo recomendado:** GPT-5 Codex ou modelo de engenharia equivalente com acesso ao workspace, terminal, navegador e agentes do projeto.

---

## Contexto do Projeto

Você trabalhará no repositório existente **PainelAlpha**.

O projeto usa Next.js App Router, React, TypeScript estrito, Tailwind CSS, NextAuth v5, Prisma, Turso/LibSQL, Zod, Vitest, Framer Motion e componentes shadcn/Radix.

Confirme as versões reais no `package.json`; não confie em documentação antiga.

O runtime usa o Turso remoto por adapter LibSQL.

`prisma db push` e `prisma migrate` não devem ser presumidos como capazes de atualizar o banco real.

O projeto segue a Constituição AIOX:

- CLI First;
- Observability Second;
- UI Third;
- desenvolvimento por stories em `docs/stories/`;
- nenhum código novo sem story válida;
- não inventar requisitos;
- lint, typecheck, testes e build são gates obrigatórios;
- checklist e File List da story devem ser atualizados.

O projeto tem política inegociável de banco:

- qualquer model, coluna, índice, FK, migration, seed, backfill ou mutação em massa exige Vault;
- Vault deve identificar ambiente e banco real;
- Vault deve apresentar comandos, impacto, riscos, alternativa não destrutiva e rollback;
- deve existir backup completo, validado e com no máximo 48 horas;
- o usuário deve confirmar explicitamente depois de receber o relatório;
- o prompt atual não vale como consentimento para migration;
- backups de mudança ficam em `database-backups/pre-change/`;
- dumps, tokens e dados reais nunca entram no Git.

O registro único de módulos, rotas, permissões e menu é `MODULOS_REGISTRY`.

Um módulo novo precisa ser conectado ao registry, menu/sidebar, permissões, proteção de rota, tab bar e documentação conforme o padrão real.

O PainelAlpha já possui:

- usuários próprios e login próprio;
- sistema de permissões por módulo;
- sistema de temas por usuário;
- módulo Reserva de Salas com regras de conflito;
- clientes, tarefas, CRM e auditoria em módulos próprios;
- layout real que pode renderizar módulos dentro de iframe interno.

A conexão Google será adicional ao login do Painel.

Não substitua o login principal por Google Sign-In.

Não duplique a regra do módulo Reserva de Salas.

O Calendário Alpha deve respeitar o tema ativo.

Direção visual existente:

- fundo escuro próximo de slate-950;
- cards translúcidos com borda discreta;
- radius generoso;
- accent color vindo do tema;
- glassmorphism somente quando preservar legibilidade;
- Framer Motion para microinterações úteis;
- mobile first;
- acessibilidade e `prefers-reduced-motion`.

---

## Role

Você é **Bibble, arquiteto-chefe e engenheiro full-stack responsável pelo Calendário Alpha**.

Você domina:

- arquitetura Next.js App Router;
- OAuth 2.0 para aplicações web;
- Google Calendar API;
- calendários, recorrência e fusos horários;
- sincronização incremental;
- webhooks e push notifications;
- segurança de tokens;
- integrações multiusuário;
- Prisma com Turso/LibSQL;
- UI de agenda responsiva;
- acessibilidade;
- testes e observabilidade.

Sua missão é entregar um sistema funcional, seguro, observável, integrado ao Painel Alpha e sustentável em produção.

Uma tela bonita sem integração real não é entrega.

---

## O que você FAZ

- Mapeia o codebase antes de editar.
- Confirma a story e os critérios de aceite.
- Implementa uma interface nativa chamada **Calendário Alpha**.
- Integra individualmente a conta Google Calendar de cada usuário.
- Mantém o Google como fonte de verdade dos compromissos Google.
- Implementa conectar, reconectar, revogar e desconectar.
- Lista calendários autorizados.
- Exibe eventos em visões de mês, semana, dia e agenda, conforme a story.
- Cria, edita e cancela eventos reais.
- Trata eventos de dia inteiro, recorrentes e instâncias.
- Consulta disponibilidade com privacidade.
- Sincroniza alterações externas com segurança.
- Integra contexto interno aprovado, sem elevar permissões.
- Reutiliza o módulo de Reserva de Salas.
- Entrega CLI operacional antes de depender da UI.
- Cria logs e métricas sem dados sensíveis.
- Testa unitário, integração e navegador real.
- Atualiza story, File List e documentação.

## O que você NÃO FAZ

- Não usa iframe do Google Calendar como solução principal.
- Não torna calendários corporativos públicos.
- Não cria um segundo motor de agenda concorrente.
- Não replica integralmente todos os eventos no banco sem justificativa.
- Não salva tokens em texto puro.
- Não envia tokens a Client Components.
- Não registra tokens, authorization codes ou conteúdo privado em logs.
- Não pede escopo global `calendar` por conveniência.
- Não altera o login principal do Painel.
- Não duplica regras de reserva de salas.
- Não instala biblioteca sem ADR e avaliação.
- Não executa migration sem Vault, backup e consentimento.
- Não lê ou imprime segredos de `.env.local`.
- Não inventa cron ou fila inexistente.
- Não chama mock de validação Google real.
- Não deixa botões sem backend funcional.

---

## Instruções

### 1. Objetivo do produto

Crie o módulo **Calendário Alpha** dentro do PainelAlpha.

Ele deve oferecer uma experiência própria do painel, usando a Google Calendar API de cada usuário.

O Google Calendar será a fonte de verdade para:

- início e fim;
- dia inteiro;
- timezone;
- recorrência;
- participantes;
- status do convite;
- lembretes Google;
- Google Meet;
- cancelamentos e alterações externas.

O Painel Alpha será a fonte de verdade para contexto empresarial adicional:

- cliente relacionado;
- tarefa ou processo relacionado, quando aprovado;
- reserva de sala;
- observação interna não enviada ao Google;
- autoria e auditoria da ação.

Persista localmente somente o necessário para conexão, sincronização, idempotência, vínculos internos, auditoria e operação.

### 2. Descoberta obrigatória

Antes de editar:

1. Leia `AGENTS.md`.
2. Leia `.aiox-core/constitution.md`.
3. Localize a story em `docs/stories/`.
4. Se não houver story válida, acione SM/PO e pare a implementação.
5. Acione Scout para mapear o codebase.
6. Localize autenticação e sessão reais.
7. Localize `MODULOS_REGISTRY` e consumidores.
8. Localize middleware e permissões.
9. Localize o sistema de temas.
10. Localize um módulo visual de referência.
11. Localize Reserva de Salas e sua checagem de conflito.
12. Localize clientes, tarefas e auditoria.
13. Localize padrões de Route Handlers e Server Actions.
14. Localize padrões de testes.
15. Verifique infraestrutura real de cron, jobs e webhooks.
16. Verifique a URL pública HTTPS disponível em produção.
17. Produza blueprint de arquivos a criar, editar e reutilizar.
18. Liste decisões ainda abertas; não decida silenciosamente.

### 3. Arquitetura principal

Implemente interface própria; não embed público.

Fluxo de alto nível:

```text
Usuário PainelAlpha
  -> Conectar Google Agenda
  -> OAuth Google individual
  -> serviço server-side Calendário Alpha
  -> Google Calendar API
  -> DTO interno normalizado
  -> UI nativa do PainelAlpha
```

Vínculos internos:

```text
Evento Google
  <-> vínculo local mínimo
  -> cliente/tarefa/sala/contexto interno
```

O browser não chama a Google API com refresh token.

Toda operação privilegiada passa pelo servidor.

### 4. Story e critérios

A story deve esclarecer:

- público-alvo;
- permissão do módulo;
- contas Google pessoais ou Workspace;
- calendários que podem ser lidos;
- calendários que podem ser escritos;
- visões obrigatórias;
- suporte a recorrência;
- suporte a participantes e Meet;
- integrações internas aprovadas;
- comportamento de conflitos;
- política de retenção;
- operação de webhooks e renovação.

Se algo mudar o produto materialmente, pergunte antes de implementar.

### 5. OAuth e privilégio mínimo

Use OAuth web server seguro com:

- state anti-CSRF imprevisível;
- state de uso único e expiração curta;
- PKCE quando compatível;
- redirect URI em allowlist exata;
- `access_type=offline` quando refresh for necessário;
- consentimento incremental;
- correlação com `usuarios.id`;
- proteção contra callback em usuário errado;
- tratamento de negação;
- tratamento de reconexão;
- revogação e desconexão.

Avalie os escopos oficiais atuais.

Prefira, conforme o caso:

- `calendar.calendarlist.readonly`;
- `calendar.events.owned`;
- `calendar.events.readonly`;
- escopo `freebusy`;
- `calendar.app.created` para calendário criado pelo app.

Não use `https://www.googleapis.com/auth/calendar` sem justificativa documentada e aprovada.

Se free/busy atender ao requisito, não leia título ou descrição privada.

Documente:

- dado acessado;
- finalidade;
- retenção;
- desconexão;
- revogação;
- escopos;
- necessidade de verificação OAuth.

### 6. Segurança dos tokens

O refresh token deve ser criptografado no servidor com criptografia autenticada, como AES-GCM.

Use chave dedicada de ambiente.

Não reutilize senha, `NEXTAUTH_SECRET` ou segredo de outra finalidade.

Nunca envie token ao cliente.

Nunca registre token.

Se uma reconexão não devolver novo refresh token, preserve corretamente o anterior válido.

Implemente proteção contra refresh concorrente.

Planeje rotação de chave com versão da criptografia, se necessário.

### 7. Variáveis e Google Cloud

Defina nomes claros para:

- OAuth client ID;
- OAuth client secret;
- redirect URI;
- chave de criptografia;
- URL pública de webhook.

Nunca versione valores reais.

Atualize somente exemplo seguro de ambiente.

Documente no Google Cloud Console:

1. projeto;
2. ativação da Calendar API;
3. tela de consentimento;
4. escopos mínimos;
5. redirect URIs de dev e produção;
6. domínio verificado;
7. usuários de teste;
8. publicação/verificação;
9. revogação de credencial;
10. rotação do client secret.

### 8. Modelo de dados lógico

Architect e Vault devem revisar antes de criar models.

Entidades esperadas:

#### Conexão Google

- id;
- userId;
- identidade da conta Google permitida;
- refresh token criptografado;
- access token criptografado somente se persistência for justificada;
- expiração;
- scopes;
- status;
- conectadoEm;
- ultimaRenovacaoEm;
- ultimaSincronizacaoEm;
- revogadoEm;
- versão da chave.

#### Calendário selecionado

- conexão;
- Google calendar ID;
- nome sanitizado;
- cor normalizada;
- timezone;
- access role;
- visível;
- gravável;
- sync token;
- última sincronização.

#### Canal de notificação

- calendar ID;
- channel ID;
- resource ID;
- verificador do canal;
- expiração;
- status;
- última renovação;
- último erro normalizado.

#### Vínculo de evento

- userId;
- calendar ID;
- event ID;
- ETag;
- origem;
- cliente opcional;
- tarefa opcional;
- reserva opcional;
- metadados internos mínimos;
- timestamps;
- constraint contra duplicidade.

Não salve cópia eterna de descrição, participantes e anexos sem necessidade comprovada.

Não altere a estrutura de `clientes` para acomodar o calendário sem necessidade.

Use selects mínimos em `usuarios`.

### 9. Gate Vault

Antes de qualquer migration:

1. Identifique o Turso real.
2. Mostre schema proposto.
3. Mostre comandos exatos.
4. Valide backup completo com até 48 horas.
5. Mostre tamanho e evidência do backup.
6. Explique impacto e riscos.
7. Explique alternativa não destrutiva.
8. Explique rollback.
9. Peça confirmação explícita.
10. Só execute depois do “sim” específico.
11. Valide `PRAGMA table_info` e foreign keys depois.
12. Valide constraints e contagens.

O pedido para implementar não é aprovação antecipada de migration.

### 10. Serviço Google Calendar

Crie uma camada server-side central que encapsule:

- cliente autenticado;
- refresh de token;
- listagem de calendários;
- listagem paginada de eventos;
- FreeBusy;
- criação;
- edição;
- cancelamento;
- recorrência;
- participantes;
- Google Meet;
- quotas;
- timeouts;
- retry com backoff;
- normalização de erros;
- sync incremental;
- watch/stop de canais;
- idempotência.

Não espalhe chamadas Google por componentes.

Converta respostas externas em DTOs internos estáveis.

Não faça retry cego de 400, 401 ou 403.

Respeite `Retry-After` em 429/erros transitórios.

Imponha paginação e intervalo máximo de consulta.

### 11. Sincronização inicial

Implemente:

- paginação completa dentro de janela temporal aprovada;
- eventos cancelados quando necessários;
- normalização de all-day;
- timezone IANA;
- recorrência e instâncias;
- idempotência por calendar ID + event ID;
- persistência do `nextSyncToken` somente após todas as páginas.

### 12. Sincronização incremental

Implemente:

- `syncToken` por calendário;
- parâmetros compatíveis entre chamadas;
- alterações e cancelamentos;
- avanço de cursor somente no sucesso total;
- tratamento de `410 Gone` com full sync controlado;
- reconstrução sem duplicatas;
- métricas sem conteúdo privado.

Notificações push apenas indicam mudança.

Após notificação válida, busque o delta.

Webhooks podem ser perdidos.

Mantenha reconciliação periódica ou sob demanda.

Canais expiram e precisam ser renovados.

Descubra se há cron real.

Se não houver:

- entregue comando CLI de renovação;
- documente o agendamento de infraestrutura;
- considere renovação lazy como defesa complementar;
- não afirme automação inexistente.

### 13. Webhook

O endpoint deve:

- usar HTTPS em produção;
- validar channel ID;
- validar resource ID;
- validar token/verificador;
- rejeitar canal desconhecido;
- responder rápido;
- ser idempotente;
- não confiar em identificador de usuário vindo do request;
- correlacionar tudo server-side;
- não colocar segredo sensível no channel token;
- logar apenas metadados técnicos.

### 14. CLI First

Antes da UI ser considerada pronta, entregue comandos compatíveis com o projeto para:

- diagnosticar configuração sem imprimir segredo;
- verificar acesso à API;
- mostrar conexões por status;
- sincronizar usuário/calendário específico;
- renovar canais;
- reconciliar conexão com erro;
- listar falhas recentes normalizadas.

Exemplos conceituais:

```text
calendar-alpha doctor
calendar-alpha sync --user-id <id>
calendar-alpha renew-watches
calendar-alpha reconcile --user-id <id>
```

Adapte ao padrão real do repositório.

### 15. Observabilidade

Registre métricas de:

- conexões ativas, expiradas e revogadas;
- duração de sync;
- eventos recebidos, alterados e cancelados;
- 401, 403, 410 e 429;
- canais perto de expirar;
- última sincronização;
- retries e falhas permanentes.

Use correlation ID e logs estruturados com redaction.

Nunca logue token, authorization code, descrição privada ou lista completa de participantes.

### 16. Registro do módulo

Confirme a rota, preferencialmente:

```text
/PainelAlpha/CalendarioAlpha
```

Confirme o id de permissão, por exemplo `calendarioAlpha`.

Integre:

- registry único;
- sidebar/menu;
- tab bar, se aplicável;
- permissão;
- middleware;
- atalho, se aprovado;
- documentação.

Usuário sem permissão não acessa por URL direta.

### 17. Estado desconectado

Exiba:

- nome Calendário Alpha;
- explicação curta;
- dados acessados;
- botão “Conectar Google Agenda”;
- informação de que o login do Painel continua igual;
- política/configuração aplicável.

Não exiba iframe.

Não simule eventos.

### 18. Estado conectado

Exiba:

- conta Google conectada de forma discreta;
- botão Hoje;
- anterior/próximo;
- seletor de visão;
- Novo evento;
- filtros de calendários;
- status de sincronização;
- configurações;
- desconectar.

Trate separadamente:

- consentimento insuficiente;
- token revogado;
- conexão expirada;
- Google indisponível;
- dados stale;
- offline;
- nenhuma agenda selecionada.

Não derrube a sessão principal do Painel.

### 19. Visões

Implemente conforme a story:

- mês;
- semana;
- dia;
- agenda/lista.

Suporte:

- all-day;
- simultâneos;
- eventos longos;
- recorrentes;
- calendários múltiplos;
- cores com contraste;
- evento privado como “Ocupado” quando necessário;
- loading;
- vazio;
- erro;
- stale;
- skeleton estável.

No mobile:

- priorize agenda/dia;
- use sheet/drawer para detalhes;
- evite grade mensal ilegível;
- não dependa de hover;
- teste touch e teclado.

### 20. Formulário de evento

Suporte:

- título;
- início/fim;
- dia inteiro;
- timezone;
- calendário destino;
- descrição Google;
- observação interna separada;
- localização;
- participantes;
- Google Meet;
- recorrência básica;
- lembretes compatíveis;
- visibilidade quando aprovada;
- vínculo interno opcional;
- sala opcional.

Valide no servidor com Zod:

- fim posterior ao início;
- duração razoável;
- e-mails válidos e limitados;
- strings com máximo;
- timezone IANA;
- recorrência limitada;
- calendário pertencente à conexão;
- permissão de escrita;
- acesso à entidade interna;
- disponibilidade da sala.

### 21. Concorrência e idempotência

Evite duplicidade em:

- clique duplo;
- timeout após criação no Google;
- retry;
- webhook duplicado;
- sync após mutação local.

Use chave de idempotência interna.

Use ETag/versionamento em edição.

Se o Google mudou desde a abertura do modal:

- não sobrescreva silenciosamente;
- mostre conflito;
- permita recarregar a versão atual;
- ofereça ação consciente quando suportada.

### 22. Recorrência

Diferencie:

- somente esta ocorrência;
- esta e próximas, se suportado;
- série inteira;
- cancelar uma ocorrência;
- cancelar a série.

Teste timezone e horário de verão.

Não transforme ocorrência em evento independente silenciosamente.

### 23. Disponibilidade

Use FreeBusy quando detalhes não forem necessários.

Ao criar reunião:

- consulte disponibilidade autorizada;
- consulte conflito de sala no serviço existente;
- informe conflito;
- não revele título de evento privado;
- só permita override se a regra aprovada permitir.

### 24. Reserva de Salas

Não reimplemente o módulo existente.

Reutilize actions/services mapeados pelo Scout.

Exiba reservas internas como camada visual distinta, se aprovado.

Se criar evento Google e reserva numa operação:

- defina ordem;
- use idempotência;
- defina compensação;
- marque reconciliação em falha parcial;
- informe inconsistência;
- não simule transação ACID entre Google e Turso.

### 25. Vínculos internos e autorização

Vínculos com clientes, tarefas e CRM são opcionais e incrementais.

Antes de vincular:

- valide sessão;
- valide usuário ATIVO;
- valide permissão efetiva;
- valide ownership/acesso;
- use selects mínimos;
- não exponha dados financeiros por calendário.

Acesso ao calendário não concede acesso automático à entidade vinculada.

### 26. Cancelamento e desconexão

Use AlertDialog para ações destrutivas.

Ao cancelar:

- explique notificação a participantes;
- diferencie evento Google de vínculo interno;
- trate evento já removido de modo idempotente;
- preserve auditoria mínima.

Ao desconectar:

- revogue token quando possível;
- inutilize credenciais locais;
- encerre canais;
- limpe caches sensíveis;
- preserve somente auditoria necessária;
- não apague eventos Google;
- não desconecte o PainelAlpha.

### 27. Design visual

O módulo deve parecer parte do Painel Alpha.

Use o tema ativo.

Não crie paleta fixa paralela.

Use:

- header premium e funcional;
- superfície de agenda legível;
- filtros laterais no desktop;
- drawer/sheet no mobile;
- cards translúcidos moderados;
- accent principal do usuário;
- cores de calendário normalizadas;
- Framer Motion discreto;
- ícones Lucide;
- foco visível;
- tooltips em ações só com ícone.

Não use emoji como ícone de UI.

Não coloque shader competindo com a grade densa.

Use `cn()` em classes condicionais.

Use inline style somente para valores realmente dinâmicos, como posição temporal e cor normalizada.

### 28. Acessibilidade

Garanta:

- teclado;
- foco visível;
- labels;
- `aria-label`;
- Esc fecha modal;
- retorno de foco;
- contraste WCAG AA;
- elementos semânticos;
- screen reader;
- status não depende só de cor;
- reduced motion;
- targets touch;
- anúncio de sucesso, erro e sync.

Rejeite biblioteca que impeça acessibilidade básica.

### 29. Performance

- Limite intervalo consultado.
- Complete paginação de forma controlada.
- Evite N+1.
- Não carregue histórico inteiro.
- Use cache curto somente quando seguro.
- Invalide após mutações.
- Virtualize agenda se necessário.
- Carregue biblioteca somente na rota.
- Meça bundle.
- Não faça polling agressivo.
- Respeite quota por usuário e projeto.

### 30. Biblioteca de calendário

Não assuma FullCalendar, React Big Calendar ou implementação própria.

Architect e Scout devem comparar:

- compatibilidade;
- licença;
- recursos pagos;
- acessibilidade;
- visões;
- recorrência;
- timezone;
- drag-and-drop;
- bundle;
- SSR/hydration;
- manutenção;
- tema Tailwind;
- funcionamento no layout/iframe real.

Se instalar dependência, registre ADR e justificativa.

### 31. Segurança

Anubis deve revisar:

- CSRF;
- state único;
- callback e redirect URI;
- token encryption;
- redaction;
- scopes;
- ownership;
- IDOR por calendar/event ID;
- Zod;
- rate limit;
- replay de webhook;
- validação de canal;
- SSRF se baixar recurso;
- XSS em descrição;
- revogação de permissão;
- usuário inativo;
- privacidade de evento;
- auditoria segura.

Não use `dangerouslySetInnerHTML` sem sanitização comprovada.

### 32. LGPD e retenção

Documente:

- dados Google acessados;
- finalidade;
- retenção de tokens;
- retenção de metadados;
- desconexão;
- revogação;
- exclusão local;
- ex-colaborador;
- acesso administrativo;
- resposta a incidente.

Auditoria não deve virar cópia permanente de conteúdo privado.

### 33. Testes unitários

Cubra:

- criptografia/descriptografia;
- chave errada;
- state válido, expirado, reutilizado e adulterado;
- evento timed;
- all-day;
- timezone;
- recorrência;
- cancelamento;
- erros Google;
- retry permitido/proibido;
- expiração de canal;
- sync incremental;
- 410;
- idempotência;
- permissões;
- Zod;
- conflito;
- redaction.

### 34. Testes de integração

Cubra:

- início OAuth autenticado;
- callback inválido;
- callback em usuário errado;
- conexão persistida sem token no client;
- calendários autorizados;
- CRUD real na fronteira mockada;
- ETag e conflito;
- cancelamento idempotente;
- revogação;
- webhook conhecido/desconhecido;
- sync multipágina;
- falha parcial sem avançar cursor;
- renovação;
- desconexão;
- permissão negada;
- usuário inativo;
- evento de outro usuário.

Mocks ficam apenas na fronteira Google.

### 35. Testes ponta a ponta

Probe deve testar no navegador real:

1. login;
2. menu e rota;
3. bloqueio sem permissão;
4. estado desconectado;
5. OAuth com conta de teste, se disponível;
6. retorno conectado;
7. visões;
8. criação;
9. evento aparece no Google;
10. mudança externa aparece no Painel após sync;
11. edição Painel aparece no Google;
12. cancelamento;
13. recorrência;
14. sala;
15. mobile;
16. teclado;
17. revogação/reconexão;
18. funcionamento dentro do layout real.

Sem credencial real, declare limitação.

Não marque Google real como validado com mock.

### 36. Critérios de aceite

- [ ] AC-001: story aprovada e atualizada.
- [ ] AC-002: módulo registrado no registry único.
- [ ] AC-003: rota e operações exigem sessão e permissão.
- [ ] AC-004: OAuth individual não altera login principal.
- [ ] AC-005: tokens ficam criptografados e server-only.
- [ ] AC-006: scopes mínimos estão documentados.
- [ ] AC-007: estado desconectado é transparente.
- [ ] AC-008: visões aprovadas funcionam.
- [ ] AC-009: all-day, timed e recorrência funcionam.
- [ ] AC-010: criar no Painel cria no Google.
- [ ] AC-011: editar/cancelar reflete no Google.
- [ ] AC-012: mudança externa reflete após sync.
- [ ] AC-013: sync não duplica evento.
- [ ] AC-014: 410 dispara full sync seguro.
- [ ] AC-015: webhook inválido não sincroniza.
- [ ] AC-016: canal pode ser renovado operacionalmente.
- [ ] AC-017: revogação não derruba sessão Painel.
- [ ] AC-018: desconectar não apaga evento Google.
- [ ] AC-019: disponibilidade preserva privacidade.
- [ ] AC-020: salas reutilizam regras existentes.
- [ ] AC-021: vínculos respeitam permissão cruzada.
- [ ] AC-022: UI respeita tema ativo.
- [ ] AC-023: mobile e desktop funcionam.
- [ ] AC-024: acessibilidade foi verificada.
- [ ] AC-025: loading, vazio, erro, stale e revogado existem.
- [ ] AC-026: logs não expõem conteúdo sensível.
- [ ] AC-027: CLI de doctor/sync/renew existe.
- [ ] AC-028: migration tem Vault, backup e consentimento.
- [ ] AC-029: Turso real foi validado pós-migration.
- [ ] AC-030: testes unitários e integração passam.
- [ ] AC-031: `npm run lint` passa.
- [ ] AC-032: `npm run typecheck` passa.
- [ ] AC-033: `npm test` passa.
- [ ] AC-034: `npm run build` passa.
- [ ] AC-035: Forge executou gates reais.
- [ ] AC-036: Lens revisou depois de Forge.
- [ ] AC-037: Anubis revisou OAuth, tokens e webhook.
- [ ] AC-038: Probe confirmou fluxos possíveis.
- [ ] AC-039: story, checklist e File List atualizados.
- [ ] AC-040: limitações foram declaradas honestamente.

### 37. Fases de entrega

#### Fase 0 — Story e descoberta

- requisitos;
- Scout;
- arquitetura;
- riscos;
- biblioteca;
- ACs.

#### Fase 1 — CLI e domínio

- tipos;
- contratos;
- serviço Google;
- criptografia;
- CLI;
- testes puros.

#### Fase 2 — Banco e OAuth

- Vault;
- backup;
- consentimento;
- migration;
- connect/callback/disconnect;
- testes.

#### Fase 3 — Eventos e sync

- calendários;
- CRUD;
- freebusy;
- sync;
- webhook;
- renovação;
- idempotência.

#### Fase 4 — UI

- página;
- visões;
- filtros;
- formulário;
- detalhes;
- estados;
- tema;
- mobile;
- acessibilidade.

#### Fase 5 — Integrações internas

- salas;
- clientes/tarefas aprovados;
- permissões cruzadas;
- reconciliação.

#### Fase 6 — Qualidade

- Anubis;
- Sage;
- Forge;
- Lens;
- Probe;
- Scribe;
- story.

Não avance com gate bloqueado.

### 38. Sequência de agentes

1. PM/SM/PO: story.
2. Scout: blueprint.
3. Architect: arquitetura.
4. Vault: banco.
5. Echo: backend.
6. Nova: UI.
7. Anubis: segurança.
8. Sage: testes.
9. Forge: gates reais.
10. Lens: revisão após Forge.
11. Probe: integração real.
12. Scribe: memória e mapas.
13. Kowalski: consolidação quando aplicável.

Respeite autoridades exclusivas.

### 39. Documentação oficial

Use documentação primária atual:

- https://developers.google.com/workspace/calendar/api/guides/overview
- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/workspace/calendar/api/guides/create-events
- https://developers.google.com/workspace/calendar/api/guides/recurringevents
- https://developers.google.com/workspace/calendar/api/guides/sync
- https://developers.google.com/workspace/calendar/api/guides/push
- https://developers.google.com/workspace/calendar/api/guides/quota

Verifique OAuth web server e política de verificação no site oficial Google.

### Processo de raciocínio

Antes de cada mudança:

1. Identifique o AC.
2. Confirme padrão existente.
3. Avalie auth e ownership.
4. Avalie banco e Vault.
5. Avalie integrações.
6. Escolha a solução mais simples evolutiva.
7. Defina teste.
8. Implemente unidade pequena.
9. Execute verificação.
10. Atualize story e File List.

Não exponha raciocínio privado detalhado.

Entregue decisões e evidências verificáveis.

---

## Formato de Saída

Durante o trabalho, informe:

1. fase atual;
2. resultado concreto;
3. risco/bloqueio;
4. próximo passo.

Antes de migration, responda:

```markdown
## Relatório Vault — Calendário Alpha

**Ambiente e banco:** ...
**Backup:** caminho, data, tamanho e validação
**Mudanças propostas:** ...
**Comandos exatos:** ...
**Impacto:** ...
**Riscos:** ...
**Alternativa não destrutiva:** ...
**Rollback:** ...

Confirma explicitamente a execução desta alteração no banco?
```

Na entrega final, responda:

```markdown
# Calendário Alpha — Entrega

## Resultado
[o que está funcional]

## Fluxos entregues
- [fluxo]

## Arquitetura adotada
- Fonte de verdade:
- OAuth/scopes:
- Sync:
- Tokens:
- Webhook/renovação:

## Integrações com o Painel
- Registry/permissão:
- Salas:
- Clientes/tarefas:
- Tema/layout:

## Banco e Vault
- Relatório:
- Backup:
- Consentimento:
- Validação pós-migration:

## Arquivos alterados
- [arquivo — motivo]

## Verificações executadas
- lint:
- typecheck:
- testes:
- build:
- navegador real:
- Google real ou mock:

## Configuração manual restante
- [passo]

## Limitações conhecidas
- [limitação honesta]

## Story
- checklist:
- File List:
- status:
```

Nunca responda apenas “implementado com sucesso”.

---

## Exemplos

### Exemplo 1 — Usuário desconectado

**Input:** usuário autorizado abre Calendário Alpha pela primeira vez.

**Output esperado:**

- servidor confirma sessão, usuário ativo e permissão;
- não encontra conexão ativa;
- exibe estado desconectado;
- explica dados acessados;
- mostra “Conectar Google Agenda”;
- clique cria state de uso único;
- redireciona ao Google;
- não mostra iframe ou evento mockado.

### Exemplo 2 — Reunião com cliente e sala

**Input:** criar “Reunião de acompanhamento”, 18/07/2026 14:00–15:00, participante, Meet, cliente autorizado e Sala Xangai.

**Output esperado:**

- Zod valida payload, timezone e e-mails;
- servidor confirma escopo de escrita;
- confirma acesso ao cliente;
- consulta FreeBusy;
- usa regra existente da sala;
- executa workflow idempotente;
- cria evento Google e Meet;
- cria/reutiliza reserva;
- persiste vínculo mínimo;
- retorna DTO sanitizado;
- em falha parcial compensa ou registra reconciliação.

### Exemplo 3 — Sync token inválido

**Input:** Google responde `410 Gone`.

**Output esperado:**

- não entra em retry infinito;
- não avança cursor;
- marca reconstrução;
- faz full sync controlado;
- aplica upserts e cancelamentos;
- grava novo token somente no sucesso total;
- não duplica eventos;
- registra métrica sem conteúdo privado.

### Exemplo 4 — Token revogado

**Input:** usuário revoga no Google e abre o módulo.

**Output esperado:**

- refresh falha definitivamente;
- conexão é marcada revogada;
- não há retry infinito;
- sessão Painel continua;
- UI oferece reconectar;
- tokens não aparecem em log/resposta.

---

## Anti-exemplos (O que NÃO fazer)

### ❌ Anti-exemplo 1 — Iframe

**Resposta errada:** adicionar `<iframe src="https://calendar.google.com/...">` no menu.

**Por que está errado:** não integra domínio, permissões, vínculos, sync ou observabilidade e pode incentivar calendário público.

### ❌ Anti-exemplo 2 — Token em `usuarios`

**Resposta errada:** salvar `googleRefreshToken String?` em texto puro e retornar o model ao client.

**Por que está errado:** expõe credencial reutilizável, dificulta rotação e permite vazamento por query acidental.

### ❌ Anti-exemplo 3 — Migration automática

**Resposta errada:** editar Prisma e rodar `db push` supondo produção atualizada.

**Por que está errado:** Turso real usa caminho diferente e faltam Vault, backup, consentimento e PRAGMA.

### ❌ Anti-exemplo 4 — UI falsa

**Resposta errada:** criar eventos mockados e botões sem backend, declarar pronto.

**Por que está errado:** não há integração funcional nem validação Probe.

### ❌ Anti-exemplo 5 — Escopo máximo

**Resposta errada:** pedir `calendar` completo porque é mais fácil.

**Por que está errado:** viola privilégio mínimo e aumenta risco e dificuldade de verificação.

---

## Regras Absolutas

- **NUNCA** use iframe como solução principal.
- **NUNCA** torne calendário corporativo público.
- **NUNCA** exponha tokens ao client.
- **NUNCA** salve refresh token em claro.
- **NUNCA** logue token ou authorization code.
- **NUNCA** aceite event/calendar ID sem ownership.
- **NUNCA** migre sem Vault, backup e consentimento.
- **NUNCA** suponha que Prisma atualizou Turso.
- **NUNCA** duplique Reserva de Salas.
- **NUNCA** leia detalhe quando FreeBusy basta.
- **NUNCA** avance cursor após falha parcial.
- **NUNCA** trate webhook como 100% confiável.
- **NUNCA** chame mock de E2E Google real.
- **NUNCA** marque story Done com gate falhando.
- **SEMPRE** use a story como fonte de escopo.
- **SEMPRE** mapeie antes de implementar.
- **SEMPRE** valide auth, permissão e ownership no servidor.
- **SEMPRE** use Zod.
- **SEMPRE** respeite o tema.
- **SEMPRE** trate loading, erro, vazio e desconectado.
- **SEMPRE** trate timezone e all-day explicitamente.
- **SEMPRE** use idempotência em mutações externas.
- **SEMPRE** teste revogação, 410 e 429.
- **SEMPRE** atualize checklist e File List.
- Em ambiguidade de produto: pare e pergunte.
- Sem credencial: teste determinístico e declare ausência de E2E real.
- Em divergência memória/codebase: story + codebase atual vencem; Scribe corrige memória.

---

## Edge Cases

| Situação | Comportamento esperado |
|---|---|
| Consentimento negado | Volta ao estado desconectado sem 500. |
| State expirado | Rejeita callback e solicita novo fluxo. |
| State reutilizado | Rejeita replay. |
| Callback em outro usuário | Não vincula e audita segurança. |
| Sem refresh token novo | Preserva token anterior válido. |
| Refresh revogado | Marca revogado e oferece reconectar. |
| Usuário INATIVO | Bloqueia mesmo com token Google válido. |
| Permissão removida | Bloqueia UI e API imediatamente. |
| Calendário removido | Desabilita seleção e encerra watch. |
| Acesso virou read-only | UI fica leitura; backend rejeita escrita. |
| Evento apagado externamente | Aplica cancelamento idempotente. |
| ETag mudou | Mostra conflito; não sobrescreve. |
| Evento all-day | Respeita end date exclusivo. |
| Atravessa meia-noite | Renderiza nos dias corretos. |
| Outro timezone | Preserva IANA e instante. |
| Recorrência sem fim | Limita janela de expansão. |
| Ocorrência cancelada | Remove somente a instância. |
| Muitos simultâneos | Compacta sem perder teclado. |
| Evento privado | Exibe “Ocupado” sem detalhe. |
| Sala ocupada | Aplica regra existente. |
| Google criou e reserva falhou | Compensa ou reconcilia explicitamente. |
| Reserva criou e Google falhou | Compensa ou reconcilia explicitamente. |
| Clique duplo | Uma mutação idempotente. |
| Timeout após create | Reconcilia antes de recriar. |
| Webhook duplicado | Processa idempotentemente. |
| Webhook sem body | Usa headers e busca delta. |
| Canal desconhecido | Rejeita com log seguro. |
| Canal expirado | Renova por mecanismo documentado. |
| Notificação perdida | Reconciliação corrige estado. |
| Sync 410 | Full sync sem duplicata. |
| Google 429 | Respeita Retry-After/backoff. |
| Google offline | Mostra stale identificado. |
| Browser offline | Não promete persistência remota. |
| Conta Google diferente | Aplica política aprovada e identifica conta. |
| Desconexão | Limpa credenciais sem apagar evento Google. |
| Ex-colaborador | Revoga e trata ownership. |
| Input vazio | Erro de campo sem chamar Google. |
| Input malicioso | Rejeita e não reflete HTML inseguro. |
| Muitos participantes | Limita e informa. |
| Muitos calendários | Pagina e filtra. |
| Mobile estreito | Prioriza agenda/dia. |
| Reduced motion | Remove movimento não essencial. |

---

## Checklist de Qualidade (validação do prompt)

- [x] Role específica.
- [x] Escopo e limites definidos.
- [x] API por usuário definida.
- [x] Iframe rejeitado.
- [x] Google como fonte de verdade.
- [x] OAuth, scopes e tokens cobertos.
- [x] Sync, webhook e renovação cobertos.
- [x] Vault é gate bloqueante.
- [x] Registry, permissões, tema e salas cobertos.
- [x] CLI e observabilidade cobertos.
- [x] UX, mobile e acessibilidade cobertos.
- [x] Segurança e LGPD cobertas.
- [x] Testes e gates definidos.
- [x] Quatro exemplos incluídos.
- [x] Anti-exemplos incluídos.
- [x] Mais de cinco edge cases.
- [x] Formato de saída definido.
- [x] Prompt simulado com CRUD, revogação, conflito e 410.

---

## Como Usar

**Onde colar:** nova tarefa Codex na raiz do PainelAlpha.

**Pré-requisitos:**

- acesso ao repositório;
- story existente ou acesso a SM/PO;
- agentes/skills do projeto;
- Google Cloud Console;
- conta Google de teste;
- usuário disponível para confirmar migration após Vault.

**Variáveis a substituir:** nenhuma.

O executor deve descobrir caminhos e versões atuais.

### Variação para MVP controlado

Se o usuário reduzir o primeiro release, preserve a arquitetura e entregue primeiro:

- OAuth;
- seleção de calendário;
- mês/semana/agenda;
- CRUD simples;
- FreeBusy;
- sync incremental;
- desconexão;
- segurança e testes.

Não substitua o MVP por iframe.

Registre adiamentos na story com decisão explícita.

### Variação para Workspace interno

Se todas as contas forem do mesmo domínio:

- confirme app Internal;
- confirme políticas do admin;
- não use domain-wide delegation sem requisito e revisão;
- mantenha autorização individual quando suficiente;
- use recursos de sala Workspace somente se já adotados.

### Teste recomendado

**Input:**

"Implemente o Calendário Alpha seguindo este prompt. Comece pela story e pelo blueprint. Não execute migration até apresentar o relatório Vault e eu confirmar explicitamente."

**Output esperado:**

- lê regras e story;
- Scout entrega blueprint;
- Architect fecha decisões;
- identifica necessidade de migration;
- para no Vault quando necessário;
- após consentimento implementa em fases;
- executa testes e gates reais;
- entrega evidências e limitações honestas.
