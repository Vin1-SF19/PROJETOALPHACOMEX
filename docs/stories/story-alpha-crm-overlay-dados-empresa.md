# Story: Gaveta consolidada de dados da empresa no Alpha CRM

## Status

Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, acessibilidade

## Story

**Como** usuário do pipeline do Alpha CRM,  
**quero** abrir uma gaveta com os dados consolidados da empresa diretamente ao lado do seu nome no card,  
**para** consultar cadastro, pessoas, contatos, responsáveis, CNAEs, regime tributário e RADAR sem sair do processo.

## Contexto e fontes de verdade

O card BPM aponta para `clientes` por `empresaId`. A visão deve consolidar somente dados já existentes nos módulos indicados pelo usuário:

- Pré‑Análise (`ConsultaPreAnalise.dadosBrutos`): cartão CNPJ/RFB, QSA, e-mail, telefone, CNAEs, regime e consulta RADAR;
- CS&NPS (`clientes` e `socios`): dados cadastrais, serviços, analista responsável, closer e contatos das pessoas;
- Radar Fiscal (`radar_fiscal`): fallback consolidado de CNAEs, regime e dados fiscais;
- Alpha CRM (`BpmCard.responsavel` e membros): responsáveis atuais pelo processo.

Não haverá schema, migration, mutação ou nova integração externa. [Source: `.bibble/memory/codebase-map.md#Database-Schema`] [Source: `.bibble/memory/integration-points.md#Alpha-BPM`] [Source: `src/app/PainelAlpha/SistemaPreAnalise/BlocoResultados.tsx`] [Source: `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`]

## Acceptance Criteria

1. Ao lado do nome da empresa existe um controle visível “Dados da empresa” com chevron que comunica o estado aberto/fechado.
2. O controle abre uma gaveta animada para baixo que substitui somente o painel esquerdo de “Passado/Histórico”, sem navegar para outra página.
3. Enquanto a gaveta está aberta, os painéis central e direito permanecem visíveis e montados.
4. A gaveta fecha por botão explícito e restaura o conteúdo de “Passado/Histórico”, incluindo a aba de serviço anteriormente selecionada.
5. A visão exibe, quando disponíveis: identificação cadastral, endereço, situação, porte, natureza jurídica, capital social, serviços e datas do relacionamento.
6. A visão consolida QSA do cartão CNPJ e pessoas do CS&NPS/vínculos BPM, removendo duplicidades e exibindo nome, função/vínculo, telefone, e-mail e observações existentes.
7. Telefones e e-mails da empresa e das pessoas são exibidos sem inventar valores ausentes.
8. Responsáveis pelo processo incluem analista/closer do CS&NPS, responsável e membros do card BPM e responsável registrado na Pré‑Análise, sem duplicidades idênticas.
9. CNAE principal e CNAEs secundários são exibidos com código, descrição e tipo.
10. Regime tributário exibe regime atual, regime Receita, Simples/MEI, datas e histórico quando existentes.
11. Dados do RADAR exibem situação, submodalidade, qualificação, PERSE/anexo, dívida tributária e data da consulta quando existentes.
12. Seções sem informação apresentam estado “Não informado”/“Não consultado”, sem quebrar o restante da visão.
13. A consulta exige sessão e acesso de visualização ao card antes de retornar qualquer dado consolidado.
14. A gaveta possui loading, erro com nova tentativa, rolagem interna e layout responsivo.
15. Nenhuma alteração de schema, migration ou mutação de dados é introduzida.
16. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados; falhas preexistentes ou ambientais são separadas das regressões da story.

## Blueprint de Integração

### Criar

- [x] `src/lib/bpm/dados-empresa.ts` — normalização tipada das fontes Pré‑Análise, CS&NPS, Radar e BPM.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaDrawer.tsx` — controle e gaveta que ocupa somente o painel esquerdo.
- [x] `tests/bpm/dados-empresa.test.ts` — regressões de consolidação/deduplicação.

### Editar

- [x] `src/actions/bpm/Empresas.ts` — action somente leitura protegida por ownership do card.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — substituir o chevron desabilitado pelo novo controle.

### Consultar

- `src/app/PainelAlpha/SistemaPreAnalise/BlocoResultados.tsx` — campos e prioridade visual da Pré‑Análise.
- `src/app/api/ReceitaFederal/route.ts` e `src/app/api/RadarFiscal/route.ts` — contratos de dados já normalizados.
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` — pessoas e responsáveis do CS&NPS.
- `src/lib/bpm/ownership.ts` — autorização de leitura do card.

### Integration points verificados e inalterados

- [x] Menu/registry: nenhuma entrada nova.
- [x] Rotas/middleware: nenhuma rota nova.
- [x] Permissões/auth: reutiliza ownership do card.
- [x] Atalhos/types globais: nenhuma alteração necessária.
- [x] Prisma/schema: nenhuma alteração.

## Tasks / Subtasks

- [x] Normalizar e deduplicar as quatro fontes de dados (AC: 5–12, 15)
- [x] Implementar action autenticada com selects explícitos (AC: 13, 15)
- [x] Implementar controle ao lado do nome e gaveta acessível no painel esquerdo (AC: 1–4, 14)
- [x] Implementar seções e estados vazios/erro/loading (AC: 5–12, 14)
- [x] Adicionar testes de normalização e ownership (AC: 6–13)
- [x] Executar gates e atualizar checklist/File List (AC: 16)

## Testing

- Vitest para normalização de payload `dadosBrutos`, fallback Radar Fiscal, deduplicação de pessoas/contatos/responsáveis e valores ausentes.
- Vitest da action para sessão e ownership do card.
- ESLint direcionado, typecheck e gates globais definidos no `AGENTS.md`.
- Verificação manual: abrir/fechar por mouse e teclado, confirmar a substituição exclusiva do painel esquerdo e rolar todas as seções em desktop/mobile.

## CodeRabbit Integration

- Tipo primário: Frontend; secundários: API e Integration; complexidade média.
- Agentes previstos: `@dev`, `@ux-expert`, `@qa`; `@github-devops` somente para PR.
- Pre-Commit: revisão uncommitted; Pre-PR: revisão contra `main` quando houver PR.
- Foco: autorização, exposição mínima de dados, parsing defensivo de JSON legado, acessibilidade/foco e responsividade.
- Self-healing Dev: light, até 2 iterações/15 min para CRITICAL; HIGH documentado.

## Story Draft Validation

| Category | Status | Issues |
|---|---|---|
| Goal & Context Clarity | PASS | Nenhum |
| Technical Implementation Guidance | PASS | Nenhum |
| Reference Effectiveness | PASS | Nenhum |
| Self-Containment Assessment | PASS | Nenhum |
| Testing Guidance | PASS | Nenhum |
| CodeRabbit Integration | PASS | Nenhum |

**Final Assessment:** READY — fontes e fallback definidos; nenhuma alteração de banco.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-07 | 1.0 | Story criada a partir do pedido e do reconhecimento de Pré‑Análise, CS&NPS, Radar e BPM. | River |
| 2026-08-07 | 1.1 | Interação corrigida de overlay global para gaveta restrita ao painel esquerdo de Passado/Histórico. | Dex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- ESLint direcionado aos arquivos da story: aprovado sem avisos.
- Vitest direcionado: 2 arquivos e 7 testes aprovados.
- Typecheck global: nenhuma falha nos arquivos da story; permanecem erros preexistentes em `ExclusaoFiscal/route`, `HabilitacaoRadarClient.tsx` e `tests/google-calendar/sync-queue.test.ts`.
- Teste global: 955/956 aprovados; permanece timeout preexistente em `tests/google-calendar/cli.test.ts`.
- Build global: bloqueado antes da compilação por `EPERM` do Prisma ao substituir `query_engine-windows.dll.node` em uso.

### Completion Notes List

- A interação foi corrigida de overlay global para gaveta animada dentro da primeira coluna.
- A gaveta substitui somente o histórico/serviço do painel esquerdo; registro e próxima etapa permanecem montados e visíveis.
- Ao fechar, a aba de histórico/serviço anteriormente ativa é restaurada.
- Os dados são carregados sob demanda e consolidados das fontes Pré‑Análise, CS&NPS, Radar Fiscal e BPM, sem alteração de banco.

### File List

- `docs/stories/story-alpha-crm-overlay-dados-empresa.md`
- `src/actions/bpm/Empresas.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaConteudo.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaDrawer.tsx`
- `src/lib/bpm/dados-empresa.ts`
- `tests/bpm/dados-empresa.test.ts`

## QA Results

- Gate direcionado aprovado. Gates globais mantêm apenas os bloqueios preexistentes/ambientais registrados acima.
