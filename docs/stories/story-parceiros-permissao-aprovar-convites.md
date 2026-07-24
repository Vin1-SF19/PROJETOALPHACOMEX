# Story: Permissão individual para aprovar convites de parceiros

**ID:** STORY-PARCEIROS-PERMISSAO-APROVACAO  
**Módulo:** Parceiros  
**Status:** Ready for Dev  
**Prioridade:** Alta  
**Tipo:** Segurança / Frontend / Backend  
**Data de criação:** 2026-07-24  

## Story

**Como** administrador do módulo Parceiros,  
**quero** habilitar ou revogar individualmente a permissão de aprovação de convites,  
**para** que usuários autorizados vejam as notificações e possam aprovar ou rejeitar novos pré-cadastros sem receber as demais permissões administrativas.

> Nesta story, “aprovar/rejeitar convites” corresponde à moderação dos registros de `PreCadastroParceiro` enviados pelos links de convite.

## Acceptance Criteria

- [ ] **AC-001 — Novo controle individual:** O modal **Controle de Acesso** exibe, para cada usuário não Admin/CEO, um botão **Aprovar** ao lado dos botões atuais **Editar** e **Excluir**.
- [ ] **AC-002 — Estado persistente:** O botão indica claramente se a permissão está habilitada e permite ao Admin/CEO habilitar ou revogar `podeAprovar` por usuário; o estado continua correto após fechar e reabrir o modal ou recarregar a página.
- [ ] **AC-003 — Permissões independentes:** `podeAprovar`, `podeEditar` e `podeExcluir` são controles independentes. Alterar a aprovação não habilita nem revoga edição/exclusão, e vice-versa.
- [ ] **AC-004 — Admin/CEO:** Admin e CEO continuam com aprovação total por padrão, sem depender de uma configuração individual, e aparecem no modal como **Acesso total**.
- [ ] **AC-005 — Ícone e pendências:** Usuário com acesso ao módulo e permissão efetiva de aprovação vê o ícone de notificações, o total inicial de pré-cadastros pendentes e pode abrir o item correspondente.
- [ ] **AC-006 — Notificação em tempo real:** Usuário com permissão de aprovação pode assinar o canal privado de novos pré-cadastros e recebe as notificações em tempo real; usuário sem a permissão recebe `403` ao tentar autorizar o canal.
- [ ] **AC-007 — Aprovar e rejeitar:** Usuário autorizado pode aprovar, rejeitar e, quando aplicável ao fluxo atual, reverter um pré-cadastro rejeitado para aprovado.
- [ ] **AC-008 — Revogação efetiva:** Após revogar a permissão, o usuário deixa de ver o sino e as entradas de moderação na próxima atualização da interface e não consegue aprovar, rejeitar, listar pendências nem assinar o canal privado por chamadas diretas.
- [ ] **AC-009 — Segurança server-side:** As Server Actions e a rota de autenticação do Pusher consultam a permissão efetiva no servidor. Ocultar ou desabilitar botões no cliente não substitui a autorização.
- [ ] **AC-010 — Sem regressão:** As permissões atuais de editar/excluir, a geração de links de convite e o acesso de Admin/CEO continuam funcionando conforme as regras existentes.

## Fora do Escopo

- Alterar o formulário público ou o conteúdo dos convites.
- Alterar as regras de validação para transformar um pré-cadastro em parceiro.
- Conceder edição ou exclusão automaticamente a quem recebe permissão de aprovação.

## Tasks / Subtasks

- [ ] **Task 1 — Persistir a nova permissão** (AC: 1–4)
  - [ ] Estender `ParceiroAcesso` com `podeAprovar` booleano e default seguro `false`.
  - [ ] Atualizar leitura e salvamento do controle de acessos para transportar as três permissões sem sobrescrever valores não alterados.
  - [ ] Preservar a regra de acesso total para Admin/CEO.
  - [ ] Antes de qualquer schema change/migration, acionar `Vault`, apresentar impacto e rollback, validar backup completo com até 48 horas e obter confirmação explícita do usuário.

- [ ] **Task 2 — Aplicar autorização server-side à moderação** (AC: 4, 7–9)
  - [ ] Incluir `podeAprovar` no contexto/permissão efetiva do módulo.
  - [ ] Exigir `isAdmin || podeAprovar` em `listarPreCadastros`, `contarPreCadastrosPendentes`, `aprovarPreCadastro` e `rejeitarPreCadastro`.
  - [ ] Manter a proteção contra reaprovação/duplicação já existente.
  - [ ] Retornar erro de autorização consistente sem executar leitura sensível ou mutação quando a permissão estiver ausente.

- [ ] **Task 3 — Autorizar notificações em tempo real** (AC: 5, 6, 8, 9)
  - [ ] Alterar a autorização do canal `private-parceiros-precadastros` para aceitar Admin/CEO ou usuário com `podeAprovar` vigente no banco.
  - [ ] Negar sessão ausente, usuário sem acesso ou permissão revogada.
  - [ ] Habilitar a assinatura client-side somente para quem possui permissão efetiva.

- [ ] **Task 4 — Ajustar a interface do módulo** (AC: 1–8)
  - [ ] Adicionar o botão **Aprovar** ao `ModalEngrenagem`, com estado visual, título acessível e feedback de salvamento.
  - [ ] Expor `podeAprovar` em `getPermissaoParceiros`, na página server e no tipo de permissões do client.
  - [ ] Exibir sino, badge, dropdown e entrada **Pré-cadastros** para `isAdmin || podeAprovar`, mesmo quando `podeEditar` for `false`.
  - [ ] Passar a permissão efetiva ao modal de pré-cadastros e habilitar os controles de aprovar/rejeitar somente para autorizados.

- [ ] **Task 5 — Testes e quality gates** (AC: 1–10)
  - [ ] Cobrir Admin/CEO, usuário com `podeAprovar=true`, usuário com `false` e usuário sem registro de acesso.
  - [ ] Cobrir concessão, persistência e revogação sem alterar `podeEditar`/`podeExcluir`.
  - [ ] Cobrir chamadas diretas de listar, contar, aprovar e rejeitar com e sem permissão.
  - [ ] Cobrir autorização Pusher com respostas permitida e `403`.
  - [ ] Cobrir renderização do sino, badge, menu e botões de moderação.
  - [ ] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Dev Notes

### Contexto verificado

- `ParceiroAcesso` possui hoje apenas `podeEditar` e `podeExcluir`; a existência do registro também compõe o acesso ao módulo. [Source: `prisma/schema.prisma`, model `ParceiroAcesso`]
- `getPermissaoParceiros` e `salvarAcessoParceiro` transportam somente edição/exclusão. [Source: `src/actions/parceiros.ts`]
- O sino e o hook realtime são habilitados exclusivamente por `permissao.isAdmin`; a entrada **Pré-cadastros** depende de `podeEditar`. [Source: `src/components/Parceiros/ParceirosClient.tsx`]
- `aprovarPreCadastro` aceita somente Admin/CEO, enquanto `rejeitarPreCadastro`, listagem e contagem aceitam qualquer usuário com acesso ao módulo. [Source: `src/actions/convites-parceiro.ts`]
- O botão de aprovação do modal é desabilitado por `!isAdmin`, mas a rejeição não usa o mesmo critério. [Source: `src/components/Parceiros/ModalPreCadastros.tsx`]
- O canal `private-parceiros-precadastros` está classificado como Admin-only na autenticação do Pusher. [Source: `src/app/api/pusher/auth/route.ts`]
- Não existem `docs/architecture/`, `docs/prd/` ou `accumulated-context.md` no workspace; a coerência desta story foi validada diretamente contra os pontos de integração atuais e as stories existentes.

### Arquivos prováveis

- `prisma/schema.prisma` e migration correspondente
- `src/actions/parceiros.ts`
- `src/actions/convites-parceiro.ts`
- `src/app/api/pusher/auth/route.ts`
- `src/app/PainelAlpha/Parceiros/page.tsx`
- `src/components/Parceiros/ModalEngrenagem.tsx`
- `src/components/Parceiros/ParceirosClient.tsx`
- `src/components/Parceiros/ModalPreCadastros.tsx`
- `src/hooks/useParceirosPreCadastroNotifications.ts`
- Testes do módulo em `tests/parceiros/`

## Testing

| Cenário | Resultado esperado |
|---|---|
| Admin/CEO | Acesso total, sino e moderação disponíveis |
| Usuário com aprovação e sem edição/exclusão | Vê notificações e modera; não edita nem exclui parceiros |
| Usuário com edição e sem aprovação | Mantém edição; não vê notificações nem modera pré-cadastros |
| Permissão revogada | UI removida após atualização e chamadas diretas negadas |
| Tentativa de assinar canal sem permissão | `403` |
| Aprovação/rejeição autorizada | Estado atualizado e interface recarregada sem duplicação |
| Salvamento das três permissões | Nenhum valor independente é alterado acidentalmente |

## CodeRabbit Integration

- **Primary Type:** Security
- **Secondary Types:** Database, Frontend, API
- **Complexity:** High
- **Primary Agent:** `@dev`
- **Supporting:** `@data-engineer`, `@architect`, `@qa`
- [ ] Pre-Commit: revisar autorização server-side, default seguro e cobertura de bypass.
- [ ] Pre-PR: executar CodeRabbit contra a base; zero findings CRITICAL.
- **Self-healing:** `@dev` light, 2 iterações, 15 minutos, CRITICAL `auto_fix`, HIGH `document_only`.
- **Focus:** separação das três permissões, Pusher privado, least privilege, migration segura e ausência de confiança exclusiva na UI.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-07-24 | 1.0 | Story criada e preparada para desenvolvimento | River (SM) |

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## QA Results

