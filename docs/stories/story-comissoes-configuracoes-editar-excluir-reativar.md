# Story: Comissões — editar, excluir e reativar configurações

## Status

Ready for Review

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["vitest", "eslint", "typescript", "next-build", "coderabbit"]

## Story

**Como** responsável pelas configurações de comissões,  
**quero** corrigir, remover ou reativar cadastros diretamente nas respectivas seções,  
**para que** configurações de teste ou desatualizadas não permaneçam bloqueando a operação e os setores dos cargos sejam exibidos corretamente.

## Contexto e origem

Story criada a partir da solicitação explícita do usuário em 2026-07-30. O escopo cobre as seções mutáveis das Configurações de Comissões e preserva como somente leitura os dados derivados de outros módulos e os históricos de auditoria.

Não haverá alteração de schema, migration, seed, backfill ou mutação em massa. As operações são CRUD normais, protegidas pela permissão `CONFIGURAR`.

## Acceptance Criteria

1. Tarifários existentes podem ser editados e excluídos, com validação no servidor, feedback visual e confirmação antes da exclusão.
2. Cargos podem ser editados, inativados e reativados; o histórico não é apagado.
3. A seção de cargos exibe o setor real derivado de `usuarios.role` para ocupantes do cargo, usando o setor cadastrado no cargo apenas como fallback.
4. Quando ocupantes do mesmo cargo possuem mais de uma `role`, a interface informa todos os setores encontrados sem escolher um arbitrariamente.
5. Exceções podem ser editadas e excluídas, com confirmação antes da exclusão.
6. Feriados estaduais e municipais podem ser editados e excluídos; feriados nacionais permanecem automáticos e somente leitura.
7. Regras existentes são listadas, podem ser carregadas para edição por nova versão e podem ser inativadas ou reativadas sem apagar o histórico.
8. Permissões continuam editáveis por categoria e podem ser restauradas ao padrão do módulo.
9. Serviços e colaboradores permanecem somente leitura por serem derivados de Metas/Gestão de Colaboradores; integrações e espelhos permanecem somente leitura por serem históricos de auditoria.
10. Todas as mutações exigem a categoria de permissão adequada e tratam registros inexistentes com erro claro.
11. A interface oferece ações acessíveis, estados de carregamento e confirmações destrutivas responsivas.
12. Testes automatizados cobrem edição, exclusão, reativação, setor por `role`, versionamento de regras e restauração de permissões.
13. Lint dos arquivos alterados, typecheck, testes e build são executados antes da conclusão, com impedimentos externos documentados.

## Tasks / Subtasks

- [x] Task 1 — Tarifários (AC: 1, 10, 11)
  - [x] Completar contratos de atualização e exclusão no servidor.
  - [x] Adicionar modo de edição e confirmação de exclusão na interface.
- [x] Task 2 — Cargos e setor real (AC: 2–4, 10, 11)
  - [x] Derivar setores pelas `roles` dos usuários que ocupam cada cargo.
  - [x] Adicionar edição e ativação/inativação.
- [x] Task 3 — Exceções e calendários (AC: 5–6, 10, 11)
  - [x] Adicionar atualização completa e exclusão de exceções.
  - [x] Adicionar edição de feriados persistidos.
- [x] Task 4 — Regras e permissões (AC: 7–8, 10, 11)
  - [x] Listar e carregar regras existentes no construtor.
  - [x] Preservar versões publicadas e editar por nova versão.
  - [x] Implementar reativação de regra e restauração de permissões.
- [x] Task 5 — Seções somente leitura (AC: 9)
  - [x] Explicitar a origem e o motivo de não oferecer editar/excluir.
  - [x] Unificar a lista de Serviços ao mesmo catálogo usado no cadastro comercial.
- [x] Task 6 — Qualidade (AC: 12–13)
  - [x] Atualizar testes automatizados.
  - [x] Executar os quality gates e registrar resultados.

## Dev Notes

- `CargoColaborador` já possui `ativo`, então reativação não exige alteração estrutural. [Source: `prisma/schema.prisma#CargoColaborador`]
- O setor operacional real do usuário é armazenado em `usuarios.role`; `CargoColaborador.setorId` funciona como metadado/fallback. [Source: `prisma/schema.prisma#usuarios`; solicitação do usuário]
- Regras publicadas não devem ser sobrescritas: a edição cria uma nova `CommissionRuleVersion`. [Source: `src/actions/CommissionRuleBuilder.ts#CriarVersaoRegra`]
- Serviços são derivados de `ServicosComerciais`; colaboradores são derivados de `usuarios` e contratos. [Source: `src/actions/CommissionTariffs.ts`; `src/actions/CommissionPositions.ts`]
- Integrações e espelhos representam históricos de sincronização/exportação e devem preservar auditoria. [Source: `src/actions/CommissionSync.ts`; `src/actions/CommissionExports.ts`]
- Operações deste escopo são CRUD pontuais em modelos existentes; não acionam a política Vault por não alterarem estrutura nem realizarem mutação em massa. [Source: `AGENTS.md#Database-Safety-and-Backup-Policy`]

### Testing

- Testes do módulo: `tests/commissions/`, usando Vitest.
- Gates: lint direcionado, `npm run typecheck`, `npm test` e `npm run build`.
- Validar que exclusões exigem confirmação na UI e que históricos/versionamento não são apagados.

## 🤖 CodeRabbit Integration

**Primary Type:** Frontend  
**Secondary Types:** API, Security  
**Complexity:** Medium

**Primary Agents:**
- @dev
- @ux-expert

**Quality Gate Tasks:**
- [ ] Pre-Commit (@dev): revisar alterações não commitadas.
- [ ] Pre-PR (@github-devops): revisar autorização, integridade e acessibilidade.

**Expected Self-Healing:**
- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutes
- Severity Filter: CRITICAL

**Focus Areas:**
- Autorização em todas as mutações.
- Preservação de histórico em cargos e regras.
- Confirmações destrutivas, estados de carregamento e formulários responsivos.

## Dev Agent Record

### Debug Log

- `npm test`: 60 arquivos e 499 testes aprovados.
- ESLint direcionado aos 13 arquivos alterados: aprovado sem avisos.
- `npm run lint`: excedeu 184 segundos ao varrer também framework/worktrees; o escopo alterado foi validado separadamente.
- `npm run typecheck`: nenhum erro no escopo; permanecem erros anteriores em `ExclusaoFiscal/route`, `ModalPerfilColaborador.tsx` e `HabilitacaoRadarClient.tsx`.
- `npm run build`: `prisma generate` bloqueado pelo Windows porque o servidor local mantém a DLL do Prisma aberta.
- `npx next build`: compilação e geração das 68 páginas concluídas com sucesso.
- CodeRabbit: indisponível porque o WSL não está instalado neste ambiente.
- Correção do catálogo de serviços: teste direcionado com 19 cenários aprovado; suíte completa atualizada para 60 arquivos e 501 testes aprovados.
- `npx next build` após a correção do catálogo: aprovado, com 68 páginas geradas.
- ESLint do catálogo compartilhado, actions, aba de Serviços e testes: aprovado. Os dois modais legados de Cadastro de Clientes mantêm débitos de lint anteriores e não relacionados à troca da constante.

### Completion Notes

- Tarifários, exceções e feriados persistidos agora podem ser editados e excluídos com confirmação.
- Cargos podem ser editados, inativados e reativados; setores são derivados de `usuarios.role`, com fallback para `setorId`.
- Renomear cargo com ocupantes é bloqueado para evitar uma atualização em massa silenciosa dos colaboradores.
- Regras existentes são listadas, editadas por nova versão e podem ser inativadas/reativadas.
- Permissões individuais podem ser restauradas ao padrão removendo apenas os overrides do usuário.
- Serviços, colaboradores, integrações e espelhos permanecem somente leitura por sua origem derivada/histórica.
- A aba Serviços agora usa exatamente o catálogo Alpha do seletor comercial: seis serviços padrão mais os serviços personalizados criados em “Novo Serviço”.
- A comparação entre serviço e tarifário passou a ignorar diferenças de acentuação, caixa e espaços, evitando falsos “Sem tarifário”.
- Nenhuma migration ou alteração estrutural foi necessária.

### File List

- `docs/stories/story-comissoes-configuracoes-editar-excluir-reativar.md`
- `src/actions/CommissionTariffs.ts`
- `src/actions/ContratoComercial.ts`
- `src/actions/CommissionPositions.ts`
- `src/actions/CommissionHolidays.ts`
- `src/actions/EligibilityOverrides.ts`
- `src/actions/CommissionRuleBuilder.ts`
- `src/actions/CommissionPermissions.ts`
- `src/components/Comissoes/Configuracoes/AbaTarifarios.tsx`
- `src/components/Comissoes/Configuracoes/AbaServicos.tsx`
- `src/components/Comissoes/Configuracoes/AbaCargos.tsx`
- `src/components/Comissoes/Configuracoes/AbaExcecoes.tsx`
- `src/components/Comissoes/Configuracoes/AbaCalendarios.tsx`
- `src/components/Comissoes/Configuracoes/AbaPermissoes.tsx`
- `src/components/Comissoes/Configuracoes/ConstrutorRegras.tsx`
- `src/components/comercial/ModalGerenciamentoLeads.tsx`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modal.tsx`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`
- `src/lib/comercial/servicos.ts`
- `tests/commissions/configuracoes.test.ts`
