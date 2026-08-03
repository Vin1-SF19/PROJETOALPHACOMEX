# Story: Central Criativa do Alpha Presentation Studio

**Status:** Concluída  
**Módulo:** Alpha Presentation Studio  
**Data:** 2026-08-03

## Objetivo

**Como** usuário autorizado do Alpha Presentation Studio,  
**quero** gerenciar mídias, identidade visual, formato e exportação dentro do editor,  
**para** produzir apresentações completas sem depender de pacotes externos inseguros.

## Escopo

- Central Criativa aberta pela barra superior do editor.
- Biblioteca persistente por apresentação usando `ApresentacaoAsset` já existente.
- Upload de imagens, vídeos, áudios e modelos GLB/GLTF com validação de tipo e tamanho.
- Inserção direta da mídia compatível no slide ativo.
- Remoção local de fundo de imagens com tolerância ajustável e salvamento do PNG resultante.
- Criação e aplicação de Brand Kit usando `ApresentacaoTema` já existente.
- Logo do Brand Kit inserível no slide.
- Formatos de canvas 16:9, 4:3, quadrado e vertical, persistidos em `Slide.dadosJson`.
- Redimensionamento proporcional dos componentes ao trocar o formato.
- Exportação do slide ativo em PNG e JSON.

## Fora do escopo

- Importar ou executar `CanvaPro.zip` ou qualquer binário do repositório auditado.
- Redistribuir ativos premium de terceiros.
- Remoção de fundo baseada em serviço externo pago.
- Alteração de estrutura ou migration do banco.

## Critérios de aceite

- [x] **AC-001 — Upload seguro:** somente tipos permitidos e limites definidos são aceitos; usuário sem acesso à apresentação recebe 403.
- [x] **AC-002 — Biblioteca persistente:** os assets existentes carregam junto com o editor, podem ser pesquisados, filtrados e excluídos.
- [x] **AC-003 — Inserção:** imagem, vídeo, áudio e modelo 3D entram no centro do slide como componentes editáveis.
- [x] **AC-004 — Fundo transparente:** imagem processada localmente gera um novo PNG na biblioteca e pode ser adicionada ao slide.
- [x] **AC-005 — Brand Kit:** usuário cria tema com nome, cores e fontes, aplica imediatamente e pode inserir o logo selecionado.
- [x] **AC-006 — Magic Resize:** a troca de formato atualiza o canvas e redimensiona/reposiciona componentes proporcionalmente sem dimensões inválidas.
- [x] **AC-007 — Player responsivo:** o modo apresentação enquadra slides com qualquer formato suportado sem corte.
- [x] **AC-008 — Exportação:** PNG em alta resolução e JSON versionado são baixados pelo navegador.
- [x] **AC-009 — Acessibilidade:** modal fecha com Escape, controles têm labels e estados de carregamento/erro/vazio.
- [x] **AC-010 — Qualidade:** lint, typecheck, testes direcionados e build executados.

## Notas técnicas

- `RenderComponente` permanece a fonte única de renderização.
- `Slide.dadosJson` recebe `canvas` opcional; slides antigos continuam com fallback 1280×720.
- O upload usa `@vercel/blob` já instalado e o modelo `ApresentacaoAsset` já existente.
- Exportação PNG usa `html-to-image` (MIT, sem dependências transitivas na versão auditada).
- Nenhuma alteração de schema Prisma é necessária.

## Checklist de implementação

- [x] Contratos Zod de assets e canvas.
- [x] API de upload e Server Action de exclusão.
- [x] Central Criativa e painéis especializados.
- [x] Componente de áudio.
- [x] Persistência e apresentação de formatos variáveis.
- [x] Exportação PNG/JSON.
- [x] Testes de helpers e validações.
- [x] Quality gates.

## Evidências de qualidade

- ESLint direcionado aos arquivos do módulo: aprovado sem avisos.
- TypeScript direcionado aos arquivos do módulo: aprovado.
- Testes de apresentações: 23/23 aprovados.
- Suíte completa: 616/617 testes aprovados; o único timeout em Google Calendar foi reexecutado isoladamente e aprovou 2/2.
- `next build`: aprovado, incluindo a rota `/api/apresentacoes/assets`.
- Os comandos globais de lint e typecheck também foram iniciados, mas excederam cinco minutos sem emitir diagnóstico; a validação direcionada cobriu integralmente os arquivos desta story.
- O `npm run build` completo encontrou `EPERM` no binário Prisma mantido aberto pelo servidor de desenvolvimento existente; a compilação Next executada separadamente foi concluída com sucesso.
- A inspeção interativa em navegador não foi executada porque nenhuma sessão de navegador estava disponível no ambiente.
- Correção visual posterior: modal convertido em workspace quase fullscreen, com cabeçalho compacto, fechamento explícito, abas com rolagem horizontal e áreas internas roláveis sem corte.

## File list

- `package.json`
- `package-lock.json`
- `src/actions/apresentacao-assets.ts`
- `src/actions/slides.ts`
- `src/app/api/apresentacoes/assets/route.ts`
- `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx`
- `src/app/PainelAlpha/Apresentacoes/[id]/apresentar/page.tsx`
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx`
- `src/components/Apresentacoes/Editor/BarraSuperior/BarraSuperiorEditor.tsx`
- `src/components/Apresentacoes/Editor/Canvas/CanvasArea.tsx`
- `src/components/Apresentacoes/Editor/CentralCriativa/BibliotecaAssets.tsx`
- `src/components/Apresentacoes/Editor/CentralCriativa/BrandKitPanel.tsx`
- `src/components/Apresentacoes/Editor/CentralCriativa/CentralCriativaModal.tsx`
- `src/components/Apresentacoes/Editor/CentralCriativa/ResizeExportPanel.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/PainelPropriedades.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/AudioProps.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/SlidePortalPreview.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/render/RenderBasicos.tsx`
- `src/components/Apresentacoes/Editor/SidebarEsquerda/SidebarSlides.tsx`
- `src/components/Apresentacoes/Editor/registry/registry-basicos.ts`
- `src/components/Apresentacoes/Editor/store/useEditorStore.ts`
- `src/components/Apresentacoes/ModoApresentacao/ModoApresentacaoClient.tsx`
- `src/components/Apresentacoes/ModoApresentacao/SlideApresentacaoLayer.tsx`
- `src/lib/apresentacoes/assets.ts`
- `src/lib/apresentacoes/canvas.ts`
- `src/lib/apresentacoes/exportacao.ts`
- `src/lib/apresentacoes/remover-fundo.ts`
- `src/lib/apresentacoes/viewport.ts`
- `src/lib/validations/slide-componentes-basicos.ts`
- `src/lib/validations/slide-componentes.ts`
- `tests/apresentacoes/central-criativa.test.ts`
- `.bibble/memory/components.md`
