# Story: Recuperar o fluxo funcional e transformar a Mesclagem em módulo full-page

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `["eslint", "typescript", "vitest", "next-build", "runtime-check", "security-review"]`

## Story

**Como** usuário autorizado do módulo Mesclagem de Planilhas,
**quero** executar o fluxo completo diretamente na página do módulo, com seleção clara dos arquivos, mapeamento automático revisável antes da prévia e exportação fiel às minhas escolhas,
**para que** eu obtenha uma planilha final correta e previsível sem depender de uma experiência de modal ou de funções que aparentam operar, mas não alteram o resultado.

## Contexto e valor

Antes desta entrega, a rota `/PainelAlpha/Mesclagem` funcionava como uma apresentação que abria um segundo shell em overlay. O fluxo real ficava dentro de `ModalMesclagemPlanilhas`, renderizado com `fixed inset-0`, fundo escurecido e sem uso efetivo das props `open`/`onOpenChange`. Isso fazia a visão principal parecer um modal sobre a página e duplicava título, contexto e ações.

Havia também uma quebra de ordem no fluxo: a etapa **Mapeamento** recebia o catálogo vazio e o auto-mapeamento determinístico/IA só era executado ao preparar a prévia. A entrega moveu a sugestão para antes da revisão e eliminou a antiga sessão efêmera: prévia e processamento da exportação recebem novamente os dois arquivos, abas, colunas de CNPJ e o mapeamento efetivo. Assim, um override manual sempre participa de novo processamento e não pode reutilizar resultado anterior. Somente depois da exportação concluída o sistema registra um histórico durável e privado com as duas entradas e o resultado.

O contrato anterior de formatos também era incoerente: UI e validação anunciavam `.xlsx`, `.xls`, `.xlsm`, `.xlsb`, `.csv`, `.tsv` e `.ods`, mas havia parser real somente para `.xlsx`, `.xlsm`, `.csv` e `.tsv`. Além disso, o diagnóstico misturava CNPJ duplicado com inválido, embora a relação 1:N da complementar devesse ser preservada.

A melhoria deve ser cirúrgica: manter identidade visual, cards, stepper, painéis e componentes já considerados adequados; remover somente a arquitetura de landing page + overlay; reconectar o fluxo funcional existente; completar `DDD1`–`DDD5`; alinhar formatos, duplicidades e autorização. A planilha de evidência `mesclagem-planilhas-2026-09-14 - resultado.xlsx`, na raiz do projeto, continua sendo referência para validar cabeçalhos e exportação.

Por solicitação posterior do usuário, a rota inicial passou a ser o histórico das mesclagens concluídas. A criação da tabela `MesclagemHistorico` no Turso de produção e o armazenamento privado das três planilhas foram explicitamente autorizados após relatório Vault, backup completo e restauração de verificação.

## Coerência e precedência entre stories

- Esta story **substitui**, para a Mesclagem, a decisão da `story-mesclagem-modal-mapeamento-responsivo.md` de manter o fluxo dentro de modal. Permanecem válidos seus requisitos de responsividade, rolagem, acessibilidade e ações alcançáveis, agora aplicados ao módulo full-page.
- A implementação registrada em `story-mesclagem-mapeamento-automatico-llama-fallback.md` permanece como base técnica, mas só atende ao produto quando o resultado determinístico e o fallback local best-effort forem executados e exibidos na etapa **Mapeamento**, antes da prévia.
- Permanecem válidos desta story original: loading individual, `DDD1`–`DDD5`, exportação orientada por cabeçalho, preservação do template e validação com a planilha de evidência.
- Em conflito entre as três stories, esta revisão tem precedência para layout, ordem do fluxo, formatos anunciados, recálculo após override e autorização.

## Decisões autônomas

- `[AUTO-DECISION] Layout → Renderizar o workflow como conteúdo principal da própria rota, dentro do layout normal do Painel Alpha, removendo overlay, backdrop, semântica de dialog e estado de abrir/fechar. (reason: elimina a duplicação e atende ao pedido explícito)`
- `[AUTO-DECISION] Estilo → Reutilizar cards, stepper, badges, painéis e linguagem visual existentes, mantendo a estilização no próprio workspace/componentes. (reason: o usuário aprovou o estilo atual e pediu melhoria cirúrgica)`
- `[AUTO-DECISION] Momento do auto-mapeamento → Executar após os dois arquivos estarem inspecionados e a aba complementar estar definida, antes de a etapa Mapeamento ser apresentada como pronta. (reason: sugestões precisam ser visíveis e revisáveis antes da prévia)`
- `[AUTO-DECISION] IA → Manter fallback Llama/Qwen local, server-side, best-effort e não bloqueante; enviar somente destinos e nomes/índices de cabeçalhos. (reason: preserva a story anterior e não expõe conteúdo)`
- `[AUTO-DECISION] Override manual → Invalidar a prévia no cliente e reprocessar os arquivos com o mapeamento efetivo na próxima prévia/exportação. (reason: a seleção visual precisa ser a fonte do XLSX sem afinidade de instância)`
- `[AUTO-DECISION] Formatos → Anunciar e aceitar somente `.xlsx`, `.xlsm`, `.csv` e `.tsv` enquanto esses forem os parsers reais; `.xls`, `.xlsb` e `.ods` não aparecem como suportados. (reason: impedir promessa falsa sem ampliar dependências)`
- `[AUTO-DECISION] Duplicidades → Contabilizar válido, inválido, vazio e duplicado separadamente, preservando todas as linhas 1:N. (reason: repetição não torna CNPJ sintaticamente inválido)`
- `[AUTO-DECISION] Autorização → Alinhar páginas, registry e endpoints ao contrato do Painel: sessão autenticada, usuário ativo e acesso por papel administrativo ou permissão efetiva `mesclagemPlanilhas`. (reason: navegação, páginas e APIs precisam decidir igual)`
- `[AUTO-DECISION] Estado server-side → Não criar sessão intermediária: cada request é autenticada e validada independentemente; prévia e exportação reprocessam o payload atual. O histórico nasce apenas após exportação bem-sucedida. (reason: evita afinidade de instância sem perder rastreabilidade do resultado final)`
- `[USER-DECISION] Histórico → Persistir metadados no Turso e as planilhas principal, complementar e resultado no bucket privado QuObjects. Usuário comum acessa somente registros próprios; Admin, CEO e TI acessam todos. (reason: confirmação explícita do usuário em 2026-09-15 após protocolo Vault)`
- `[AUTO-DECISION] accumulated-context.md → Não existe no workspace; a coerência foi derivada das stories relacionadas e dos arquivos atuais. (reason: não inventar artefato ausente)`

## Critérios de Aceitação

1. `/PainelAlpha/Mesclagem` exibe diretamente o workflow como módulo full-page; não há overlay, backdrop, `role="dialog"`, `aria-modal`, botão **Iniciar mesclagem** ou segunda camada sobre uma landing page.
2. O módulo permanece no layout normal do Painel Alpha, ocupa sua área de conteúdo e preserva cores, cards, stepper, badges, tipografia e hierarquia visual atuais.
3. Em desktop e viewport reduzida, cabeçalho, mapeamento e ações ficam responsivos e alcançáveis, sem overflow horizontal nem aprisionamento de foco de modal.
4. Na etapa **Arquivos**, principal e complementar são controles inequívocos, operáveis por clique, arrastar/soltar e teclado, com foco visível, hover e texto de ação.
5. Cada arquivo possui loading independente; somente o controle correspondente mostra spinner/texto, e a seleção concorrente é impedida previsivelmente durante inspeção.
6. Sucesso, erro, retry e troca de arquivo removem loading, invalidam dados derivados obsoletos e não deixam etapa, mapeamento, prévia ou botão inconsistentes.
7. UI, `accept`, mensagens e backend apresentam a mesma lista realmente processável: `.xlsx`, `.xlsm`, `.csv` e `.tsv`; `.xls`, `.xlsb` e `.ods` não são anunciados nem aceitos sem parser real.
8. Após os arquivos serem inspecionados e as abas aplicáveis definidas, o sistema calcula o mapeamento determinístico por cabeçalhos/aliases antes de gerar a prévia.
9. Destinos sem match determinístico podem usar fallback local Llama/Qwen server-side, best-effort, com timeout e validação estrita; falha da IA mantém o campo vazio/editável e não bloqueia o fluxo.
10. O payload da IA contém apenas nomes dos destinos e nomes/índices dos cabeçalhos; não contém arquivos, linhas, valores, CNPJ, nomes, e-mails ou telefones.
11. Ao entrar em **Mapeamento**, sugestões já calculadas são visíveis com origem e indicação de automático; campos não resolvidos aparecem vazios e editáveis.
12. Trocar aba complementar ou arquivo recalcula somente campos sem override manual; resposta assíncrona antiga não sobrescreve a seleção mais recente.
13. O mapeamento inclui `DDD1`–`DDD5`, associados respectivamente a `FONE1`–`FONE5`, sem remover telefones, `FG_WHATSAPP1`–`FG_WHATSAPP5` ou demais destinos.
14. Cada DDD aceita coluna real da complementar e participa dos mesmos estados automático, manual e vazio.
15. Alterar manualmente um destino, inclusive para **Vazio**, invalida a prévia/resultado no cliente e o próximo processamento stateless usa o mapeamento atualizado.
16. Após override manual, a prévia e o próximo XLSX refletem exatamente o novo mapeamento; nenhum valor do mapeamento anterior permanece por cache ou mutação parcial.
17. Célula complementar mapeada vazia usa a coluna equivalente da principal conforme a regra atual; escolher **Vazio** manualmente não reativa auto-mapeamento.
18. A exportação resolve cada destino pelo cabeçalho, com normalização inequívoca documentada, sem fallback por posição, ordem do objeto ou índice presumido.
19. Cabeçalho existente é reutilizado; destino ausente, inclusive DDDs, é acrescentado deterministicamente sem sobrescrever cabeçalhos, estilos ou dados.
20. A ordem das colunas de qualquer entrada/template pode variar sem deslocar valores. A evidência XLSX valida os 26 cabeçalhos existentes, DDDs e preservação de linhas.
21. CNPJs válidos repetidos contam em **duplicados**, não **inválidos**; inválidos e vazios mantêm contagens próprias e exemplos inválidos não incluem duplicados válidos.
22. Um CNPJ da principal com N correspondências válidas na complementar preserva N linhas; repetição na principal também é processada deterministicamente, sem colapso.
23. Navegação, página e rotas `inspecionar`, sugestão/mapeamento, `previa`, `exportar` e `template` aplicam o mesmo contrato de autorização; acesso direto sem permissão é bloqueado.
24. Não existe sessão intermediária de mesclagem: cada chamada valida autenticação, usuário ativo, permissão, origem, contrato e limites; prévia e processamento da exportação dependem apenas do payload atual.
25. `/PainelAlpha/Mesclagem` apresenta cards das últimas mesclagens; **Nova mesclagem** abre o workflow full-page em `/PainelAlpha/Mesclagem/nova`.
26. Cada card abre um detalhe com principal, complementar e resultado separados e disponíveis por uma rota de download autenticada.
27. Usuário comum lista/abre somente seus registros; Admin, CEO e TI podem consultar todos. Chaves internas e URLs públicas de storage nunca são expostas.
28. O histórico é criado somente após o XLSX final ser gerado; falha no banco limpa os objetos enviados e falha no armazenamento não cria registro parcial.
29. `Data Opção Simples`, `Data da Situação` e `Data de Constituição` saem como `dd/MM/yyyy`, sem horário ou deslocamento por fuso.
30. Há testes para full-page, mapping, IA segura, DDDs, datas, 1:N, autorização, histórico, rollback de objetos e download privado.
31. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` não têm regressão da Mesclagem; débitos globais preexistentes são registrados no Dev Agent Record.
32. A migration é executada somente após relatório Vault, backup verificado com até 48 horas e confirmação explícita do usuário.

### Evidência dos critérios de aceitação

| ACs | Status | Evidência |
|---|---|---|
| 1–3 | ATENDIDOS | `page.tsx`, `MesclagemWorkspace.tsx` e testes de contrato full-page/responsividade comprovam ausência de modal e preservação do workflow responsivo. |
| 4–7 | ATENDIDOS | `useMesclagemController.ts`, `FileCard.tsx`, `UploadDropzone.tsx`, `catalogo.ts` e testes frontend/parsing cobrem loaders, retry, invalidação e formatos reais. |
| 8–14 | ATENDIDOS | `/api/mesclagem/sugerir`, `processamento.ts`, `mapeamento-deterministico.ts`, `mapeamento-ia.ts` e testes de mapeamento/API cobrem sugestão pré-prévia, DDDs, fallback local e race protection. |
| 15–20 | ATENDIDOS | Reprocessamento da prévia/exportação, `workspace-state.ts`, `mesclador.ts`, `template.ts` e testes backend/template comprovam override, **Vazio**, fallback da principal e saída por cabeçalho. |
| 21–22 | ATENDIDOS | `cnpj.ts`, `mesclador.ts` e suas suítes cobrem contagens separadas, duplicado válido e expansão 1:N determinística. |
| 23–24 | ATENDIDOS | Registry, page gate, `autorizacao.ts`, APIs, guards/rate limit e testes cobrem autorização uniforme e processamento sem sessão intermediária. |
| 25–28 | ATENDIDOS | `HistoryHome`, `HistoryDetail`, `historico.ts`, storage privado e rota protegida implementam cards, três arquivos, escopo proprietário/admin e compensação de falhas. |
| 29 | ATENDIDO | `data.ts`, `mesclador.ts` e regressão real confirmam `dd/MM/yyyy`, sem horário, nas datas preenchidas. |
| 30 | ATENDIDO AUTOMATICAMENTE | 104/104 testes direcionados da Mesclagem aprovados; QA browser autenticado permanece pendente. |
| 31 | ATENDIDO NO ESCOPO | Lint direcionado e build aprovados. Gates globais externos à story estão registrados no Dev Agent Record. |
| 32 | ATENDIDO | Backup pré-mudança validado por restauração, autorização explícita registrada e migration aplicada/verificada no Turso de produção. |

## Fora do escopo

- Persistir sessões intermediárias, prévias ou mapeamentos incompletos.
- Exclusão, retenção automática ou compartilhamento público de históricos.
- Adicionar parsers para `.xls`, `.xlsb` ou `.ods`; ficam indisponíveis até story específica.
- Enviar conteúdo de planilha a IA remota ou alterar a infraestrutura geral do Bibble.
- Redesenhar a identidade visual ou modificar componentes compartilhados globais sem necessidade demonstrada.
- Alterar validação matemática do CNPJ ou relação 1:N além da classificação/contagem de duplicados.
- Modificar destrutivamente o template oficial ou a planilha de evidência.

## Tasks / Subtasks

- [x] **Task 1 — Consolidar como página de módulo** (AC: 1–3, 25)
  - [x] Remover estado/CTA de abertura e composição landing page + overlay.
  - [x] Converter o shell em `MesclagemWorkspace`, sem props de abertura, backdrop ou semântica de diálogo.
  - [x] Reaproveitar componentes visuais e aplicar responsividade à página.
  - [x] Substituir a regressão antiga de modal por contrato full-page.

- [x] **Task 2 — Corrigir upload, loading e formatos** (AC: 4–7)
  - [x] Separar inspeção/loading da principal e complementar e informar qual arquivo carrega.
  - [x] Tratar sucesso, erro, retry, troca e invalidação de estado derivado.
  - [x] Centralizar extensões processáveis e reutilizar na UI, `accept`, mensagens e backend.
  - [x] Rejeitar claramente formatos sem parser real.

- [x] **Task 3 — Exibir automapeamento antes da prévia** (AC: 8–14)
  - [x] Criar contrato server-side de sugestão por cabeçalhos antes da prévia.
  - [x] Executar `mapearCamposAutomaticos` primeiro e IA apenas nas pendências não manuais.
  - [x] Conectar resultado à etapa Mapeamento, com loading best-effort e proteção contra respostas obsoletas.
  - [x] Preservar overrides ao recalcular e incluir `DDD1`–`DDD5` no catálogo.
  - [x] Manter IA server-side, local e limitada a metadados de cabeçalho.

- [x] **Task 4 — Fazer override comandar prévia/exportação** (AC: 15–20)
  - [x] Reprocessar prévia e exportação com o mapeamento atual, sem sessão intermediária ou cache de resultado.
  - [x] Invalidar estado de prévia/exportação quando mapeamento mudar.
  - [x] Preservar **Vazio** manual e fallback da principal apenas para destino mapeado.
  - [x] Reconhecer na principal os aliases abreviados `Situação`, `Data Situação`, `Data Const.`, `Regime` e `Data Opção` para não perder dados sem match.
  - [x] Resolver saída por cabeçalho normalizado e acrescentar ausentes sem fallback posicional.
  - [x] Posicionar `DDD1`–`DDD5` imediatamente antes de seus respectivos `FONE1`–`FONE5` no template baixável e no XLSX final.
  - [x] Normalizar os destinos de data como `dd/MM/yyyy`, sem horário ou conversão de fuso, inclusive para ISO, texto brasileiro e serial Excel.
  - [x] Validar com fixtures XLSX estruturalmente equivalentes e template oficial.

- [x] **Task 5 — Corrigir duplicidades** (AC: 21–22)
  - [x] Separar válidos únicos, duplicados válidos, inválidos e vazios.
  - [x] Preservar 1:N da complementar e comportamento determinístico com repetição na principal.
  - [x] Expor totais corretos sem classificar duplicado válido como erro.

- [x] **Task 6 — Alinhar autorização e segurança do processamento** (AC: 23–24)
  - [x] Aplicar às páginas o mesmo critério do registry e dos endpoints.
  - [x] Ajustar `verificarAcessoMesclagem` sem ampliar acesso além de admin ou `mesclagemPlanilhas`.
  - [x] Remover dependência de sessão de mesclagem; autenticar e validar cada request independentemente.
  - [x] Manter 401/403/409/413/422/429, same-origin, rate/concurrency limit e auditoria sem conteúdo das planilhas.

- [ ] **Task 7 — Testar e executar gates** (AC: 30–31; automação concluída, QA browser pendente)
  - [x] Adicionar testes unitários/integração dos cenários funcionais, XLSX e segurança.
  - [ ] Executar QA browser manual autenticado em desktop e viewport reduzida com arquivos válidos.
  - [x] Executar testes direcionados, lint e build; registrar limitações dos gates globais externos à story.
  - [x] Atualizar checkboxes, Completion Notes e File List real.

- [x] **Task 8 — Datas e histórico privado** (AC: 25–32)
  - [x] Normalizar datas oficiais para `dd/MM/yyyy` sem horário.
  - [x] Criar home de histórico, rota de nova mesclagem e detalhe com três arquivos.
  - [x] Persistir metadados no Turso e arquivos no QuObjects privado, sem URL pública.
  - [x] Aplicar ownership para usuário comum e visão global para Admin/CEO/TI.
  - [x] Criar CLI de diagnóstico, listagem, detalhe e download com a mesma regra de acesso.
  - [x] Executar protocolo Vault, backup/restauração, confirmação, migration e pós-verificação.

- [x] **Task 9 — Adapter de entrada Logcomex estendido**
  - [x] Detectar por estrutura a aba de empresas e ignorar a aba de resumo.
  - [x] Selecionar exclusivamente o `CNPJ` completo, sem equiparar `Raiz CNPJ` ou outros campos homônimos.
  - [x] Adaptar somente campos já existentes para a representação interna comum.
  - [x] Manter parser antigo, engine 1:N, template, cabeçalhos e ordem de saída inalterados.
  - [x] Validar o arquivo Logcomex real com `Mesclagem/2.xlsx` e comprovar regressão do formato antigo.

## Dev Notes

### Arquitetura entregue

- `page.tsx` aplica o page gate e lista as últimas mesclagens; `/nova` monta diretamente `MesclagemWorkspace`, sem overlay, dialog ou estado de abrir/fechar.
- `useMesclagemController.ts` mantém o estado client-side do workflow, loaders por arquivo, invalidação de derivados, proteção por contador contra respostas obsoletas e overrides manuais.
- O catálogo único em `catalogo.ts` contém 31 destinos (os 26 originais mais `DDD1`–`DDD5`), quatro extensões e limites estruturais reutilizados por UI e servidor.
- `POST /api/mesclagem/sugerir` recebe somente destinos e metadados de cabeçalho. O determinístico roda primeiro; o fallback Qwen/Llama local é server-only, best-effort, limitado, sanitizado, protegido por allowlist de host e timeout de 1–5 s.
- `POST /api/mesclagem/previa` e o processamento de `POST /api/mesclagem/exportar` são stateless: recebem arquivos + seleção + mapeamento, revalidam tudo e reprocessam o resultado. Após gerar o XLSX, a exportação grava um registro final e envia as três planilhas ao storage privado.
- `mesclador.ts` separa CNPJ vazio, inválido e duplicado válido, preserva 1:N e limita a expansão. `template.ts` resolve por cabeçalho normalizado e acrescenta destinos ausentes deterministicamente.
- `autorizacao.ts` é a fonte comum de page/API gate: sessão válida, usuário ativo e admin ou permissão efetiva `mesclagemPlanilhas`. Os endpoints também exigem same-origin, Content-Type/Content-Length, limites por usuário e retornam `no-store`.
- `MesclagemHistorico` guarda somente ownership, nomes, chaves privadas, tamanhos e contagens. Downloads passam por autorização server-side; chaves de storage não chegam à UI.
- `npm run mesclagem:historico` disponibiliza diagnóstico, listagem, detalhe e download pelo CLI com a mesma regra proprietário/admin.
- A auditoria é best-effort e registra somente ação, sucesso/falha, ID do histórico e contagens agregadas; nunca células, CNPJ ou conteúdo.

### Destinos oficiais

Manter os 26 destinos atuais e acrescentar `DDD1`, `DDD2`, `DDD3`, `DDD4`, `DDD5`, pareados com `FONE1`–`FONE5`.

Cabeçalhos da aba `Template` da evidência: `Data Opção Simples`, `Capital Social`, `CPF_SOCIO`, `NOME_SOCIO`, `FONE1`, `FG_WHATSAPP1`, `FONE2`, `FG_WHATSAPP2`, `FONE3`, `FG_WHATSAPP3`, `FONE4`, `FG_WHATSAPP4`, `FONE5`, `FG_WHATSAPP5`, `EMAIL_SOCIO`, `CNPJ`, `Contribuinte`, `Situação da Habilitação`, `Data da Situação`, `Submodalidade`, `Razão Social`, `Nome Fantasia`, `Município`, `UF`, `Data de Constituição`, `Regime Tributário`.

### Restrições técnicas

- Stack existente: React/Next.js, TypeScript, Tailwind, Vitest e ExcelJS; não adicionar dependência sem necessidade demonstrada.
- Não modificar destrutivamente `public/templates/template-padrao.xlsx` nem a evidência.
- Não enviar conteúdo ao modelo nem registrar nomes/valores de células em auditoria.
- O histórico reutiliza o Turso e o bucket privado QuObjects já configurados; nenhuma credencial é exposta ou adicionada ao código.
- `docs/architecture/`, `docs/framework/`, `.aiox/gotchas.json` e `accumulated-context.md` não estão disponíveis; notas derivam dos arquivos reais e stories anteriores.

## Testing

| Cenário | Resultado esperado |
|---|---|
| Abrir a rota | Workflow na página, sem overlay/modal ou CTA intermediário |
| Viewport reduzida | Conteúdo responsivo, sem overflow e com ações alcançáveis |
| Carregar principal | Loading somente na principal |
| Erro/retry | Loading encerra e nova seleção funciona |
| `.xlsx`, `.xlsm`, `.csv`, `.tsv` | UI e backend aceitam/processam |
| `.xls`, `.xlsb`, `.ods` | UI não anuncia e backend rejeita coerentemente |
| Cabeçalhos exatos/aliases | Sugestões aparecem antes de **Gerar prévia** |
| IA indisponível/inválida | Pendências ficam editáveis; fluxo continua |
| Troca rápida de aba/arquivo | Resposta antiga não sobrescreve estado atual |
| DDD1–DDD5 | Destinos aparecem e chegam ao XLSX correto |
| Override após prévia | Resultado recalcula e exportação usa nova origem |
| Override para **Vazio** | Campo permanece vazio, sem automapeamento silencioso |
| Cabeçalhos fora de ordem/ausentes | Valores corretos e destinos adicionados sem sobrescrita |
| CNPJ repetido válido | Conta duplicado, não inválido, preservando 1:N |
| Sem permissão / URL direta | Página e APIs negam pelo mesmo contrato |
| Requisição sem autenticação/permissão | Cada endpoint nega independentemente, sem revelar conteúdo |
| Fluxo completo | Upload, CNPJ, mapping, preview, retorno e exportação funcionam |
| Home do módulo | Cards recentes e CTA **Nova mesclagem** |
| Abrir card | Detalhe mostra principal, complementar e resultado separados |
| Usuário comum | Lista e baixa somente históricos próprios |
| Admin/CEO/TI | Lista e baixa históricos de qualquer usuário |
| Falha após upload | Objetos enviados são removidos e não sobra registro parcial |
| Datas | Campos oficiais saem como `dd/MM/yyyy`, sem horário |

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type:** Frontend / UX
- **Secondary Type(s):** API, data transformation, persistence, storage, security/authorization
- **Complexity:** High — workflow, contratos, XLSX, histórico durável e arquivos privados.

### Specialized Agent Assignment

- **Primary Agents:** `@dev`, `@qa`
- **Supporting Agents:** `@ux-design-expert`, `@architect`
- **Database agent:** Vault acionado; backup, consentimento e migration verificados.

### Quality Gate Tasks

- [x] **Pre-Commit (`@dev`):** ESLint e testes direcionados da Mesclagem aprovados.
- [ ] **QA (`@qa`):** browser manual autenticado para runtime full-page, arquivos reais, mapping/override, autorização e XLSX.
- [ ] **UX (`@ux-design-expert`):** contratos automatizados cobrem responsividade, foco, affordance e estados assíncronos; parecer formal não executado e inspeção browser final permanece com QA.
- [ ] **Pre-PR (`@devops`):** CodeRabbit contra `main` e gates globais não executados nesta entrega local.
- [ ] **Pre-Deployment:** não aplicável.

### Self-Healing Configuration

- **Primary Agent:** `@dev` em modo light.
- **Max Iterations:** 2; **Timeout:** 15 minutos; **Severity Filter:** CRITICAL.
- **Predicted Behavior:** CRITICAL recebe auto-fix; HIGH é documentado; MEDIUM/LOW não recebem auto-fix.

### CodeRabbit Focus Areas

- Invalidação/recálculo após arquivo, aba ou mapping mudar; race conditions e loading individual.
- IA server-side sem conteúdo e fallback não bloqueante.
- Contrato sem sessão intermediária e coerência de autorização entre registry, página, APIs, histórico e CLI.
- Duplicidades 1:N, DDDs e exportação por cabeçalho sem posição.
- Atomicidade lógica entre storage privado e metadados do Turso.

## File List da entrega

### Produção

- `src/lib/modulos-registry.ts`
- `src/lib/cs-nps/preflight-xlsx.ts`
- `src/app/PainelAlpha/Mesclagem/page.tsx`
- `src/app/PainelAlpha/Mesclagem/nova/page.tsx`
- `src/app/PainelAlpha/Mesclagem/[id]/page.tsx`
- `src/app/PainelAlpha/Mesclagem/MesclagemWorkspace.tsx`
- `src/app/PainelAlpha/Mesclagem/useMesclagemController.ts`
- `src/app/PainelAlpha/Mesclagem/workspace-state.ts`
- `src/app/PainelAlpha/Mesclagem/api-mesclagem.ts`
- `src/app/PainelAlpha/Mesclagem/components/CnpjDiagnostic.tsx`
- `src/app/PainelAlpha/Mesclagem/components/ExportPanel.tsx`
- `src/app/PainelAlpha/Mesclagem/components/FileCard.tsx`
- `src/app/PainelAlpha/Mesclagem/components/HistoryHome.tsx`
- `src/app/PainelAlpha/Mesclagem/components/HistoryDetail.tsx`
- `src/app/PainelAlpha/Mesclagem/components/MappingPanel.tsx`
- `src/app/PainelAlpha/Mesclagem/components/MergePreview.tsx`
- `src/app/PainelAlpha/Mesclagem/components/MergeStepper.tsx`
- `src/app/PainelAlpha/Mesclagem/components/ProcessingProgress.tsx`
- `src/app/PainelAlpha/Mesclagem/components/StatusBadge.tsx`
- `src/app/PainelAlpha/Mesclagem/components/UploadDropzone.tsx`
- `src/app/api/mesclagem/inspecionar/route.ts`
- `src/app/api/mesclagem/sugerir/route.ts`
- `src/app/api/mesclagem/previa/route.ts`
- `src/app/api/mesclagem/exportar/route.ts`
- `src/app/api/mesclagem/template/route.ts`
- `src/app/api/mesclagem/historico/[id]/arquivo/[tipo]/route.ts`
- `src/lib/mesclagem/autorizacao.ts`
- `src/lib/mesclagem/catalogo.ts`
- `src/lib/mesclagem/cnpj.ts`
- `src/lib/mesclagem/data.ts`
- `src/lib/mesclagem/erro.ts`
- `src/lib/mesclagem/http-guards.ts`
- `src/lib/mesclagem/historico.ts`
- `src/lib/mesclagem/input-adapter.ts`
- `src/lib/mesclagem/index.ts`
- `src/lib/mesclagem/mapeamento-deterministico.ts`
- `src/lib/mesclagem/mapeamento-ia.ts`
- `src/lib/mesclagem/mesclador.ts`
- `src/lib/mesclagem/parsing.ts`
- `src/lib/mesclagem/preflight-xlsx.ts`
- `src/lib/mesclagem/processamento.ts`
- `src/lib/mesclagem/rate-limit.ts`
- `src/lib/mesclagem/schemas.ts`
- `src/lib/mesclagem/storage.ts`
- `src/lib/mesclagem/template.ts`
- `src/lib/mesclagem/tipos.ts`
- `public/templates/template-padrao.xlsx`
- `prisma/schema.prisma`
- `prisma/migrations/20260915170500_mesclagem_historico/migration.sql`
- `scripts/mesclagem-historico.ts`
- `package.json`

### Testes

- `tests/mesclagem/api-contracts.test.ts`
- `tests/mesclagem/autorizacao.test.ts`
- `tests/mesclagem/backend-fluxo.test.ts`
- `tests/mesclagem/cnpj.test.ts`
- `tests/mesclagem/data.test.ts`
- `tests/mesclagem/frontend-api-validation.test.ts`
- `tests/mesclagem/frontend-state.test.ts`
- `tests/mesclagem/frontend-workspace-contract.test.ts`
- `tests/mesclagem/http-guards.test.ts`
- `tests/mesclagem/historico.test.ts`
- `tests/mesclagem/input-adapter.test.ts`
- `tests/mesclagem/logcomex-adapter-real.test.ts`
- `tests/mesclagem/mapeamento.test.ts`
- `tests/mesclagem/mesclador.test.ts`
- `tests/mesclagem/modal-responsivo.test.ts`
- `tests/mesclagem/parsing.test.ts`
- `tests/mesclagem/compatibilidade-formatos.test.ts`
- `tests/mesclagem/preflight-xlsx.test.ts`
- `tests/mesclagem/rate-limit.test.ts`
- `tests/mesclagem/referencia-regressao.test.ts`
- `tests/mesclagem/template.test.ts`

### Documentação

- `docs/stories/story-mesclagem-selecao-ddd-exportacao-cabecalho.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`

### Evidência consultada, não alterada

- `mesclagem-planilhas-2026-09-14 - resultado.xlsx`
- `Mesclagem/LISTA LOGCOMEX - HOUSE E DIRETO - 1 E 2 EMBARQUES - 05.03.2026 A 02.06.2026 - 50k e 150k.xlsx`

## Story Draft Checklist Validation

| Categoria | Status | Evidência |
|---|---|---|
| Goal & Context Clarity | PASS | Full-page, defeitos funcionais, valor, precedência e limites explícitos. |
| Technical Implementation Guidance | PASS | Causas, contratos, pontos de integração e arquivos reais identificados. |
| Reference Effectiveness | PASS | Stories, evidência XLSX e arquivos citados com finalidade. |
| Self-Containment Assessment | PASS | Layout, fluxo, IA, formatos, DDDs, datas, histórico privado, ownership e banco definidos. |
| Testing Guidance | PASS | Cenários de UI, API, XLSX, segurança e runtime mensuráveis. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos atualizados. |

**Final Assessment:** READY FOR REVIEW — implementação e gates automatizados direcionados concluídos; QA browser autenticado permanece pendente.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-14 | 1.0.0 | Story criada para seleção, loading individual, DDDs e exportação por cabeçalho. | River (`@sm`) |
| 2026-09-15 | 2.0.0 | Escopo consolidado: full-page, fluxo funcional, automapeamento pré-prévia, override, formatos reais, duplicidades e autorização. | River (`@sm`) |
| 2026-09-15 | 2.1.0 | Entrega implementada com workspace full-page, processamento stateless, segurança endurecida e documentação de gates/evidências. | Dex (`@dev`) / Scribe |
| 2026-09-15 | 2.2.0 | Limite de upload ampliado para 80 MB por arquivo, com envelopes multipart coerentes e preflight ZIP preservado. | Dex (`@dev`) |
| 2026-09-15 | 2.3.0 | Fallback da principal corrigido para aliases abreviados, transparência de exportação ampliada e regressão 2.609/2.514/95 adicionada. | Dex (`@dev`) |
| 2026-09-15 | 2.4.0 | Template físico, download e exportação alinhados na ordem DDD1→FONE1 até DDD5→FONE5, com teste de regressão. | Dex (`@dev`) |
| 2026-09-15 | 2.5.0 | Campos oficiais de data normalizados para `dd/MM/yyyy`, sem horário e sem deslocamento de fuso. | Dex (`@dev`) |
| 2026-09-15 | 3.0.0 | Home convertida em histórico; três arquivos preservados em storage privado, ownership aplicado e schema Turso migrado sob protocolo Vault. | Dex (`@dev`) |
| 2026-09-15 | 3.1.0 | Adapter estrutural do layout Logcomex adicionado sem alterar engine, template, layout ou contrato de saída. | Dex (`@dev`) |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- `tests/mesclagem/`: **110/110 PASS**.
- ESLint direcionado da Mesclagem: **PASS** (exit 0).
- `npm run build`: **PASS** (exit 0).
- `npm run mesclagem:historico -- doctor`: **PASS**, tabela e storage privado disponíveis.
- Vault: dump pré-mudança de **127.264.453 bytes**, 307 tabelas/124.235 linhas, SHA-256 `001c49d63063d6d29d3a1aceb0a184c0c7a91da539101b1fbb1621ca6d7bd224`; restauração `integrity_check=ok` e zero violações de FK.
- `npm run typecheck`/`tsc` com 8 GB: **exit 2**, com 16 diagnósticos externos à Mesclagem (principalmente Exclusão Fiscal, `node:sqlite`, Gerador de Documentos e Radar; inspeção adicional também apontou ChatBot Alpha). Nenhum diagnóstico em `src/**/Mesclagem`, `src/app/api/mesclagem` ou `src/lib/mesclagem`.
- `npm test` global em 2026-09-15: **exit 1**, 18 falhas em 10 arquivos, 3.094 testes aprovados e 1 pendente; todas as falhas fora da Mesclagem.
- `npm run lint` global: **exit 134 por OOM** no débito amplo do workspace; lint direcionado da Mesclagem aprovado sem avisos.
- CodeRabbit: indisponível/não instalado no ambiente.
- QA browser manual autenticado: não executado; não há alegação de smoke runtime.

### Completion Notes List

- Workflow agora é o conteúdo principal da rota, mantendo a identidade visual e removendo integralmente o shell de modal.
- Estado client-side coordena uploads independentes, retry, troca de abas/CNPJ, automapeamento pré-prévia, overrides e descarte de respostas obsoletas.
- O processamento não usa sessão intermediária: prévia e exportação reprocessam arquivos e mapeamento atuais; somente a exportação concluída cria o histórico final.
- O catálogo canônico alinha UI/backend em `.xlsx`, `.xlsm`, `.csv`, `.tsv` e acrescenta `DDD1`–`DDD5` aos 26 destinos anteriores.
- O fallback Qwen/Llama permanece local, server-only, best-effort e limitado a destinos/cabeçalhos sanitizados; falha ou timeout não bloqueiam o determinístico.
- Duplicidades válidas são separadas de inválidos/vazios, 1:N é preservado e exportação usa cabeçalhos normalizados sem fallback posicional.
- Aliases abreviados da fonte principal agora alimentam o fallback dos registros sem correspondência; validação real de `Mesclagem/1.xlsx` + `2.xlsx` produziu 2.609 linhas e nenhum vazio indevido nos quatro campos identificados.
- A etapa de mapeamento informa campos sem origem, colunas que não entram no template e a origem de fallback da principal; a exportação explicita que inclui todas as empresas e não está limitada à amostra da prévia.
- O template oficial, seu endpoint de download e a exportação agora mantêm cada `DDDn` imediatamente antes do respectivo `FONEn`.
- Datas oficiais da exportação são normalizadas como `dd/MM/yyyy`; validação real confirmou 2.609/2.609 valores formatados em `Data da Situação` e `Data de Constituição`, sem horário.
- A home agora apresenta até 50 mesclagens recentes e cada detalhe oferece separadamente a principal, complementar e o resultado.
- O histórico guarda metadados no Turso e os três arquivos no QuObjects privado; usuário comum vê os próprios registros e Admin/CEO/TI veem todos.
- A rota de download revalida ownership no servidor, não expõe chaves/URLs internas e responde com `no-store`; falha de persistência aciona compensação dos objetos enviados.
- O CLI permite diagnosticar, listar, detalhar e baixar históricos sem depender da UI.
- Autorização é uniforme em menu, páginas, APIs e histórico; guards de origem/tamanho/tipo, limites de carga/concurrency/rate e auditoria sanitizada endurecem o fluxo.
- A tabela `MesclagemHistorico` foi criada no Turso de produção somente após backup/restauração verificados e confirmação explícita do usuário.
- O upload aceita até 80 MB por arquivo; os endpoints usam envelopes multipart de 82/164 MB e o XLSX mantém preflight contra ZIP bomb com orçamento descompactado limitado.
- O adapter `logcomex_extended` identifica uma única aba pela assinatura real, escolhe somente `CNPJ` completo e projeta 348 colunas de origem em 12 campos internos existentes; `Raiz CNPJ` e campos extras não entram na engine.
- A fixture real Logcomex com `Mesclagem/2.xlsx` produziu 968 linhas: 46 empresas com match, 62 linhas complementares 1:N e 906 empresas sem match. Cabeçalhos, quantidade, ordem e hash do template permaneceram inalterados.

### File List

Ver **File List da entrega** acima.

## QA Results

Pendente: inspeção browser autenticada em desktop e viewport reduzida, com arquivos válidos, revisão de mapeamento, override para coluna/**Vazio** e download do XLSX. Os gates automatizados direcionados estão aprovados; este registro não substitui o parecer de `@qa`.
