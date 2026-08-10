# Story: Presets, tutorial, contorno e compartilhamento na Central Criativa

## Status

Ready for Review

## Story

**Como** usuário do Alpha Motion,  
**quero** configurar presets, entender a Central Criativa, processar imagens de duas formas e publicar a apresentação por link,  
**para** reutilizar configurações e compartilhar o resultado sem enviar arquivos manualmente.

## Acceptance Criteria

1. A Central Criativa possui uma aba de presets onde é possível criar, editar e excluir presets personalizados de animação.
2. Os presets personalizados são persistidos na própria apresentação usando o JSON já existente, sem migration, e continuam disponíveis após recarregar ou acessar em outro navegador.
3. Os seletores de preset do elemento e da aplicação em lote exibem imediatamente presets nativos e personalizados.
4. A Central Criativa possui botão de tutorial com explicação das abas, criação de presets, processamento de imagem, formatos e exportação.
5. O processamento de imagens oferece as opções “Remover fundo” e “Criar contorno”; ambos geram um novo PNG na biblioteca sem alterar o original.
6. O botão “Exportar HTML” é substituído por “Exportar” e abre um modal com as opções “Arquivo HTML” e “Link de apresentação”.
7. Gerar link publica a apresentação em uma URL pública não enumerável; a URL pode ser copiada, aberta e renovada para invalidar a anterior.
8. A rota pública carrega somente apresentações `PUBLICADA`, respeita `expiraEm` quando preenchido e reutiliza o player responsivo do Alpha Motion sem exigir autenticação.
9. Alterações pendentes do slide são salvas antes de exportar HTML ou publicar o link.
10. Presets personalizados sobrevivem a autosave, reordenação e exclusão do slide que os armazena; duplicar slide não cria cópias conflitantes da biblioteca.
11. Nenhuma nova dependência, tabela, coluna, permissão ou migration é introduzida.

## Blueprint de Integração

### Criar

- [ ] Contrato e helpers de presets personalizados.
- [ ] Contexto compartilhado de presets no editor.
- [ ] Painel de presets e tutorial da Central Criativa.
- [ ] Modal unificado de exportação.
- [ ] Player/rota pública por slug.
- [ ] Testes de presets, contorno e publicação.

### Editar — integration points obrigatórios

- [ ] `CentralCriativaModal.tsx` — novas abas/ações.
- [ ] `BibliotecaAssets.tsx` e `remover-fundo.ts` — menu de processamento e contorno.
- [ ] `SeletorPreset.tsx` e `ModalAplicarPreset.tsx` — catálogo nativo + personalizado.
- [ ] `ApresentacaoEditor.tsx`, editor page e barra superior — estado inicial, salvamento e exportação.
- [ ] `apresentacoes.ts`, `slides.ts` e `slide-componentes.ts` — persistência segura e publicação.

### Consultar — precedentes

- `PlayerStandalone.tsx` — player compartilhado.
- `exportar-html/route.ts` — montagem dos dados do player.
- `ModalConvidarParceiro.tsx` — experiência de copiar link.
- `presets-completos.ts` — presets nativos e formato `AnimacaoPreset`.

## Tasks / Subtasks

- [x] Implementar contratos e persistência de presets personalizados.
- [x] Implementar aba de criação/edição e conectar os seletores.
- [x] Implementar tutorial contextual da Central Criativa.
- [x] Implementar contorno de imagem e escolha no botão de processamento.
- [x] Implementar modal de exportação, publicação e rota pública.
- [x] Adicionar regressões e executar quality gates.

## Testing

- Testes Vitest para contratos de presets, preservação no slide, contorno e publicação.
- Testes Alpha Motion existentes.
- Lint direcionado, typecheck, testes e build conforme o baseline do repositório.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-10 | 1.0 | Story criada após reconhecimento da Central Criativa e do fluxo público existente no schema. | Dex |
| 2026-08-10 | 2.0 | Presets persistentes, tutorial, contorno de imagem e publicação por link implementados e validados. | Dex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- ESLint direcionado aos arquivos desta entrega: aprovado.
- Vitest direcionado: 64/64 testes aprovados.
- Suíte `tests/apresentacoes`: 260/260 testes aprovados.
- `npx next build`: aprovado, incluindo a rota dinâmica `/apresentacao/[slug]`.
- `npx tsc --noEmit`: somente erros preexistentes em `.next/*/validator.ts`, `HabilitacaoRadarClient.tsx` e `tests/google-calendar/sync-queue.test.ts`.
- `npm test`: 970/971 testes aprovados; permanece o timeout preexistente de `tests/google-calendar/cli.test.ts`.
- `npm run lint`: bloqueado por milhares de ocorrências preexistentes em `.agents`, `.aiox-core` e worktrees; o lint direcionado desta entrega está limpo.
- `npm run build`: bloqueado no `prisma generate` por `EPERM` no query engine em uso; o build direto do Next.js foi aprovado.
- CodeRabbit indisponível porque o ambiente não possui WSL instalado.
- Browser: rota pública com slug inválido validada sem autenticação e sem erros de console; fluxo autenticado bloqueado pela tela de login sem credenciais disponíveis.

### Completion Notes List

- A Central Criativa agora permite criar, editar e excluir presets personalizados e oferece tutorial contextual.
- Os presets são persistidos no `dadosJson` existente e aparecem imediatamente nos dois seletores do editor.
- O ciclo de vida protege a biblioteca contra autosave, exclusão e duplicação de slides.
- O processamento de imagens permite remover o fundo ou criar contorno configurável, sempre preservando o original.
- O comando Exportar abre um modal para baixar HTML ou criar, copiar, abrir e renovar um link público.
- A rota pública reutiliza o player responsivo, valida status, expiração e slug não enumerável.
- Nenhuma dependência, alteração de schema ou migration foi necessária.

### File List

- `docs/stories/story-alpha-motion-central-criativa-presets-compartilhamento.md`
- `plan/self-critique-alpha-motion-central-criativa-compartilhamento.json`
- `src/actions/apresentacoes.ts`
- `src/actions/slides.ts`
- `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx`
- `src/app/apresentacao/[slug]/page.tsx`
- `src/components/Apresentacoes/PublicPresentationPlayer.tsx`
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx`
- `src/components/Apresentacoes/Editor/PresetsAnimacaoContext.tsx`
- `src/components/Apresentacoes/Editor/BarraSuperior/BarraSuperiorEditor.tsx`
- `src/components/Apresentacoes/Editor/BarraSuperior/ModalAplicarPreset.tsx`
- `src/components/Apresentacoes/Editor/BarraSuperior/ModalExportarApresentacao.tsx`
- `src/components/Apresentacoes/Editor/CentralCriativa/BibliotecaAssets.tsx`
- `src/components/Apresentacoes/Editor/CentralCriativa/CentralCriativaModal.tsx`
- `src/components/Apresentacoes/Editor/CentralCriativa/CentralCriativaTutorial.tsx`
- `src/components/Apresentacoes/Editor/CentralCriativa/PresetsAnimacaoPanel.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/SeletorPreset.tsx`
- `src/lib/apresentacoes/animacao/presets-personalizados.ts`
- `src/lib/apresentacoes/publicacao.ts`
- `src/lib/apresentacoes/remover-fundo.ts`
- `src/lib/validations/slide-componentes.ts`
- `tests/apresentacoes/central-criativa.test.ts`
- `tests/apresentacoes/presets-personalizados.test.ts`
- `tests/apresentacoes/publicacao-apresentacao.test.ts`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/session-draft.md`

## QA Results

- Pendente.
