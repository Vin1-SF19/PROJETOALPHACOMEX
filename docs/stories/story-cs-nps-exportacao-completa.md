# Story: Exportação completa de dados do CS & NPS

**ID:** STORY-CSNPS-001  
**Epic:** CS & NPS  
**Status:** Draft  
**Prioridade:** Alta  
**Complexidade:** 7  
**Agente responsável:** Dex  
**Data criação:** 2026-07-15  

---

## Narrativa

**Como** usuário autorizado do módulo CS & NPS,  
**quero** exportar para uma planilha todas as empresas e todos os dados vinculados a elas,  
**para** obter uma cópia completa da base do módulo, incluindo sócios, acompanhamentos de CS e feedbacks do Google.

---

## Contexto

O módulo CS & NPS está em `/PainelAlpha/CadastroClientes` e hoje lista os registros de `clientes`, agrupando visualmente registros que compartilham CNPJ. O pedido é uma exportação integral da base, e não apenas das linhas visíveis, filtradas ou agrupadas na tela.

O schema atual confirma relações diretas de `clientes` com `socios`, `log_cs`, `logFeedback`, `logAlteracao`, `HistoricoAlteracaoCliente`, `Indicacao`, `crm_oportunidades` e `crm_contatos`. O próprio registro de `clientes` contém, entre outros campos, `nps`, `feedbackGoogle` e `nomeGoogle`. Essas são as relações verificadas nesta preparação; nenhuma outra tabela deve ser incluída apenas por semelhança de nome ou CNPJ sem vínculo confirmado no schema.

---

## Critérios de Aceitação

- [x] **AC-001:** A barra de ações do CS & NPS exibe o botão **Exportar dados** no topo, imediatamente ao lado de **Novo Cliente**, preservando o comportamento responsivo existente.
- [ ] **AC-002:** Ao acionar **Exportar dados**, o sistema gera e inicia o download de um arquivo de planilha em formato `.xlsx` contendo todos os registros persistidos de `clientes`, sem aplicar busca, filtro, agrupamento por CNPJ ou paginação da interface.
- [ ] **AC-003:** A exportação inclui todos os campos do registro de cada empresa/serviço em `clientes`, inclusive os campos de NPS e feedback Google (`nps`, `feedbackGoogle` e `nomeGoogle`), mantendo um identificador que permita relacionar cada linha aos seus dados dependentes.
- [ ] **AC-004:** A exportação inclui todos os sócios/responsáveis de cada registro de empresa, com todos os campos persistidos em `socios` e o vínculo inequívoco com o respectivo `clienteId`.
- [ ] **AC-005:** A exportação inclui todo o histórico de acompanhamentos de CS persistido em `log_cs`, com todos os seus campos e vínculo com o respectivo `clienteId`.
- [ ] **AC-006:** A exportação inclui todo o histórico de feedback persistido em `logFeedback`, com todos os seus campos e vínculo com o respectivo `clienteId`; o estado do feedback Google armazenado no próprio cliente também permanece incluído conforme AC-003.
- [ ] **AC-007:** As demais relações diretas atualmente confirmadas no schema — `logAlteracao`, `HistoricoAlteracaoCliente`, `Indicacao`, `crm_oportunidades` e `crm_contatos` — são exportadas com seus campos persistidos e chaves de relacionamento. Dados internos dos registros relacionados além do vínculo direto só podem ser expandidos quando a relação estiver explicitamente confirmada no schema e não contiver segredo ou credencial.
- [ ] **AC-008:** Registros arquivados também integram a exportação; a consulta não reutiliza a restrição `status != "Arquivado"` aplicada pela listagem atual.
- [ ] **AC-009:** Relações de cardinalidade múltipla não causam perda, sobrescrita nem duplicação indevida de empresas. A planilha organiza entidades relacionais de forma que todas as ocorrências sejam preservadas e possam ser associadas por `clienteId` (por exemplo, abas separadas por entidade).
- [ ] **AC-010:** O botão informa estado de processamento, impede disparos concorrentes acidentais e apresenta erro compreensível quando a geração ou o download falhar; uma base vazia é tratada sem gerar arquivo enganoso.
- [ ] **AC-011:** A geração dos dados ocorre no servidor e exige sessão autenticada e autorização para o módulo `Cliente`/CS & NPS. Usuários sem a permissão aplicável não recebem dados parciais nem metadados da exportação.
- [ ] **AC-012:** Campos com valores nulos, booleanos, números e datas são representados de modo consistente, e conteúdos iniciados por `=`, `+`, `-` ou `@` são neutralizados quando necessário para impedir execução de fórmulas ao abrir a planilha.
- [ ] **AC-013:** O nome do arquivo identifica o módulo e a data/hora da geração, sem incluir dados pessoais, credenciais ou valores fornecidos pelo usuário.
- [x] **AC-014:** A aba **Empresas** informa a quantidade de sócios e apresenta um resumo legível, em múltiplas linhas, com todos os campos persistidos de cada sócio vinculado.
- [x] **AC-015:** A aba **Socios** preserva todos os campos persistidos da entidade e acrescenta razão social, CNPJ e serviço do cliente para identificação imediata, sem remover o vínculo por `clienteId`.
- [x] **AC-016:** Todas as abas possuem cabeçalho profissional, filtros, primeira linha congelada, larguras limitadas e ajustadas ao conteúdo/tipo, alturas adequadas, quebra de texto, bordas, alinhamento e linhas alternadas.
- [x] **AC-017:** Na aba **Empresas**, `feedbackGoogle` é exportado como **SIM**/**NÃO**, com SIM em verde e NÃO em vermelho; o status usa verde para Deferido, vermelho para qualquer Cancelado, amarelo para Stand By, azul para Em Andamento, cinza para Arquivado e estilo neutro para valores desconhecidos.
- [x] **AC-018:** As 18 colunas de data confirmadas usam metadados explícitos por aba: datas civis são células Excel reais em `dd/mm/yyyy`, datas com horário são células reais em `dd/mm/yyyy hh:mm`, valores nulos ficam vazios e entradas inválidas permanecem texto; datas civis não sofrem deslocamento de fuso horário.

---

## Fora do Escopo

- Exportar tabelas que não possuam relação confirmada com `clientes` no schema atual.
- Inferir vínculos por CNPJ, razão social, nome fantasia ou qualquer comparação textual.
- Importar ou restaurar dados a partir da planilha.
- Alterar, excluir ou arquivar registros durante a exportação.
- Criar novas relações ou migrations de banco para viabilizar a exportação.
- Exportar senhas, tokens, segredos, credenciais ou dados de sessão, ainda que alguma relação futura os torne alcançáveis.

---

## Tasks / Subtasks

- [x] **Task 1 — Inventariar o contrato da exportação (AC: 3–9)**
  - [x] Confirmar no `prisma/schema.prisma`, no momento da implementação, todos os campos de `clientes` e das relações diretas listadas nesta story.
  - [x] Registrar no código o mapeamento explícito de entidades/colunas; não usar varredura irrestrita do banco nem inferência por nomes.
  - [x] Definir uma aba por entidade de cardinalidade múltipla, preservando `clienteId` e os IDs primários para rastreabilidade.
  - [x] Garantir que registros distintos de `clientes` com o mesmo CNPJ/serviços diferentes permaneçam linhas distintas.

- [x] **Task 2 — Implementar consulta protegida e completa no servidor (AC: 2–8, 11)**
  - [x] Criar uma operação específica de exportação, sem reutilizar o resultado filtrado ou agrupado mantido no estado da página.
  - [x] Validar a sessão e a permissão do módulo antes de consultar qualquer dado.
  - [x] Consultar todos os clientes, incluindo arquivados, com as relações diretas verificadas.
  - [x] Selecionar explicitamente os campos permitidos para impedir vazamento acidental caso um modelo relacionado ganhe campos sensíveis no futuro.
  - [x] Evitar logar o conteúdo exportado ou informações pessoais em mensagens de erro.

- [x] **Task 3 — Gerar a planilha (AC: 2–10, 12–13)**
  - [x] Usar uma biblioteca de planilhas já instalada no projeto (`exceljs`, `xlsx` ou `xlsx-js-style`), seguindo o padrão existente mais adequado.
  - [x] Criar abas com nomes estáveis e cabeçalhos legíveis para empresas, sócios, CS, feedbacks e demais relações confirmadas.
  - [x] Preservar tipos úteis, normalizar valores ausentes e neutralizar formula injection.
  - [x] Gerar nome de arquivo seguro com data/hora e MIME type de `.xlsx`.
  - [x] Considerar o volume da base para não transportar toda a estrutura relacional pelo estado normal da página nem bloquear desnecessariamente a interface.
  - [x] Incluir `quantidadeSocios` e `sociosResumo` na aba Empresas, cobrindo todos os campos de cada sócio em linhas legíveis.
  - [x] Enriquecer a aba Socios com `clienteRazaoSocial`, `clienteCnpj` e `clienteServico`, preservando os campos e IDs originais.
  - [x] Aplicar estilo consistente em todas as abas: cabeçalho, filtros, freeze, larguras limitadas por conteúdo/tipo, alturas, wrap, bordas, alinhamento e zebra.
  - [x] Aplicar cores semânticas a `feedbackGoogle` e `status` na aba Empresas, mantendo valores desconhecidos neutros.
  - [x] Preservar a neutralização de formula injection e o formato textual das células string após a estilização.
  - [x] Normalizar explicitamente as 18 colunas de data por aba, aceitando `dd/mm/yyyy`, `yyyy-mm-dd`, ISO e objetos `Date`, com formatos distintos para data civil e data/hora.
  - [x] Exibir `dataNascimento` no `sociosResumo` como `dd/mm/yyyy`, sem deslocamento UTC.

- [x] **Task 4 — Integrar o botão à interface (AC: 1, 10–11)**
  - [x] Adicionar **Exportar dados** imediatamente ao lado de **Novo Cliente** na barra de ações de `CadastroClientes/page.tsx`.
  - [x] Exibir estado carregando/desabilitado durante a exportação e feedback de sucesso/erro coerente com o módulo.
  - [x] Verificar layout e acesso por teclado nos breakpoints já usados pela página.

- [ ] **Task 5 — Testes automatizados e verificação (AC: 1–13)**
  - [ ] Testar autorização: sessão ausente e usuário sem permissão não conseguem exportar.
  - [ ] Testar base vazia e falha de consulta/geração.
  - [ ] Testar múltiplos registros do mesmo CNPJ e múltiplos filhos por cliente, comprovando ausência de perda ou associação cruzada.
  - [ ] Testar inclusão de arquivados e independência dos filtros/busca da UI.
  - [ ] Testar campos nulos, booleanos, números, datas, caracteres especiais e valores que poderiam ser interpretados como fórmula.
  - [ ] Abrir/inspecionar o `.xlsx` gerado em teste e validar nomes de abas, cabeçalhos, contagens e chaves de relacionamento.
  - [ ] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; documentar scripts ausentes ou falhas preexistentes sem ocultá-las.

---

## Segurança e Autorização

- A exportação reúne dados empresariais e pessoais em massa e, portanto, não pode depender apenas de ocultar o botão no cliente.
- Por agregar dados de CRM, Parceiros, financeiro e logs, o botão é exibido somente para usuários com papel `Admin` ou `CEO`; a rota deve aplicar a mesma restrição no servidor.
- A operação de servidor deve negar por padrão quando não houver sessão válida ou a permissão do módulo não puder ser confirmada.
- O conjunto de colunas deve ser explícito. Nunca serializar objetos Prisma inteiros de modelos de usuário/parceiro relacionados de forma transitiva.
- A resposta deve usar headers de download apropriados, nome de arquivo sanitizado e não deve ser cacheada publicamente.
- Erros retornados ao navegador não devem revelar SQL, estrutura interna, caminhos, IDs de usuário ou conteúdo da base.
- Aplicar mitigação de CSV/Excel formula injection a todo texto controlável por usuário.

---

## Notas Técnicas Verificadas

- A tela e o botão **Novo Cliente** estão em `src/app/PainelAlpha/CadastroClientes/page.tsx`.
- A listagem atual chama `buscarClientes()` em `src/actions/Clientes.ts`; essa função exclui registros com status `Arquivado`, portanto não atende sozinha à exportação integral.
- O modelo `clientes` e suas relações diretas estão em `prisma/schema.prisma`. Relações confirmadas: `socios`, `log_cs`, `logFeedback`, `logAlteracao`, `historicoAlteracoes`, `indicacao`, `crm_oportunidades` e `crm_contatos`.
- O projeto já possui `exceljs`, `xlsx` e `xlsx-js-style` em `package.json`, além de implementações de exportação existentes que podem servir como padrão interno.
- Não foram encontrados os diretórios configurados `docs/architecture/` e `docs/prd/`; por isso, esta story não presume endpoint, estrutura de arquivos adicional ou padrão arquitetural que esses artefatos deveriam definir.
- A regra de permissão do módulo aparece no registry como `permission: 'Cliente'`; a implementação deve localizar e reutilizar o mecanismo real de enforcement do projeto, não apenas confiar nessa referência de UI.
- A formatação de datas usa um mapa explícito por aba/coluna, sem inferência pelo nome do cabeçalho. Datas civis são reconstruídas no calendário local para evitar o erro de um dia causado por UTC; valores inválidos continuam legíveis como texto.

### Project Structure Notes

- A integração visual pertence ao módulo existente `src/app/PainelAlpha/CadastroClientes/`.
- A consulta não deve ser executada diretamente no componente cliente. A localização final da operação de servidor e do gerador deve seguir os padrões encontrados durante a implementação.
- Nenhuma mudança de schema é esperada.

---

## CodeRabbit Integration

**Story Type Analysis:** Full-stack (Frontend + Backend/API + Security), complexidade média/alta por envolver exportação em massa e dados relacionais.

**Agentes sugeridos:**

- `@dev` para implementação e revisão pré-commit.
- `@qa` para validar completude das relações, autorização e arquivo gerado.
- `@architect` somente se a inspeção revelar necessidade de um novo padrão de streaming/geração para grande volume.

**Quality Gates:**

- [ ] Pre-Commit: `coderabbit --prompt-only -t uncommitted`.
- [ ] Pre-PR: `coderabbit --prompt-only --base main`.
- [ ] Nenhum issue CRITICAL pendente; issues HIGH de autorização ou exposição de dados são bloqueadores desta story.

**Foco da revisão:** autorização no servidor, minimização de dados transitivos, completude relacional, formula injection, consumo de memória e tratamento de erros.

---

## Definition of Done

- [ ] Todos os critérios de aceitação demonstrados.
- [ ] Testes automatizados adicionados e aprovados.
- [ ] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` executados conforme os gates do projeto.
- [ ] Revisão de segurança da exportação em massa concluída.
- [ ] Checklist e File List desta story atualizados pelo agente de implementação.
- [ ] Story movida para **Ready for Review** somente após evidências dos gates.

---

## File List Inicial

> Lista preliminar, baseada apenas nos pontos confirmados. O agente de implementação deve atualizá-la com todos os arquivos efetivamente criados/modificados.

| Arquivo | Ação prevista | Finalidade |
|---------|---------------|------------|
| `src/app/PainelAlpha/CadastroClientes/page.tsx` | modificar | Adicionar o botão e os estados de interação da exportação. |
| `src/app/PainelAlpha/CadastroClientes/BotaoExportarDados.tsx` | criar | Executar o download, exibir loading e tratar feedbacks de sucesso, autenticação, autorização e falhas. |
| `src/actions/Clientes.ts` | modificar ou extrair operação dedicada | Consultar, autorizar e preparar os dados completos da exportação. |
| `prisma/schema.prisma` | referência apenas | Confirmar campos/relações; nenhuma alteração prevista. |
| Arquivo de gerador `.xlsx` no módulo/padrão existente | criar, se necessário | Montar workbook e aplicar normalização/segurança. |
| Arquivos de teste correspondentes | criar/modificar | Cobrir autorização, completude relacional e validade do workbook. |
| `src/lib/cs-nps/exportar-dados.ts` | criado | Consulta relacional explícita e geração segura do workbook completo. |
| `src/lib/cs-nps/exportar-dados.ts` | modificado | Incluir dados completos de sócios nas abas Empresas/Socios e estilizar todas as abas com cores semânticas. |
| `src/app/api/cs-nps/exportar/route.ts` | criado | Endpoint GET autenticado e autorizado para download sem cache. |
| `.bibble/memory/architecture.md` | modificado | Registrar o novo endpoint protegido de exportação. |

---

## Dev Agent Record

### Debug Log References

- A preencher.

### Completion Notes

- Backend: criada rota `GET /api/cs-nps/exportar`, protegida por sessão e permissão efetiva `Cliente`, incluindo ativos/arquivados e todas as relações diretas confirmadas. Workbook ExcelJS usa abas por entidade, seleção explícita, preservação de tipos e mitigação de formula injection. Base vazia retorna erro sem gerar arquivo.
- Hardening de segurança: exportação integral restrita adicionalmente a `Admin`/`CEO`; autenticação e autorização permanecem no servidor. Fórmulas com espaços, TAB, CR ou LF iniciais são neutralizadas e células textuais são forçadas como texto. Exportações concluídas geram auditoria sem PII (`userId`, contagem e sucesso); rota usa `maxDuration` e headers anti-cache/indexação.
- Revogação imediata: a rota não confia no papel armazenado no JWT; consulta `usuarios` por `userId` e exige `status = ATIVO` e papel atual `Admin`/`CEO` antes da consulta de clientes. Auditorias de sucesso, negação e falha são best-effort e nunca impedem o download nem incluem conteúdo exportado.
- Refinamento visual e de sócios: a aba Empresas agora contém contagem e resumo multilinha de todos os campos de cada sócio; a aba Socios mantém os campos persistidos e recebe contexto da empresa/serviço. As nove abas compartilham cabeçalho, filtros, freeze, larguras limitadas, alturas dinâmicas, wrap, bordas e zebra. Feedback Google usa SIM/NÃO com verde/vermelho, e status usa a paleta semântica definida no AC-017. A mitigação de fórmulas e `numFmt = "@"` para textos permanecem aplicadas depois da estilização.
- Padronização de datas: as 18 colunas conhecidas foram declaradas por aba e passam a gerar datas Excel reais com `dd/mm/yyyy` ou `dd/mm/yyyy hh:mm`. O parser aceita formatos brasileiro, ISO e objetos `Date`, preserva nulos/vazios, mantém inválidos como texto e evita deslocamento UTC em datas civis. O resumo de sócios também apresenta nascimento em `dd/mm/yyyy`.
- Correção pós-QA: o parser passou a aceitar somente formatos estritos e a validar calendário, horário e offset antes da conversão. Datas Excel são construídas com componentes UTC; instantes Prisma/ISO com fuso são convertidos para o horário civil de `America/Sao_Paulo`, enquanto textos sem fuso preservam seus próprios componentes. Valores inválidos não são normalizados e nascimento vazio continua como “Não informado”.
- Correção final de data civil: colunas `date-only` nunca aplicam timezone. Objetos `Date` usam seus componentes UTC e strings validadas preservam exatamente o dia, mês e ano escritos na fonte, inclusive quando a string contém `Z` ou offset. A conversão para `America/Sao_Paulo` permanece exclusiva das colunas `date-time`.

### Change Log

| Data | Alteração | Autor |
|------|-----------|-------|
| 2026-07-15 | Story criada em Draft a partir do pedido de exportação completa do CS & NPS e das relações verificadas no schema. | River (SM) |
| 2026-07-15 | Exportação enriquecida com dados legíveis de sócios e formatação profissional/semântica em todas as abas. | Echo (Backend) |
| 2026-07-15 | Padronizadas as 18 colunas de data da exportação e a data de nascimento no resumo de sócios, com parsing defensivo e formatos Excel brasileiros. | Echo (Backend) |
| 2026-07-15 | Endurecido o parser de datas após QA: formatos estritos, calendário validado, serialização UTC estável e conversão de instantes para o horário de São Paulo. | Echo (Backend) |
| 2026-07-15 | Datas civis isoladas de timezone para preservar exatamente o calendário da fonte; conversão São Paulo mantida apenas em data/hora. | Echo (Backend) |
