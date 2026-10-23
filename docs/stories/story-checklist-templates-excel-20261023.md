# Story — Templates documentais dos Excel Checklist (2026-10-23)

## Status

**Ready for Review** — código, Forge/Probe/Anubis/Lens/Sage e documentação aprovados; publicação staging em execução. Dados59 continuam DataPending por backup/ponte/consentimento específicos. Código, fixtures, gates e deploy do patch independente em staging podem prosseguir; aplicação final **DataPending** por prévia dos existentes e acesso/gates de dados aplicáveis. A02 resolvida pelo usuário em 2026-10-23: Identificação do Mutuante = `2130`; `5140` permanece Guia IOF. Destino futuro: `docs/stories/story-checklist-templates-excel-20261023.md`, na worktree isolada que DevOps preparar.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["revisão de contrato", "testes causais", "Forge", "Probe", "Anubis", "Lens"]
```

Bibble coordena estações seriais; DevOps prepara worktree/publicação, Dev implementa e os revisores verificam seus domínios.

## Story

Como TI/Líder Operacional autorizado, quero criar no catálogo os documentos dos três conjuntos Excel fornecidos, preservando códigos reais, exigências e contexto, para novos checklists representarem fielmente a documentação solicitada.

Origem: pedido direto do usuário registrado em `/tmp/checklist-excel-20261023-orchestration.md#escopo-autorizado`; não foi fornecido epic novo com AC para copiar. Continuidade: catálogo versionado e snapshots da story `story-checklist-analistas-reformulacao-integracao-crm-20261022.md`; preservar seu formulário atual e seu guard de rascunho. Cada publicação cria/revisa uma identidade documental; os três conjuntos são escopos, não três contêineres JSON.

## Acceptance Criteria

1. Inventariar todos os três arquivos `.xlsx/.xltx` da pasta `Checklist/`, suas 25 abas e SHA256, preservando bytes originais. Preparar manifesto rastreável arquivo/aba/célula por documento, a partir do dataset Scout; não importar valores pessoais das abas auxiliares.
2. Representar as 59 linhas documentais codificadas em seus três escopos: DISPONIBILIDADE_FINANCEIRA (25), INICIO_RETOMADA (17), RECEITA_BRUTA_DAS (17). Não criar RECEITA_BRUTA_CPRB sem fonte. Abas FATOS E DIREITOS/CONFERÊNCIA/REVISÃO são espelhos/contexto; não multiplicar documentos só por reaparição.
3. Preservar código documental como texto original significativo em publicação, listagem, formulário, revisão e nova materialização; guardar proveniência literal no manifesto. Não converter para inteiro, renumerar, trocar pelo índice da coluna B nem exibir identificador técnico/sufixo inventado como código fiscal. A coluna C contém o código real. Para B=7/8, manter `4100 e\n4110 i` e a alternativa energia elétrica OU internet, sem acrescentar água.
4. Manter separadas as oito colisões legítimas de código: Disp. Financeira `4100 e\n4110 i`, `3140`, `3150`, `5160`; Início/Retomada `3540`, `3550`; DAS `3340`, `3350`. Contrato e recibos têm nomes distintos na mesma seção; `5160` aparece em Capacidade Financeira e Origem do Capital Social. Cada linha mantém requisito, seção, ordem e possibilidade própria de status; não fundir nem descartar as oito linhas adicionais.
5. Preservar nomes, descrições, condições de obrigatoriedade e alternativas das fontes em campos existentes apropriados, sem automatizar condições novas. IPTU: conservar exigência de ano corrente; divergência 2026/2023 registrada. DAS: registrar 1100/1500 entre abas, usando CHECK LIST como fonte principal candidata. Estados de exemplo OK/PRIORIDADE/Aguardando não viram estado do modelo; novas instâncias seguem PENDENTE canônico.
6. Registrar as seis ocorrências de instruções e-CAC/procuração eletrônica e DTE sem código, com sua instrução de não enviar documento. Não fabricar código documental nem criar exigência de upload. Anexar como ORIENTAÇÕES na descrição de Formulário e Petição / 1100 / VALIDAÇÃO de cada escopo, preservando o texto pertinente, sem criar cards/uploads ou motor de procedimentos.
7. A02 resolvida por confirmação explícita do usuário em 2026-10-23: Identificação do Mutuante usa `2130` de CHECK LIST!C39. Registrar a divergência com `5140` em FATOS E DIREITOS!B56; `5140` em CHECK LIST!C41 continua Guia IOF. Não propagar o código IOF à identificação nem alterar os demais códigos. Aplicação final e reconciliação das 59 continuam dependentes de prévia/plano/acesso/Vault e gates aplicáveis.
8. Aplicar o freeze Aria: codigoNormalizado guarda chave interna estável, chaveInterna opcional na publicação; revisão.codigo preserva código significativo. Listar/hidratar pela revisão e resolver aplicáveis por chave da identidade, preservando override legado; compatibilizar replay PUBLICAR antigo com o novo payload versionado. Preservar publicação transacional, revisão imutável, ordenação, desativação, CAS expectedRevision, mutationId/replay por ator+payload, auditoria e precedência de override GLOBAL/específico já existente. Não deixar a resolução aplicável colapsar requisitos distintos pelo código visível. Sem escrita SQL direta, DDL, migração, seed ou backfill nesta story; prévia somente leitura permitida.
9. Novos modelos/revisões afetam somente instâncias criadas depois. Catálogo anterior, itens, modelosSnapshot, revisões referenciadas, checklists concluídos, vínculos CRM e leituras staff/Portal anteriores permanecem intactos. Não chamar `criarModeloEmbasamento` antiga, que propaga retroativamente; não reaplicar catálogo em atendimento/tipo já materializado.
10. Publicar/criar efetivamente somente em staging, via sessão legítima TI/Líder Operacional pelas actions atuais, inclusive automação CLI que use essa sessão real. Manutenção CLI com ator administrativo próprio não é alternativa autorizada pelo freeze e exigiria desenho e avaliação específicos antes de ser considerada. Revalidar ator persistido, sessão, módulo e escopo antes de replay; negar Portal, perfis não gestores e sessão revogada. Não forjar sessão/cookie, impersonar staff, criar role, alterar auth/API de transporte ou implementar acesso paralelo.
11. Antes da execução de dados, obter classificação Vault do plano concreto de 59 publicações: CRUD normal ou lote/mutação de risco. Se política de lote se aplicar, apresentar ambiente/banco/comandos/impacto/riscos/alternativa/rollback e exigir relatório Vault, backup completo verificado com até 48h e consentimento específico. Conferir ambiente e banco efetivos usando `.env.staging.local`; não usar `.env.local` por presunção. Sem operação real até cumprir os gates aplicáveis.
12. Demonstrar em testes sintéticos e validação staging autenticada os cenários abaixo, reconciliar manifesto com os documentos publicados e registrar IDs/revisões/escopos sem segredos. Rodar lint, typecheck, npm test e build reais; atualizar checklist/File List e evidências antes de concluir. Produção depende de pedido explícito posterior e está fora desta entrega.

## Tasks / Subtasks

- [x] Scout inventariou três arquivos/25 abas/59 linhas/6 instruções; draft e checklist SM preparados (AC1–7).
- [x] Aria congelou contrato mínimo compatível e representação das instruções; freeze `/tmp/checklist-excel-20261023-architecture.md` incorporado (AC3–4,6,8).
- [x] PO validou GO para desenvolvimento (9/10); A02 resolvida em 2130; DataPending operacional não bloqueia o patch independente (AC3–10).
- [x] Em paralelo lógico ao preparo do patch, registrar decisão Mutuante 2130 já confirmada e obter prévia staging somente leitura dos existentes; fechar manifesto com proveniência e CREATE/REVISAR/NOOP por identidade, sem duplicar GLOBAL nem alterar modelos alheios (AC1–7,9–11).
- [x] DevOps preparar worktree isolada baseada no staging atual, preservando API/Portal/CRM e dirty alheio; portar esta story (AC8–12).
- [x] Dev implementar apenas patch autorizado pelo contrato Aria e testes causais; nenhuma alteração física de banco (AC3–10).
  - [x] Echo: código significativo/chave opcional, lista/hidratação/resolução por identidade e compatibilidade replay PUBLICAR legado/v2; preservar CAS/snapshots e ORDENAR/DESATIVAR.
  - [x] Echo: Admin autorizado explicitamente pelo usuário somente para gestão de modelos; testes preservam escrita por owner/líder e bloqueio Portal/outros papéis.
  - [x] Echo: manifesto privado 0600 com 59 payloads validados, 3 modelos alheios preservados e reconciliação projetada 62 identidades; nenhuma aplicação real.
  - [x] Nova: formulário/código composto/repetição intencional e testes de UI; textarea preserva código, chave deriva da intenção estável, edição preserva chave opcional e identidade, sem redesenho.
- [ ] Vault classificar execução concreta; preparar plano/backup/consentimento quando exigidos; garantir acesso legítimo (AC10–11).
- [ ] Forge executar gates; Probe/Anubis/Lens verificar integração, permissões e regressões; DevOps publicar patch primeiro em staging (AC8–12).
- [ ] Executar publicações autorizadas, reconciliar os três conjuntos e comprovar novas materializações/snapshots preservados em staging; atualizar File List/QA (AC1–12).

## Dev Notes / Project Structure Notes

Fonte runtime atual indicada pelo Scout: `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/portal-api-20261023`, HEAD de referência `a144…`; conferir staging corrente antes de portar. Raiz original possui alterações alheias e não é destino desta preparação. Nenhuma tecnologia nova é necessária. [Source: /tmp/checklist-excel-20261023-scout.md#contrato-atual-verificado-worktree-fonte]

O catálogo atual normaliza código e o iguala à chave da identidade; `modelosAplicaveis` agrupa pelo código, perdendo oito exigências. Persistência já separa PK técnica, `codigoNormalizado`, `ModeloItemChecklist.codigo` e `ItemChecklist.codigo` string; o freeze Aria usa esses campos sem DDL: chave técnica imutável separada do código significativo; agrupar pela chave preserva override e mantém requisitos distintos. Contrato normativo completo: `/tmp/checklist-excel-20261023-architecture.md`, seções 1–3. [Source: /tmp/checklist-excel-20261023-scout.md#alternativas-concretas-para-decisão-curta-da-aria; docs/architecture/checklist-analistas-crm-20261022.md#5-catálogo-e-snapshots]

Actions existentes `publicarModeloChecklist`/listar/desativar/ordenar usam ator real e transação; TI foi autorizado no adendo posterior, sem ganhar escrita geral de dossiês. `materializarTipo` copia revisão e mantém snapshot; não alterar leituras antigas por rejoin no catálogo. [Source: /tmp/checklist-excel-20261023-scout.md#contrato-atual-verificado-worktree-fonte; docs/stories/story-checklist-analistas-reformulacao-integracao-crm-20261022.md#probe--anubis-focal--gestão-de-modelos-por-ti22102026; docs/architecture/checklist-analistas-crm-20261022.md#4-contratos-de-comando-cas-e-idempotência]

`accumulated-context.md`, `.aiox/gotchas.json` e o índice/framework arquitetural padrão não foram encontrados na raiz/fonte consultadas. Não inventar seu conteúdo: usar scout/orquestração/contrato e histórico da story anterior para continuidade. Freeze desta entrega: `/tmp/checklist-excel-20261023-architecture.md`; implementação liberável após PO, execução final ainda DataPending. Conteúdo verificado cabe nos limites atuais: nome máximo 136, código 13, descrição com duas orientações 618 caracteres. [AUTO-DECISION] Novo epic/ClickUp → manter draft local isolada conforme missão; não inventar número de epic nem sincronizar serviço externo.

### Contrato mínimo executável do freeze

- Código: string trim de bordas, 1–80 caracteres; não normalizar conteúdo exibido. `chaveInterna?`: `[A-Z0-9_]{1,80}`; ausente no create mantém derivação legada e colisão antiga. Update por identidade preserva escopo/chave e exige chave igual se informada. Código lógico imutável por comparação normalizada com última revisão; representação significativa pode mudar e participa de no-op.
- Hidratação/lista/ordenação/desativação usam revisão.codigo; apenas identidade sem revisão admite fallback de chave na listagem. Resolução inclui identidade na mesma consulta e agrupa por sua chave: específico ativo prevalece sobre GLOBAL da mesma chave; ausência do específico ativo permite GLOBAL. Chaves distintas preservam requisitos distintos mesmo código/seção; não classificar legado por prefixo.
- PUBLICAR novo marca contrato interno v2 e inclui código significativo/chave opcional no hash. Replay legado só aceita formato PUBLICAR antigo normalizado, mesmo ator/conta/mutationId, nunca fallback de evento marcado v2. ORDENAR/DESATIVAR mantêm intenção original; autorização é revalidada antes de qualquer replay. CAS/transação/revisão/evento/auditoria permanecem canônicos.
- Formulário: textarea curta para código composto e checkbox discreto de repetição intencional no create. Repetição gera chave `REQ_` + UUID sem hífens uppercase derivada da mutationId estável; retry conserva intenção/chave/draft. Chave técnica não aparece como código fiscal. Manter labels, teclado, foco, layout, rascunho e capabilities existentes.
- Manifesto privado 0600 preserva fonte/célula/literal, conteúdo, condição, identidade/chave/revisão/CAS, mutationId e resultado. Para CREATE realmente novo, candidato `SRC_` + SHA256 uppercase do JSON canônico `[sha256Arquivo, nomeAbaExato, numeroLinha]`; prévia pode mapear identidade existente. Fonte alterada exige nova prévia. Nenhuma chave nova para retry incerto.
- Reconciliação usa CREATE/REVISAR/NOOP por conteúdo/contexto, catálogo paginado e GLOBAL; não presumir 59 CREATE nem contar catálogo bruto como prova. Nenhum modelo alheio deve ser modificado. Limites finais: nome 180, código 80, descrição 1000; descrição 1100 com duas orientações medida em 618, falhar se exceder, nunca truncar.
- Rollback de código: versão staging anterior preparada por DevOps. Rollback de dados exige plano específico (desativação nova/republicação anterior preservando histórico), classificação Vault aplicável e autorização correspondente; nunca restore indiscriminado sobre trabalho concorrente. A02 foi resolvida pelo usuário em 2130 em 2026-10-23; a divergência permanece registrada como proveniência.

## Testing

- Backend com persistência sintética: publicar/materializar composto preservado; dois requisitos mesmo código/mesma seção; 5160 em seções distintas; selecionar escopo exato e nenhuma criação CPRB; cada requisito presente uma única vez.
- Compatibilidade: override GLOBAL/específico legado por chave, revisão sem mudar identidade, CAS concorrente, replay PUBLICAR legado normalizado e novo versionado, ORDENAR/DESATIVAR após revisão posterior, mutationId com payload/ator/conta divergente rejeitado, permissão revogada antes de replay e auditoria transacional. Chave omitida mantém colisão antiga; distinta permite repetição intencional.
- Regressão temporal: comparar itens e modelosSnapshot anteriores byte/valor a valor; repetir seleção empresa+tipo não reaplica catálogo; staff/Portal mostram mesmo código e conteúdo antigos. Dados exclusivamente sintéticos nos testes.
- UI real existente: código significativo exibido no card/formulário, repetidos distinguíveis pelos nomes/contextos, erro conserva draft e mutationId, pending impede duplicação; consulta sem gestão e Portal sem publicação. Nenhuma nova UI além do ajuste indispensável ao contrato.
- Forge: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; evidências atuais, sem reutilizar PASS anteriores como resultado desta implementação. Deploy remoto do patch em staging após gates de código e revisão; Prévia/acesso/Vault são gates da aplicação final de dados, sem bloquear o deploy independente.

## 🤖 CodeRabbit Integration

Story Type Analysis: Architecture/API; secundários Frontend/Security; complexidade média, contrato transversal pequeno. Specialized Agents: primários @dev e @architect; suporte @ux-expert (formulário), @qa, @github-devops; Vault só classificação/gate de dados.

- [ ] Pre-Commit (@dev): `coderabbit --prompt-only -t uncommitted`, foco código textual/identidades, CAS/replay/snapshots e ACL.
- [ ] Pre-PR (@github-devops): revisão contra base staging real, foco compatibilidade e preservação de entregas concorrentes. Pre-Deployment de produção: N/A.

Self-Healing Configuration: @dev light, até 2 iterações/15 minutos, CRITICAL auto_fix; HIGH document_only; MEDIUM/LOW ignorados conforme task. Indisponibilidade do CLI deve ser registrada conforme core-config; não alegar revisão executada. Focus Areas: não colapsar linhas por código, override compatível, autorização antes de replay, UI sem perda de draft e nenhum efeito retroativo.

## File List

Atual documental: `/tmp/checklist-excel-20261023-po.md`, `/tmp/checklist-excel-20261023-story.md`, `/tmp/checklist-excel-20261023-sm.md`, `/tmp/checklist-excel-20261023-architecture.md`, `/tmp/checklist-excel-20261023-aria.md` (fora Git).
Planejada conforme freeze Aria: story destino; `src/lib/checklist/schemas.ts`; `src/lib/checklist/catalogo.ts`; `src/components/checklist/ModelosDocumentoForm.tsx`; `src/components/checklist/ModelosWorkspace.tsx`; testes pertinentes em `tests/checklist-analistas/backend.service.test.ts`, `catalogo-replay.test.ts` e `tests/operacional/checklist-modelos-frontend.test.tsx`. `src/actions/checklist-modelos.ts`/`service.ts` são integração a conferir, alterar só se necessário pelo contrato; Prisma schema/auth/Portal não previstos para edição.

### File List — backend efetivamente alterado (Echo)

- `src/lib/checklist/schemas.ts`
- `src/lib/checklist/catalogo.ts`
- `src/lib/checklist/acesso.ts`
- `tests/checklist-analistas/catalogo-identidades.test.ts` (novo)
- `tests/checklist-analistas/catalogo-replay.test.ts`
- `tests/checklist-analistas/backend.service.test.ts`
- `tests/portal-api/http-integration.test.ts` (somente tipagem de tupla HTTP, erro preexistente do Main)
- `docs/architecture/checklist-templates-excel-20261023.md` (autorização Admin/evidência de preparação)
- `docs/stories/story-checklist-templates-excel-20261023.md`

### File List — frontend efetivamente alterado (Nova)

- `src/components/checklist/ModelosDocumentoForm.tsx` (textarea curta, ajuda acessível e repetição intencional só no create; chave original opcional na edição)
- `src/components/checklist/ModelosWorkspace.tsx` (quebras de linha visíveis no código e texto de gestores inclui Admin)
- `tests/operacional/checklist-modelos-frontend.test.tsx` (10 cenários sintéticos, sem dados reais das fontes)
- `docs/stories/story-checklist-templates-excel-20261023.md`

## Dev Agent Record

### Agent Model Used

Echo/Nova — GPT-6 (sessão Codex; sem override de modelo). Backend e frontend implementados; gates globais e execução remota ainda pendentes.

### Debug Log References

Evidência PO: `/tmp/checklist-excel-20261023-po.md`. Backend: `/tmp/checklist-excel-20261023-echo.md` e `.json`; logs `/tmp/checklist-excel-20261023-echo-tests-final3.log`, `echo-typecheck-final2.log`, `echo-lint-final2.log` e `echo-manifest.log` (mesmo prefixo). Dados privados ficam somente em `/tmp`, sem versionamento.

Frontend: `/tmp/checklist-excel-20261023-nova.md` e `.json`; logs `nova-tests-final2.log`, `nova-typecheck-final2.log` e `nova-lint-final2.log` (prefixo `/tmp/checklist-excel-20261023-`). Todos executados via wrapper sanitizado, com ambiente local sintético.

### Completion Notes List

Backend implementado e testes focais executados em SQLite sintético. Usuário autorizou Admin somente na gestão dos modelos. Prévia privada fechou 59 CREATE e preservação dos três modelos existentes; aplicação real ainda pendente de gates/deploy/acesso legítimo/Vault. Nenhuma alteração física de banco, snapshot antigo, endpoint ou autenticação. Correção adicional apenas de tipo no teste HTTP Main preexistente: flatMap tipado como tupla para HeadersInit; wire e asserções intactos. O pré-requisito gerado do player foi reconstruído pelo script oficial, sem versionar artefato.

Nova: formulário azul inline em duas colunas e quatro cards preservados; código textual conserva letras, separadores e quebras. Checkbox discreto cria `chaveInterna` derivada da mesma mutationId apenas para repetição intencional; padrão continua sem chave e edição conserva chave persistida/ausente. Erros mantêm draft e intenção, pending bloqueia submissão duplicada, sucesso/descarte restaura formulário. Nenhum novo componente, dependência ou alteração de API/Portal/auth. Fallback legado para identidade sem revisão permanece conforme freeze; prévia staging contém zero casos e publicação transacional não cria órfãos.

## QA Results

Echo: 47/47 testes focais passaram (8 identidades/códigos, 13 replay, 23 backend e 3 HTTP Main); typecheck global do worktree exit 0, lint focal exit 0 sem avisos e 59 payloads privados validados por Zod. Gates globais lint/test/build e revisão QA ainda pendentes para Forge após Nova. O GO PO é prontidão da story, não aprovação QA do produto nem autorização final de importação. Relatórios históricos: `/tmp/checklist-excel-20261023-sm.md` e `/tmp/checklist-excel-20261023-aria.md`.

Nova: 10/10 testes frontend passaram; typecheck global e lint focal exit 0, sem avisos. Cobertura causal de código composto sintético, repetidos na mesma seção com nomes distintos, identidade/chave original em edição, omissão legada, chave derivada de mutationId estável após CONFLICT/VALIDATION/FORBIDDEN, novo ID após sucesso, bloqueio de envio duplicado/pending, guard/descarte e consulta sem gestão. Capacidade Admin permanece comprovada pelos testes de backend Echo; frontend usa a mesma capability booleana. Sem validação visual em navegador ou aplicação remota nesta estação; Forge e QA subsequentes permanecem obrigatórios.

## Change Log

| Data | Versão | Mudança | Autor |
| --- | --- | --- | --- |
| 2026-10-23 | 0.1.0 | Draft isolada baseada no Scout e pedido; sem decisões arquiteturais antecipadas | River/SM |
| 2026-10-23 | 0.2.0 | Freeze Aria sem DDL, instruções na descrição 1100, prévia dos existentes e separação código pronto / dados A02 pendentes | Aria |
| 2026-10-23 | 0.2.1 | Validated GO (9/10) — estágio pré-PO ReadyForPO normalizado a Draft; Draft → Ready para código; DataPending preservado. Metadata, gates e alternativa CLI esclarecidos | Pax/PO |
| 2026-10-23 | 0.2.2 | Usuário confirmou explicitamente Mutuante 2130 (A02 resolvida); 5140 continua Guia IOF. DataPending restrito a prévia/plano/acesso/Vault/gates | Pax/PO |
| 2026-10-23 | 0.3.0 | Backend literal/chave/replay e Admin só modelos; 47 testes focais, typecheck e lint focal aprovados; manifesto privado 59 CREATE + 3 preservados, sem aplicação real | Echo |
| 2026-10-23 | 0.3.1 | UI conserva código composto e permite repetição intencional com intenção estável; 10 testes frontend, typecheck e lint focal aprovados, sem aplicação remota | Nova |

## Autorização explícita adicional do usuário — 2026-10-23

“Liberar Admin para gerenciar os templates também”: Admin passa a gestor de modelos junto de TI/Líder Operacional. Não ampliar escrita em dossiês/empresas/itens, criação/atribuição ou poderes do Portal; revalidar cadastro e sessão antes de replay. A prévia e os gates de dados permanecem obrigatórios.


## Forge QA — gates reais do patch, 23/10/2026

- [x] Quatro MAINgates reais, uma vez cada: typecheck9,18s/exit0; lint46,42s/exit0(0erros1184warnings); npmtest fullcoverage46,15s/exit0(**761arquivos6327PASS+4skip1todo=6332**); build234,14s/exit0(Prisma/player/webpack). Integridade API `generate-contract.mjs --check`0,02s/exit0. Identidades8/replay13/frontend10/HTTP3PASS no fullrun; nenhum gate substituído por foco antigo.
- [x] Fingerprint scoped24arquivos `7d8abac36a822675a67b5dd54af548f21c12014ead808f4ce8fb4cbfaeebf27f` antes/depois idêntico, incluindo testeUNTRACKED e consumidores runtime/API/Prisma/pkg/config. Schema c3c82…/Prisma6.19.3 preservados; wrapper exclusivoNOVOWT/SQLitefake/buildstagingHTTPS*.invalid/TMPDIR/.nextRAM corretos. Sem sourcefix, tolerância/timeouts/cobertura/config/envreal/Gitmutável alterados ou gate repetido.
- [ ] Probe/Anubis/Lens/Sage e publicação/validação do código somente staging seguem com owners seguintes. Importação59 continua DataPending: VaultBACKUP_NOT_READY/consentimento específico pendentes; nenhum dado real aplicado por estes gates.

**APROVADO Forge local para próximos revisores.** Relatório `/tmp/checklist-excel-20261023-forge.md`; cwd/argv/exits/hashes/resultados `/tmp/checklist-excel-20261023-forge.json`; logs `/tmp/checklist-excel-20261023-forge-{typecheck,lint,test,build,contract}.log`+metadata. File List Forge: somente esta story por appendQA/checklist/FileList; fontes/freezearch/oldWTs/rootdirty/.nextRAM preservados. Nenhum Portal/backup/SQLreal/importação/DB/cloud/deploy/produção; controle ao Bibble, nenhum próximo agente acionado.


### QA — Probe local (2026-10-23)

- [x] Blueprint Scout e integração local conferidos após Forge; cinco fontes runtime conectadas às rotas/capability existentes, sem novo módulo/atalho.
- [x] Dois testes temporários reais PASS: manifesto59/proveniênciaC/25+17+17/oito repetições/seis orientações e Server Actions Admin persistido → SQLite canônico → seleção owner → materialização de dois requisitos compostos → leitura staff/Portal + Zod/JSON wire. Rejeições sem sessão/inativo/não gestor e Admin não owner preservadas; snapshot anterior intacto.
- [x] Adotados47Echo/10Nova na suíte Forge atual; nenhum gate global/build repetido. UI por happy-dom e inspeção; não houve browser/login/HTTP remoto. Auth foi mockado somente com user.id sintético; domínio/ACL/DB/transações/projeções reais locais. Harness removido do Git tree, arquivo privado /tmp.
- [x] 24 fontes antes/depois iguais ao Forge (fingerprint7d8abac36a822675a67b5dd54af548f21c12014ead808f4ce8fb4cbfaeebf27f);17 consumidores canônicos byte-idênticos ao HEAD; manifesto243a9d84... e três Excel SHA256 intactos. Dois erros iniciais apenas no harness de conferência foram corrigidos sem fonte.
- [ ] Homologação autenticada/READY em staging e reconciliação IDs/revisões59 permanecem pendentes; DataPending/Vault/consentimento específico não resolvidos por Probe.

Veredicto: **integração local APROVADA**, sem finding causal; controle ao Bibble para demais revisões. Evidências /tmp/checklist-excel-20261023-probe.md e .json, execução /tmp/checklist-excel-20261023-probe-local-actions-final2.log (2/2PASS, exit0,1,26s). Depois da futura importação SRC/REQ, rollback para código antigo exige compatibilidade: se rollback de dados for autorizado, desativar somente IDs59 com código novo/CAS, preservar os3 antigos/snapshots, depois reverter código compatível. Nada remoto executado.

File List — Probe: somente `docs/stories/story-checklist-templates-excel-20261023.md` (appendQA/checklist/FileList); nenhum teste permanente/fonte runtime alterado.


### QA — Anubis focal local (2026-10-23)

- [x] Cinco fontes runtime e consumidores essenciais revisados por source→guard→sink: actor/session persistidos, Admin somente modelos, Zod/chave/identidade/escopo/CAS, replayv2/legado/ator+hash, React/DTO/ZIP/headers. Zero vulnerabilidades críticas/importantes confirmadas.
- [x] Config e código CSRF do Next instalado conferidos; não há allowlist ampliada. Sem novo HTML bruto/SQL bruto/exec/URL de código ou segredo no cliente/log. Escopo/módulo/owner/líder não foram ampliados fora dos modelos.
- [x] Provas Forge/Echo/Nova/Probe adotadas na mesma fonte; nenhum gate repetido/PoC sem candidato.24 hashes iguais antes/depois ao Forge7d8abac36a822675a67b5dd54af548f21c12014ead808f4ce8fb4cbfaeebf27f;17 consumidores Probe+7auxiliares byte-idênticos ao HEAD.
- [ ] Homologação autenticada/staging e dados59 permanecem pendentes; securityPASSlocal não autoriza lote, backup ou jobs.

Veredicto Anubis: **APROVADO local focal,0críticos/0importantes confirmados**; não representa auditoria completa do repositório nem teste HTTP/browser/proxy remoto. Relatórios /tmp/checklist-excel-20261023-anubis.md e .json. Controle ao Bibble; File List Anubis somente esta story (appendQA/checklist/FileList), nenhuma fonte runtime/teste alterada.


### QA — Lens focal local (2026-10-23)

- [x] Forge aprovado adotado; revisão focal de código/chave, lista/hidratação, resolução GLOBAL/específico, replay legado/v2, CAS/auditoria, no-op, snapshots, permissões e UI/draft/pending/intenção estável concluída: **0 bloqueantes/0 importantes/0 sugestões confirmadas**.
- [x] Adotados gates Forge atuais (761 arquivos/6327PASS+4skip1todo),47Echo/10frontend,Probe2/2 e Anubis; nenhum gate/browser/PoC repetido sem causa.24 fontes antes/depois iguais ao Forge7d8abac36a822675a67b5dd54af548f21c12014ead808f4ce8fb4cbfaeebf27f.
- [x] CodeRabbit ausente do PATH: SKIPPED conforme core-config graceful_degradation.skip_if_not_installed=true; não se afirma revisão automatizada PASS.
- [ ] Homologação autenticada/publicação staging e dados59 continuam pendentes; revisão local não encerra AC12 nem Vault/backup/consentimento específico.

Veredicto Lens: **APROVADO local focal**. Evidência de arquivos/linhas, limites e hashes em `/tmp/checklist-excel-20261023-lens.md` e `.json`. Após futura importação SRC/REQ, rollback de dados autorizado deve desativar somente os novos59 IDs via código novo/CAS preservando antigos3/instâncias antes de reverter para versão compatível. Nada remoto executado. Controle ao Bibble; nenhuma próxima estação acionada.

File List — Lens: somente esta story (appendQA/checklist/File List); relatórios privados em /tmp; nenhuma fonte runtime/teste/freezearch/env/DB/Git mutável alterada.


### QA — Sage cobertura local (2026-10-23)

- [x] Cobertura de caminho feliz/falhas/limites/ownership e concorrência conferida: composto/repetidos, códigos5160 por contexto, no-op/representação/chave imutável, override GLOBAL/fallback, replayv1/v2/ator/conta/hash, sessão/status/módulo antes de replay, CAS/rollback e snapshots anteriores; UI mantém draft/pending/retry/intenção estável. Nenhuma lacuna concreta bloqueante identificada.
- [x] Adotados resultados reais Forge atuais: cinco checks exit0,761 arquivos/6327PASS+4skip1todo;47Echo+10frontend incluídos. Probe2/2 exit0/1,26s pelas actions/SQLite/DTO reais locais.24 fontes iguais antes/depois ao Forge7d8abac36a822675a67b5dd54af548f21c12014ead808f4ce8fb4cbfaeebf27f. Nenhum teste novo/repetido por Sage; CodeRabbit SKIPPED conforme política, sem alegar PASS.
- [ ] Login/browser/HTTP staging/homologação e importação/reconciliação real dos59 permanecem pendentes; backup/job dry-run/consentimento específico seguem com owners operacionais. Não marcar READY remoto/Done integral.

Veredicto Sage: **APROVADA cobertura local do patch**. Limites explícitos: erros UI/falhas de persistência sintéticos; sem simulação nova de indisponibilidade real de rede ou teste dedicado de toda permutação null/undefined. Evidências `/tmp/checklist-excel-20261023-sage.md` e `.json`; controle devolvido ao Bibble, nenhuma próxima estação acionada.

File List — Sage: somente esta story por appendQA/checklist/File List; relatórios privados em /tmp; nenhuma fonte runtime/teste permanente/env/DB/cloud alterada.


### Scribe — memória e estado de entrega (2026-10-23)

- [x] Mapa e integrações atualizados por append: código literal/chave estável, override GLOBAL, replay v2/legado, Admin restrito a modelos e UI com intenção estável documentados; sem reescrever histórico.
- [x] Gates locais Forge e revisões Probe/Anubis/Lens/Sage concluídos conforme relatórios desta story: 761 arquivos/6.327 PASS, quatro skipped/um todo; CodeRabbit SKIPPED conforme política. Scribe não repetiu gates nem alterou fonte/testes.
- [ ] Publicar e homologar código em staging; depois cumprir Vault/backup completo verificado <=48h/consentimento específico para o lote59 e reconciliar fontes→IDs/revisões. Nenhuma importação executada; `BACKUP_NOT_READY` permanece. Não declarar READY remoto/Done integral.

File List — Scribe: `.bibble/memory/codebase-map.md`, `.bibble/memory/integration-points.md` e esta story (append de checklist/QA/File List). Relatório privado `/tmp/checklist-excel-20261023-scribe.md`; nenhum Excel/manifesto privado/credencial versionado. Controle devolvido ao Bibble.


### Kowalski — consolidação do checkpoint local (2026-10-23)

- [x] Journal recebeu entrada curta com contexto, duas decisões centrais (código/chave e Admin granular), gates locais e pendências operacionais; draft e históricos alheios preservados.
- [ ] Publicação/homologação staging e lote59 continuam pendentes: backup completo válido, job/dry-run, Vault e consentimento específico ainda exigidos; nenhum READY remoto/importação concluída declarado.

File List — Kowalski: `.bibble/memory/journal.md` e esta story (append de checklist/File List). Relatório privado `/tmp/checklist-excel-20261023-kowalski.md`; sem fontes/testes/env/DB/Git/cloud alterados. Controle ao Bibble.


### DevOps — preparação da publicação (23/10/2026)

Gates finais atuais adotados, sem repetição global;24fontes idênticas ao Forge. Código-only staging: preservar avanços CRM por merge normal e publicar antes da homologação Admin. Nenhuma das59criações está autorizada nesta fase. CodeRabbit ausente, fallback Lens conforme configuração.
