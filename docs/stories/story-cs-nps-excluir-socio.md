# Story: Excluir sócio no modal de dados do cliente

**ID:** STORY-CSNPS-EXCLUIR-SOCIO  
**Módulo:** CS & NPS  
**Status:** Ready for Review  
**Prioridade:** Média  
**Data de criação:** 2026-07-31  

## Narrativa

**Como** usuário do módulo CS & NPS,  
**quero** excluir um sócio diretamente no modal de dados do cliente,  
**para** manter o quadro societário correto sem sair do fluxo de edição.

## Critérios de Aceitação

- [ ] **AC-001:** Cada sócio exibido no modal possui uma ação de exclusão ao lado do lápis de edição.
- [ ] **AC-002:** A exclusão exige confirmação clara antes de alterar o rascunho.
- [ ] **AC-003:** Sócio já persistido é excluído do banco somente ao clicar em **Salvar Alterações**, seguindo o fluxo unificado do modal.
- [ ] **AC-004:** Sócio recém-adicionado e ainda não persistido é removido apenas do rascunho, sem chamada de exclusão ao servidor.
- [ ] **AC-005:** Em caso de falha no servidor, a exclusão permanece pendente e o modal informa o item que não foi salvo.
- [ ] **AC-006:** A ação exige sessão autenticada, revalida a página do CS & NPS após sucesso e não requer mudança de schema ou migration.

## Tasks / Subtasks

- [x] **Task 1 — Implementar exclusão persistida** (AC: 3, 5, 6)
  - [x] Criar server action autenticada para excluir um registro de `socios` por ID.
  - [x] Revalidar `/PainelAlpha/CadastroClientes` após sucesso e retornar erro tratável em falhas.

- [x] **Task 2 — Integrar a exclusão ao rascunho do modal** (AC: 1–5)
  - [x] Renderizar a lixeira ao lado do lápis, com título e rótulo acessível.
  - [x] Pedir confirmação e distinguir sócio persistido de sócio ainda não salvo.
  - [x] Processar exclusões pendentes no botão geral **Salvar Alterações**.

- [x] **Task 3 — Cobrir e validar o comportamento** (AC: 3, 5, 6)
  - [x] Testar sucesso, falta de autenticação, ID inválido e falha de persistência da server action.
  - [x] Executar lint, typecheck, testes e build conforme os gates do projeto.

- [x] **Task 4 — Evoluir a confirmação para modal visual** (AC: 2, 4)
  - [x] Substituir o `confirm()` nativo por modal alinhado ao design do CS & NPS.
  - [x] Exibir nome, vínculo, telefone e observação do sócio selecionado.
  - [x] Disponibilizar ações explícitas de **Cancelar** e **Confirmar exclusão**.
  - [x] Informar no modal se o item será removido do rascunho ou excluído no próximo salvamento.

## Dev Notes

- O quadro de sócios, a edição inline e o salvamento unificado estão em `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`.
- As operações existentes de criação e edição de sócios estão em `src/actions/Clientes.ts` e usam autenticação por `auth()` e `revalidatePath`.
- O modal já usa `_pendente: "criar" | "editar"` para adiar persistência até **Salvar Alterações**; a exclusão deve ampliar esse contrato sem mudar o comportamento das operações atuais.
- `Trash2` já é usado no modal e pode ser reutilizado; nenhuma nova dependência é necessária.
- Não foram encontrados documentos de arquitetura em `docs/architecture/`; o contexto foi extraído do fluxo atual e das stories existentes do módulo.
- A operação é CRUD normal sobre o modelo existente `socios`; não há alteração estrutural, migration ou mutação em massa, portanto a política Vault não se aplica.

## Testes Esperados

| Cenário | Resultado esperado |
|---|---|
| Excluir sócio persistido e confirmar | Item entra no rascunho de exclusão e só é apagado ao salvar tudo |
| Cancelar a confirmação | Nenhuma alteração local ou persistida |
| Excluir sócio recém-adicionado | Item some do rascunho sem chamada ao servidor |
| Salvar exclusão com sessão válida | `socios.delete` é executado e a rota do módulo é revalidada |
| Salvar exclusão sem sessão | Ação retorna não autorizado e não acessa o banco |
| Falha no banco | Modal permanece aberto e informa a exclusão que falhou |

## File List

| Arquivo | Ação prevista |
|---|---|
| `src/actions/Clientes.ts` | Adicionar a server action de exclusão de sócio |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` | Adicionar lixeira e integrar exclusões pendentes ao salvamento geral |
| `tests/cs-nps/clientes-logs.test.ts` | Cobrir a server action de exclusão |
| `docs/qa/coderabbit-reports/story-cs-nps-excluir-socio.md` | Registrar indisponibilidade do CodeRabbit e revisão manual substituta |
| `docs/stories/story-cs-nps-excluir-socio.md` | Acompanhar a implementação |

## CodeRabbit Integration

- **Tipo primário:** Frontend
- **Tipo secundário:** API / regra cadastral
- **Complexidade:** Baixa
- **Agentes:** `@dev`, com validação de `@qa`
- **Quality gates:** Pre-Commit e Pre-PR
- **Foco:** confirmação de ação destrutiva, acessibilidade, autenticação, tratamento de falha e preservação do fluxo de rascunho.
- **Self-healing:** `@dev` light, até 2 iterações de 15 minutos para issues CRITICAL; issues HIGH documentadas.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-07-31 | 1.0 | Story criada e aprovada a partir do pedido direto do usuário | River (SM) |
| 2026-07-31 | 1.1 | Exclusão de sócios implementada no rascunho unificado, protegida e testada | Dex (Dev) |
| 2026-07-31 | 1.2 | Confirmação nativa substituída por modal com dados do sócio e ações explícitas | Dex (Dev) |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/cs-nps/clientes-logs.test.ts --coverage=false` — 9 testes aprovados.
- `npx eslint tests/cs-nps/clientes-logs.test.ts` — aprovado.
- `git diff --check` — aprovado; apenas avisos de configuração global do Git e conversão LF/CRLF em arquivos já existentes.
- `npm test` — 573/574 testes aprovados; um teste do Agenda Alpha atingiu o timeout de 5 segundos sob carga.
- `npx vitest run tests/google-calendar/cli.test.ts --coverage=false` — o arquivo que expirou na suíte global passou isoladamente, 2/2 testes em 4,32 segundos.
- `npm run typecheck` — bloqueado por erros preexistentes em `ExclusaoFiscal/route`, `ModalPerfilColaborador.tsx`, `HabilitacaoRadarClient.tsx` e `tests/google-calendar/sync-queue.test.ts`; nenhum erro nos arquivos desta story.
- `npm run lint` — excedeu o limite de 180 segundos sem emitir diagnóstico global; o lint escopado confirmou débitos preexistentes nos arquivos grandes e nenhuma ocorrência nova permaneceu no diff.
- `npm run build` — aprovado no estado final; 68 páginas geradas.
- `docs/qa/coderabbit-reports/story-cs-nps-excluir-socio.md` — CodeRabbit indisponível por ausência de WSL; revisão manual substituta aprovada sem achados CRITICAL/HIGH.
- `npx tsc --noEmit --pretty false | Select-String 'modalDados.tsx'` — nenhum erro no modal após a evolução da tipagem local.
- Lint JSON escopado às regiões alteradas — nenhum erro novo; quatro ocorrências de `no-explicit-any` preexistentes fora da mudança.
- `npm run build` — repetido após o novo modal e aprovado; 68 páginas geradas.
- CodeRabbit repetido após a evolução — ainda indisponível porque o WSL não está instalado; relatório manual atualizado.

### Completion Notes List

- Adicionada lixeira vermelha ao lado do lápis para cada sócio, com `title`, `aria-label` e `type="button"`.
- A confirmação diferencia sócio persistido de sócio ainda não salvo.
- Exclusões persistidas usam `_pendente: "excluir"` e são executadas apenas no botão geral **Salvar Alterações**; falhas permanecem no rascunho e são informadas ao usuário.
- Sócios recém-adicionados são removidos somente do estado local, sem chamada ao servidor.
- A nova server action exige autenticação, valida ID inteiro positivo, usa Prisma, não expõe erro interno e revalida o módulo após sucesso.
- O `confirm()` nativo foi substituído por modal 3D do próprio módulo, renderizado em portal, com os dados do sócio, aviso contextual e botões **Cancelar** / **Confirmar exclusão**.
- O modal usa `role="dialog"`, `aria-modal`, título/descrição associados e foco inicial seguro no cancelamento.
- DoD: requisitos, ACs, testes focados, tratamento de erros, segurança, build, documentação e file list atendidos. Sem dependências, migration, configuração ou variável de ambiente nova. Gates globais com débito preexistente estão registrados acima.

### File List

- `src/actions/Clientes.ts` — modificado.
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` — modificado.
- `tests/cs-nps/clientes-logs.test.ts` — modificado.
- `docs/qa/coderabbit-reports/story-cs-nps-excluir-socio.md` — criado.
- `docs/stories/story-cs-nps-excluir-socio.md` — criado e atualizado.

## QA Results

_Pendente._
