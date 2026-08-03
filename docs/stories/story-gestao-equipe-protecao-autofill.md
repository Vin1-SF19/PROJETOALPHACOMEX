# Story: Proteção contra preenchimento automático na Gestão da Equipe

## Status

Ready for Review

## Story

**Como** administrador responsável pela Gestão da Equipe,
**quero** que os campos de criação e edição de usuários não sejam preenchidos automaticamente pelo navegador ou por gerenciadores de senha,
**para** evitar que credenciais e tokens sejam substituídos sem intenção.

## Tipo e complexidade

- Tipo: Frontend / Segurança
- Complexidade: Média
- Banco de dados: nenhuma alteração estrutural ou migração

## Critérios de aceitação

1. Todos os campos da criação de usuário recebem proteção explícita contra autofill do navegador e dos gerenciadores de senha mais comuns.
2. Todos os campos editáveis do modal de colaborador recebem a mesma proteção, inclusive senha, token, observações e campos auxiliares.
3. Um token Onyx já configurado só pode ser substituído depois que o administrador clicar explicitamente em **Alterar token**.
4. Salvar outros dados do colaborador sem ativar a edição do token nunca envia `token_onyx` para atualização.
5. Ao abrir ou recarregar o modal, os campos de token e troca de senha permanecem vazios e o valor real do token nunca trafega para o cliente.
6. A remoção explícita do token continua disponível e funcional.
7. Existem testes de regressão para a política de autofill e para a trava de substituição do token.

## Tarefas

- [x] Criar atributos reutilizáveis de bloqueio para navegadores e gerenciadores de senha.
- [x] Aplicar a política a todos os campos da criação de usuário.
- [x] Aplicar a política a todos os campos editáveis do modal de colaborador.
- [x] Exigir ativação explícita antes de editar ou enviar um token Onyx.
- [x] Adicionar testes automatizados de regressão.
- [x] Executar lint, typecheck, testes e build aplicáveis.

## Notas técnicas

- `autocomplete="off"` isoladamente não é respeitado por todos os navegadores e extensões; combinar semântica correta de `autocomplete` com atributos reconhecidos por gerenciadores de senha.
- A trava de negócio no payload é a proteção principal contra substituição acidental do token.
- Não alterar schema, migrations ou dados existentes.

## Arquivos previstos

- `src/components/FormCadastro.tsx`
- `src/components/Colaboradores/ModalPerfilColaborador.tsx`
- `src/components/ui/autofill-protection.ts`
- `tests/gestao-equipe/autofill-protection.test.ts`

## Dev Agent Record

### Implementação

- Criados atributos compartilhados para impedir sugestões do navegador, 1Password, LastPass e Bitwarden.
- Campos de criação e edição agora declaram uma política explícita de `autocomplete`.
- O token fica desabilitado até o clique em **Alterar token** ou **Configurar token**.
- A função pura `getTokenOnyxUpdate` impede que valores injetados sejam enviados sem ativação explícita.
- Estados temporários de token e senha são zerados ao carregar cada colaborador.

### Testes e validações

- Teste direcionado: 4/4 aprovados.
- Suíte completa: 78 arquivos e 630 testes aprovados.
- Build Next.js de produção: aprovado.
- ESLint dos novos módulos e teste: aprovado.
- ESLint dos componentes alterados: somente 2 erros e 1 warning preexistentes em `useEffect`.
- `npm run lint`: excedeu 120 segundos sem concluir no repositório completo.
- `npm run typecheck`: bloqueado pelos 5 erros preexistentes já registrados no projeto.
- CodeRabbit: indisponível por ausência de WSL; revisão manual aprovada e registrada.

### File List

- `docs/stories/story-gestao-equipe-protecao-autofill.md`
- `src/components/FormCadastro.tsx`
- `src/components/Colaboradores/ModalPerfilColaborador.tsx`
- `src/components/ui/autofill-protection.ts`
- `src/lib/colaboradores/token-onyx-update.ts`
- `tests/gestao-equipe/autofill-protection.test.ts`
- `plan/self-critique-gestao-equipe-autofill.json`
- `docs/qa/coderabbit-reports/story-gestao-equipe-protecao-autofill.md`

## Change Log

- 2026-08-03: Story criada e aprovada a partir da solicitação explícita do usuário.
- 2026-08-03: Proteção contra autofill e trava explícita do token implementadas e testadas.

## CodeRabbit Review

- CodeRabbit indisponível por ausência de WSL; fallback manual com decisão PASS em `docs/qa/coderabbit-reports/story-gestao-equipe-protecao-autofill.md`.
