# Story — Desempenho da navegação autenticada do Painel Alpha

## Status

In Progress

## Story

Como usuário autenticado, quero abrir o Painel Alpha e seus módulos com menor espera, preservando a visualização, as abas em iframe e todas as regras atuais de acesso.

## Contexto

O layout global chama `auth()`; o layout de `/PainelAlpha` chama `auth()`, permissões, dados do usuário e links externos; a home repete `auth()`, permissões e leitura do usuário antes de carregar sessões Bibble. A validação do token também consulta o banco. Essas chamadas são pontos a medir, não ganhos presumidos. A story existente `story-painel-modo-embedded-handshake-abas.md` define o comportamento das iframes e deve permanecer válida.

## Acceptance Criteria

1. Existe baseline reproduzível em stage e produção para uma navegação autenticada representativa: duração total, tempo de servidor, consultas de banco por tipo e duração, além de carregamento da home e de ao menos um módulo. As medições não registram tokens, dados pessoais ou conteúdo das consultas.
2. Leituras comprovadamente repetidas na mesma navegação são reduzidas ou compartilhadas sem usar cache global de sessão, usuário ou permissões. A validação de status e versão da sessão continua efetiva em toda requisição que a exige.
3. O antes/depois mostra redução mensurável de tempo ou consultas no stage e ausência de regressão material na produção, usando o mesmo cenário, usuário de teste e método de medição. Se uma hipótese não gerar ganho, o resultado é documentado sem alteração desnecessária.
4. A quantidade e o comportamento das iframes, persistência e troca de abas, handshake embedded, aparência visual, textos, rotas e funcionalidades permanecem iguais.
5. Usuário sem sessão, inativo ou sem permissão continua bloqueado conforme as regras atuais; nenhum cache reutiliza dados entre usuários ou mantém permissão revogada após nova requisição.
6. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados; testes focados verificam o compartilhamento de leituras e os cenários de acesso afetados.
7. Não há mudança de schema, migration, seed, backfill, infraestrutura, deploy ou configuração de produção nesta story.

## Tasks / Checklist

- [ ] Instrumentar e registrar baseline autenticado em stage e produção, identificando as consultas duplicadas.
- [x] Compartilhar leituras de status da sessão e permissões apenas na renderização da requisição; buscar sessões Bibble em paralelo com os demais dados da home.
- [ ] Conferir visualização e regras em login, home, abertura e troca de abas, módulo permitido e acesso negado.
- [ ] Comparar métricas antes/depois e executar testes focados e quatro quality gates.
- [ ] Atualizar esta checklist, File List e evidências antes de concluir.

## File List inicial

- `docs/stories/story-painel-alpha-desempenho-navegacao-autenticada.md`
- `src/app/layout.tsx` — ponto de análise
- `src/app/PainelAlpha/layout.tsx` — ponto de análise
- `src/app/PainelAlpha/page.tsx` — ponto de análise
- `src/lib/auth/acesso-painel.ts` — ponto de análise
- `src/lib/permissions/effective.ts` — leitura de permissões compartilhada por renderização
- `src/actions/PermissoesSetor.ts` — ponto de análise
- `src/actions/LinksExternos.ts` — ponto de análise
- Testes focados: definir após localizar a duplicação real.

## Registro

- 2026-09-23: story criada; código e ambientes ainda não alterados.
- 2026-09-23: medições públicas realizadas sem sessão. A navegação autenticada ainda requer conta de teste ou trace fornecido pelo operador; não há comparação antes/depois autenticada neste registro.
- 2026-09-23: leituras de status e permissões passam a usar `React.cache`, restrito à renderização de uma requisição. A home inicia sessões Bibble junto das demais leituras. Nenhuma regra, iframe ou elemento visual foi alterado.
- 2026-09-23: `npm run lint` passou com 0 erros (1192 avisos existentes); `npm run typecheck`, `npm test` (500 arquivos, 3766 aprovados) e `npm run build` passaram. A validação de desempenho e visual em sessão autenticada continua pendente; nenhuma release foi publicada.
