# Story: Importação em lote de Sócios, CS e Feedbacks no CS & NPS

**ID:** STORY-CSNPS-002  
**Epic:** CS & NPS  
**Status:** Ready for Review  
**Prioridade:** Alta  
**Complexidade:** Alta  
**Agente responsável:** Dex  
**Data de criação:** 2026-07-15  

---

## Narrativa

**Como** usuário administrador autorizado do módulo CS & NPS,  
**quero** importar em lote sócios, registros de CS e feedbacks a partir de uma planilha-modelo, revisar exatamente o que será vinculado a cada empresa e remover itens antes da confirmação,  
**para** cadastrar grandes volumes com segurança, rastreabilidade e sem perder o controle sobre o destino de cada registro.

---

## Contexto e Fluxo Esperado

A tela `src/app/PainelAlpha/CadastroClientes/page.tsx` já possui as ações **Novo Cliente** e **Exportar dados**. Esta story acrescenta **Importar em lote** no mesmo topo e cobre o fluxo completo abaixo:

1. O usuário abre o modal de importação.
2. Seleciona qualquer combinação entre **Sócios**, **CS** e **Feedbacks**, desde que pelo menos uma opção esteja marcada.
3. Baixa um modelo `.xlsx` com uma aba fixa de instruções e somente as abas de dados correspondentes às opções selecionadas.
4. Preenche e envia o modelo. Cada linha informa a empresa por **CNPJ ou Razão Social** e os campos da entidade que será importada.
5. O servidor lê e valida o arquivo sem gravar dados, localiza os possíveis registros de `clientes` e devolve uma prévia detalhada.
6. Quando o mesmo CNPJ/razão social corresponder a mais de um cadastro de cliente/serviço, a linha fica marcada como ambígua até o usuário escolher explicitamente o destino correto.
7. O usuário revisa o resumo, remove linhas indesejadas ou inválidas e confirma a gravação apenas quando não houver pendências bloqueadoras.
8. O servidor repete autorização e validação, grava todas as linhas restantes em transação, registra auditoria e a tela atualiza seus dados.

Para representar uma empresa com vários sócios, o modelo usa **uma linha por sócio** e permite repetir o mesmo CNPJ ou razão social em quantas linhas forem necessárias. A repetição identifica sócios distintos e não deve ser tratada como duplicidade por si só.

### Contrato mínimo das abas do modelo

| Aba | Colunas | Regras derivadas do schema atual |
|-----|---------|----------------------------------|
| `Socios` | `cnpj`, `razaoSocial`, `nome`, `telefone`, `observacao`, `dataNascimento`, `vinculo` | Cada linha cria um registro em `socios`; `nome` é obrigatório. `observacao` é mapeada para o campo persistido `obs`. |
| `CS` | `cnpj`, `razaoSocial`, `colaborador`, `sentimento`, `observacao`, `dataRegistro` | Cada linha cria um registro em `log_cs`; `colaborador` e `sentimento` são obrigatórios. |
| `Feedbacks` | `cnpj`, `razaoSocial`, `colaborador`, `sentimento`, `observacao`, `dataRegistro` | Cada linha cria um registro em `logFeedback`; `colaborador` e `sentimento` são obrigatórios. |

Em todas as abas, pelo menos um dos identificadores `cnpj` ou `razaoSocial` é obrigatório por linha. Quando ambos forem preenchidos, ambos precisam apontar para o mesmo conjunto de candidatos; divergência é erro bloqueador. `dataRegistro` pode usar o default atual do banco quando estiver vazia, e datas preenchidas precisam seguir os formatos aceitos e documentados no próprio modelo/modal.

---

## Critérios de Aceitação

- [x] **AC-001 — Acesso à importação:** A barra de ações do CS & NPS exibe **Importar em lote** no topo, junto de **Novo Cliente** e **Exportar dados**, somente para usuário cujo papel atual no banco seja `Admin` ou `CEO` e que possua a permissão efetiva `Cliente`.
- [x] **AC-002 — Seleção combinável:** O modal permite marcar/desmarcar independentemente **Sócios**, **CS** e **Feedbacks**, aceita qualquer combinação das três opções e bloqueia download/upload enquanto nenhuma opção estiver selecionada.
- [x] **AC-003 — Modelo sob demanda:** O download gera um `.xlsx` com a aba fixa `Instrucoes` e somente as abas de dados selecionadas, com cabeçalhos, instruções de preenchimento, validações e formatos de data claros, sem incluir dados reais da base.
- [x] **AC-004 — Identificação flexível:** Cada linha exige CNPJ ou razão social, sem obrigar os dois. CNPJ é comparado de forma normalizada e razão social por uma normalização determinística documentada; uma busca textual aproximada não pode escolher automaticamente um cliente.
- [x] **AC-005 — Vários sócios:** O modelo e o parser aceitam várias linhas de sócios com o mesmo identificador de empresa, preservam a ordem/linha de origem e produzem um registro de `socios` para cada linha mantida na confirmação.
- [x] **AC-006 — Escopo por aba:** O parser processa apenas as entidades selecionadas. Aba selecionada ausente, cabeçalho obrigatório ausente ou aba não selecionada contendo dados não causa gravação silenciosa; o usuário recebe diagnóstico explícito antes de salvar.
- [x] **AC-007 — Upload e prévia sem mutação:** Ao carregar um `.xlsx`, o sistema valida arquivo, abas, cabeçalhos, tipos, datas, campos obrigatórios e limites antes de devolver a prévia; esta etapa não cria, altera nem remove nenhum registro do banco.
- [x] **AC-008 — Resumo detalhado:** A prévia apresenta, no mínimo, total geral, totais por tipo, linhas válidas, inválidas e ambíguas, número da linha/aba de origem, dados que serão criados, empresa de destino, CNPJ, serviço/cadastro escolhido e mensagens de erro/aviso específicas.
- [x] **AC-009 — Empresa inexistente:** Linha sem correspondência exata por CNPJ/razão social é marcada como inválida e nunca cria uma empresa automaticamente.
- [x] **AC-010 — Cadastro ambíguo:** Quando o identificador corresponder a mais de um registro de `clientes` — por exemplo, mesmo CNPJ em serviços diferentes — a prévia lista os candidatos com identificação suficiente e exige que o usuário selecione um `clienteId`/serviço válido antes da confirmação.
- [x] **AC-011 — Remoção antes de salvar:** O usuário consegue remover individualmente qualquer linha da prévia; totais e agrupamentos são recalculados imediatamente, a linha removida não integra o payload final e a remoção ainda não altera o banco.
- [x] **AC-012 — Confirmação explícita:** O botão **Salvar importação** exibe a quantidade final de registros, fica desabilitado durante processamento e enquanto existir linha inválida/ambígua não removida ou não resolvida, e exige uma ação explícita do usuário.
- [x] **AC-013 — Revalidação no servidor:** A operação de salvar não confia na prévia ou no `clienteId` enviados pelo navegador. Ela repete autenticação, autorização, normalização, validação dos campos e correspondência do cliente, aceitando o destino escolhido somente se ele pertencer ao conjunto de candidatos válidos para o identificador original.
- [x] **AC-014 — Transação atômica:** As linhas restantes são inseridas em uma única transação. Se qualquer inserção falhar, nenhuma linha daquela confirmação permanece gravada e o usuário recebe um erro sem detalhes internos do banco.
- [x] **AC-015 — Resultado final:** Após sucesso, o modal mostra um resumo final com quantidade criada por entidade e por empresa/destino, incluindo serviço e linhas de origem; nenhum dado pessoal adicional além do que já era necessário à revisão é exposto.
- [x] **AC-016 — Auditoria:** Tentativas negadas, falhas técnicas e confirmações bem-sucedidas geram auditoria sem armazenar o conteúdo integral da planilha. O evento de sucesso registra, no mínimo, usuário, tipos importados, contagens por tipo, quantidade de empresas afetadas e sucesso.
- [x] **AC-017 — Atualização da tela:** Ao concluir, os dados da página são recarregados e os novos sócios, CS e feedbacks aparecem nos respectivos detalhes sem exigir atualização manual do navegador.
- [x] **AC-018 — Estados e acessibilidade:** O modal comunica download, upload, validação e salvamento em andamento, apresenta erros acionáveis, preserva foco/fechamento por teclado conforme o padrão de modal do projeto e impede disparos concorrentes acidentais.
- [x] **AC-019 — Limites e arquivo seguro:** Somente `.xlsx` é aceito. Tamanho máximo do arquivo, quantidade máxima de linhas e comprimento máximo de textos são constantes explícitas, documentadas e testadas, preferencialmente alinhadas a precedentes do projeto; extensão, MIME/assinatura, estrutura do workbook e fórmulas/células inesperadas são tratadas de forma defensiva.
- [x] **AC-020 — Autorização em todas as rotas:** Download do modelo, pré-visualização e salvamento exigem sessão válida, usuário `ATIVO`, papel atual `Admin`/`CEO` e permissão efetiva `Cliente`; ocultar o botão na UI não substitui a checagem no servidor.
- [x] **AC-021 — Integridade dos campos:** O backend usa allowlists por tipo, ignora/rejeita colunas não suportadas conforme contrato documentado, não aceita IDs primários vindos da planilha e não permite mass assignment em `socios`, `log_cs`, `logFeedback` ou `clientes`.
- [x] **AC-022 — Sem migration:** A feature usa os modelos `clientes`, `socios`, `log_cs` e `logFeedback` existentes e não requer mudança em `prisma/schema.prisma`.

> **Limite da evidência visual:** os ACs de interface foram verificados por implementação, revisão estática e testes da lógica de revisão. O fluxo visual autenticado não foi executado neste ambiente porque não havia navegador/sessão autenticada disponível; essa checagem permanece para a revisão manual.

---

## Fora do Escopo

- Criar automaticamente empresas que não existam em `clientes`.
- Alterar status, NPS, `feedbackGoogle`, `nomeGoogle` ou outros campos do registro principal de `clientes` como efeito colateral da importação de logs.
- Atualizar ou excluir sócios/CS/feedbacks já persistidos; esta story cria novos registros e permite remover somente linhas ainda pendentes na prévia.
- Importar outras entidades além de `socios`, `log_cs` e `logFeedback`.
- Aceitar CSV, XLS legado, XLSM, macros ou planilhas do Google por URL.
- Criar histórico persistido de “rascunhos de importação” ou nova tabela de importações.
- Garantir idempotência persistente entre confirmações independentes. Sem uma entidade/chave de lote no schema, a UI bloqueia reenvio concorrente e o servidor aplica rate limit por instância, mas uma nova confirmação manual válida cria novos registros.
- Alterar schema ou executar migration.

---

## Tasks / Subtasks

- [x] **Task 1 — Consolidar contrato, limites e autorização (AC: 1–6, 19–22)**
  - [x] Reutilizar/extrair a mesma política server-side da exportação: sessão, usuário ativo, papel atual `Admin`/`CEO` e permissão efetiva `Cliente`.
  - [x] Definir tipos compartilhados para seleção, linhas normalizadas, candidatos, erros e resumo, sem usar `any`.
  - [x] Definir allowlists e obrigatoriedade por aba conforme os modelos Prisma existentes.
  - [x] Localizar precedentes de upload do projeto e registrar constantes explícitas de tamanho, linhas e textos; caso não exista precedente aplicável, documentar a decisão antes de implementá-la.
  - [x] Confirmar que nenhuma mudança de schema é necessária.

- [x] **Task 2 — Gerar o modelo selecionável (AC: 2–6, 19–20)**
  - [x] Implementar operação protegida de download que recebe somente os três tipos permitidos e exige pelo menos um tipo.
  - [x] Gerar a aba fixa `Instrucoes` e apenas as abas de dados selecionadas, com nomes estáveis e cabeçalhos do contrato mínimo.
  - [x] Estilizar cabeçalhos, larguras, datas e instruções/exemplos sem inserir dados reais.
  - [x] Garantir que múltiplos sócios sejam explicados como múltiplas linhas com empresa repetida.
  - [x] Retornar headers de download/anti-cache seguros e nome de arquivo sem entrada livre do usuário.

- [x] **Task 3 — Implementar parsing e pré-visualização server-side (AC: 4–10, 19–21)**
  - [x] Validar arquivo, workbook, abas, cabeçalhos, contagem de linhas e células antes de consultar/gravar dados.
  - [x] Normalizar CNPJ, razão social, textos e datas de modo determinístico, preservando aba e linha de origem.
  - [x] Rejeitar ou tratar defensivamente fórmulas, macros/formatos não suportados, células fora do contrato e valores que excedam limites.
  - [x] Consultar candidatos de `clientes` com seleção explícita de campos e sem escolher automaticamente entre múltiplos serviços.
  - [x] Classificar cada linha como válida, inválida ou ambígua e devolver mensagens acionáveis sem expor SQL/stack trace.
  - [x] Garantir por teste que a prévia é estritamente read-only.

- [x] **Task 4 — Implementar modal e revisão detalhada (AC: 1–12, 18)**
  - [x] Adicionar **Importar em lote** ao grupo administrativo de ações da página.
  - [x] Implementar etapa de seleção combinável e download do modelo.
  - [x] Implementar upload `.xlsx`, estados de progresso e tratamento de erros.
  - [x] Exibir totais, agrupamento por empresa/tipo, destino, serviço, dados da linha e diagnóstico.
  - [x] Oferecer seletor de destino para candidatos ambíguos e validar sua resolução.
  - [x] Permitir remoção individual de linhas e recalcular resumo/estado do botão de salvar.
  - [x] Dividir a interface em componentes coesos, reutilizando modal/botões/tokens existentes e preservando acessibilidade.

- [x] **Task 5 — Salvar em transação e auditar (AC: 12–17, 20–22)**
  - [x] Revalidar autorização e todo o payload no endpoint/operação de confirmação.
  - [x] Reconsultar candidatos e impedir que um `clienteId` adulterado seja usado como destino.
  - [x] Mapear somente campos permitidos para `socios`, `log_cs` e `logFeedback`.
  - [x] Inserir todas as linhas finais em uma transação Prisma única e garantir rollback total em falha.
  - [x] Registrar auditorias de negação, falha e sucesso sem serializar planilha, PII completa ou conteúdo das observações.
  - [x] Retornar resumo final detalhado e revalidar/recarregar `/PainelAlpha/CadastroClientes`.

- [ ] **Task 6 — Testes e gates (AC: 1–22)**
  - [x] Testar seleções e combinações de tipos no gerador/parser.
  - [x] Validar conteúdo e ausência de abas de dados não selecionadas no modelo gerado.
  - [x] Testar vários sócios para a mesma empresa, empresas distintas e linhas repetidas intencionalmente.
  - [x] Testar identificação só por CNPJ, só por razão social, pelos dois coerentes e pelos dois divergentes.
  - [x] Testar empresa inexistente e CNPJ/razão com vários serviços, inclusive resolução e tentativa de `clienteId` adulterado.
  - [x] Testar remoção de linhas, recálculo de totais, bloqueio com pendências e payload final sem removidos.
  - [x] Testar rollback quando uma das inserções falha e sucesso misturando as três entidades.
  - [x] Revisar a proteção para usuário sem sessão, inativo, fora de `Admin`/`CEO` ou sem permissão `Cliente` nas três operações.
  - [x] Testar arquivo corrompido/hostil, abas/cabeçalhos inválidos, datas inválidas, fórmulas, células inesperadas e zip bomb.
  - [x] Testar que a prévia não grava, que sucesso audita somente metadados e que a callback de sucesso recarrega a tela.
  - [x] Executar e documentar `npm run typecheck`, `npm test`, `npm run build` e o fallback `npx next build`; os gates globais não estão todos verdes pelos bloqueios registrados no Dev Agent Record.
  - [x] Executar revisão de segurança e integração por código/testes antes de mover a story para Review.
  - [ ] Executar o fluxo visual completo com navegador e sessão autenticada de Admin/CEO.

---

## Notas Técnicas Verificadas

- A integração visual pertence a `src/app/PainelAlpha/CadastroClientes/page.tsx`; o grupo administrativo já renderiza `BotaoExportarDados` somente para `Admin`/`CEO` no cliente.
- A rota `src/app/api/cs-nps/exportar/route.ts` é o precedente mais próximo para revalidar no servidor a sessão, o status atual do usuário, os papéis `Admin`/`CEO`, a permissão efetiva `Cliente`, auditoria best-effort e headers `no-store`.
- `prisma/schema.prisma` confirma `clientes @@unique([cnpj, servicos])`; portanto, um mesmo CNPJ pode ter mais de um registro por serviço e a escolha automática de um `findFirst` é insegura para esta feature.
- O modelo `socios` possui `nome`, `telefone`, `obs`, `dataNascimento`, `vinculo` e `clienteId`.
- `log_cs` e `logFeedback` possuem `dataRegistro`, `colaborador`, `sentimento`, `observacao` e `clienteId`, com `dataRegistro @default(now())`.
- `package.json` já inclui bibliotecas de planilha usadas no projeto; a implementação deve reutilizar a biblioteca/padrão existente, evitando uma dependência nova sem necessidade.
- O fluxo atual de cadastro de logs está em `src/actions/Clientes.ts`, nas operações `salvarLogCS` e `salvarLogFeedback`. A importação em lote não deve reutilizar SQL inseguro nem ignorar a transação; deve preservar a semântica dos modelos por meio de uma operação dedicada e tipada.
- A importação trabalha apenas com filhos de clientes existentes. Nenhuma migration é prevista.
- Os diretórios configurados `docs/architecture/` e `docs/prd/` não estavam disponíveis na preparação da story. As referências técnicas acima foram verificadas diretamente no schema e nos pontos de integração existentes.

### Decisões de integridade para a implementação

- Identificadores normalizados servem somente para produzir o conjunto de candidatos. A resolução final continua vinculada ao `id` real de `clientes`.
- Uma linha removida existe apenas no estado da revisão e nunca é enviada à confirmação.
- A transação cobre todas as entidades selecionadas e todas as empresas da confirmação; não há sucesso parcial silencioso.
- A resposta de prévia não precisa persistir um rascunho no banco, mas o endpoint de confirmação deve tratar o navegador como não confiável e refazer todas as verificações relevantes.
- Se o colaborador/data do registro forem informados para CS/Feedback, os valores validados são preservados como histórico importado; quando a data estiver ausente, aplica-se o default documentado do modelo.
- O arquivo é limitado a 10 MB e 2.000 linhas; o multipart aceita até 11 MB e o payload de confirmação até 5 MB. O matching consulta no máximo 10.000 clientes por operação.
- O preflight ZIP valida por streaming até 256 entradas, 20 MB por entrada, 50 MB descompactados no total e razão de compressão máxima 100, incluindo verificação do tamanho real em vez de confiar somente nos metadados do ZIP.
- A prévia aplica limite por processo de 5 tentativas por minuto e impede uma importação concorrente para a mesma combinação usuário/IP. Esse mecanismo é defesa em profundidade por instância, não rate limit distribuído.
- A confirmação valida `Origin`, `Host`, `Sec-Fetch-Site`, `Content-Type`, `Content-Length` e o schema do JSON antes de persistir.
- Não foi criada idempotência persistente: sem tabela/chave de lote no schema, uma confirmação manual independente e válida pode gerar novos registros. O contrato da API informa essa limitação explicitamente.

### Project Structure Notes

- Componentes da interface devem permanecer sob `src/app/PainelAlpha/CadastroClientes/`, preferencialmente em um subdiretório dedicado à importação para não ampliar excessivamente `page.tsx`.
- Rotas dedicadas podem seguir `src/app/api/cs-nps/importar/...`, mantendo download, prévia e confirmação com contratos separados.
- Lógica pura de workbook, normalização e validação deve ficar fora dos componentes React e das rotas, sob `src/lib/cs-nps/`, para permitir testes unitários.
- Caso a autorização seja extraída para helper compartilhado, a rota de exportação deve manter o comportamento já entregue.

---

## Testing

### Unitários

- Normalização e validação de CNPJ/razão social.
- Parser das três abas, cabeçalhos e datas.
- Geração do modelo com matriz completa de seleções.
- Classificação de correspondência única, inexistente e ambígua.
- Cálculo do resumo antes/depois de remover ou resolver linhas.
- Allowlist e rejeição de campos/fórmulas/valores acima do limite.

### Integração

- Contratos HTTP de download, prévia e confirmação.
- Autenticação/autorização/revogação em todas as rotas.
- Revalidação do destino, inserções mistas e rollback transacional.
- Auditoria sem conteúdo integral da planilha.

### Interface / Fluxo

- Seleção combinável, upload, estados assíncronos e acessibilidade do modal.
- Resolução de múltiplos serviços, remoção de linha, confirmação e resumo final.
- Atualização dos detalhes do cliente após salvar.

---

## CodeRabbit Integration

### Story Type Analysis

**Primary Type:** API / Full-stack  
**Secondary Type(s):** Frontend, Security, Data Integrity  
**Complexity:** Alta — três contratos de planilha, resolução relacional ambígua, upload não confiável, transação multi-entidade e UI de revisão.

### Specialized Agent Assignment

**Primary Agents:**

- `@dev` — implementação e revisão pre-commit.
- `@architect` — revisão de contrato da prévia/confirmação e fronteira de confiança.

**Supporting Agents:**

- `@ux-expert` — modal, resumo detalhado e acessibilidade.
- `@qa` — matriz de testes, rollback e verificação end-to-end.
- `@github-devops` — revisão pre-PR/push somente quando solicitado.

### Quality Gate Tasks

- [ ] **Pre-Commit (@dev):** executar `coderabbit --prompt-only -t uncommitted` antes de concluir a implementação.
- [ ] **Pre-PR (@github-devops):** executar `coderabbit --prompt-only --base main` antes de criar PR, se houver solicitação de PR.
- [ ] **Security gate:** nenhum achado CRITICAL/HIGH pendente em autenticação, autorização, upload, mass assignment ou seleção do `clienteId`.

### Self-Healing Configuration

- **Primary agent:** `@dev`
- **Mode:** light
- **Max iterations:** 2
- **Timeout:** 15 minutos
- **Severity filter:** CRITICAL
- **Behavior:** CRITICAL = `auto_fix`; HIGH = `document_only`; MEDIUM/LOW = `ignore` no ciclo automático, sem dispensar o gate manual de segurança desta story.

### CodeRabbit Focus Areas

- Autorização uniforme nas três operações e revogação por estado/papel atual.
- Upload malformado, limites de recursos e validação de workbook.
- Revalidação de candidatos e prevenção de IDOR/mass assignment.
- Atomicidade, rollback e ausência de gravação na prévia.
- Contratos TypeScript sem `any`, mensagens sem detalhes internos e auditoria sem PII desnecessária.
- Acessibilidade, estados concorrentes e consistência do resumo/payload após remoções.

---

## Definition of Done

- [ ] Todos os ACs demonstrados com evidências.
- [x] Testes automatizados de unidade/integração crítica aprovados: 19/19.
- [x] `npm run typecheck`, `npm test`, `npm run build` e o fallback `npx next build` executados e documentados; o gate global permanece com falhas preexistentes/ambientais registradas abaixo.
- [x] Revisão de segurança concluída por código/testes para autenticação, upload, IDOR, mass assignment, CSRF/origem, limites e transação.
- [x] Story checklist e File List atualizados com os arquivos realmente criados/modificados.
- [x] Nenhuma migration ou alteração não solicitada em `clientes`.
- [x] Status movido para **Ready for Review**, com a pendência de validação visual autenticada e os bloqueios globais explicitados.

---

## File List Real

| Arquivo | Ação | Finalidade |
|---------|------|------------|
| `src/app/PainelAlpha/CadastroClientes/page.tsx` | modificado | Renderiza o botão administrativo e recarrega clientes pela callback `onImportado`. |
| `src/app/PainelAlpha/CadastroClientes/importacao/BotaoImportarLote.tsx` | criado | Gatilho visual e abertura do fluxo. |
| `src/app/PainelAlpha/CadastroClientes/importacao/ModalImportacaoLote.tsx` | criado | Orquestra seleção, arquivo, revisão, salvamento e resultado. |
| `src/app/PainelAlpha/CadastroClientes/importacao/SelecaoTiposImportacao.tsx` | criado | Seleção combinável de Sócios, CS e Feedbacks. |
| `src/app/PainelAlpha/CadastroClientes/importacao/EtapaArquivoImportacao.tsx` | criado | Download do modelo e upload do XLSX. |
| `src/app/PainelAlpha/CadastroClientes/importacao/ResumoImportacao.tsx` | criado | Filtros, totais, revisão e confirmação da prévia. |
| `src/app/PainelAlpha/CadastroClientes/importacao/LinhaImportacaoCard.tsx` | criado | Exibe linha, diagnóstico, destino ambíguo e remoção. |
| `src/app/PainelAlpha/CadastroClientes/importacao/ResultadoImportacao.tsx` | criado | Resumo final por tipo e empresa. |
| `src/app/PainelAlpha/CadastroClientes/importacao/api-importacao.ts` | criado | Cliente HTTP tipado para modelo, prévia e confirmação. |
| `src/app/PainelAlpha/CadastroClientes/importacao/calculos.ts` | criado | Totais, resolução e montagem do payload sem linhas removidas/inválidas. |
| `src/app/PainelAlpha/CadastroClientes/importacao/constantes.ts` | criado | Rótulos e opções da interface. |
| `src/app/api/cs-nps/importar/modelo/route.ts` | criado | `GET` protegido para gerar o modelo selecionado. |
| `src/app/api/cs-nps/importar/previsualizar/route.ts` | criado | `POST` multipart protegido, limitado e sem mutação. |
| `src/app/api/cs-nps/importar/salvar/route.ts` | criado | `POST` JSON com origem validada, transação, auditoria e revalidação da página. |
| `src/app/api/cs-nps/exportar/route.ts` | modificado | Passa a reutilizar a autorização/auditoria compartilhada, preservando a exportação. |
| `src/lib/cs-nps/autorizacao.ts` | criado | Sessão, usuário ativo, papel Admin/CEO, permissão `Cliente`, no-store e auditoria best-effort. |
| `src/lib/cs-nps/importacao-tipos.ts` | criado | Contratos compartilhados da seleção, prévia, confirmação e resumo. |
| `src/lib/cs-nps/importar-dados.ts` | criado | Workbook, schemas, parsing, matching, limites, transação e resumo. |
| `src/lib/cs-nps/preflight-xlsx.ts` | criado | Preflight ZIP/XLSX por streaming e bloqueio de zip bomb/tamanho falso. |
| `src/lib/cs-nps/importacao-rate-limit.ts` | criado | Rate limit e exclusão concorrente por usuário/IP na instância. |
| `tests/cs-nps/importar-dados.test.ts` | criado | Modelo, parsing, datas, ambiguidade, adulteração de destino, transação e auditoria. |
| `tests/cs-nps/preflight-xlsx.test.ts` | criado | XLSX normal e zip bomb. |
| `tests/cs-nps/calculos.test.ts` | criado | Totais, resolução, remoção e exclusão de linhas inválidas. |
| `scripts/smoke-cs-nps-zip-streaming.mjs` | criado | Smoke real do modelo até a linha 2.001 e zip bomb com metadado falsificado. |
| `vitest.config.ts` | criado | Runner Vitest, alias `@` e cobertura V8 do núcleo da feature. |
| `package.json` | modificado | Scripts `typecheck`, `test`, `smoke:cs-nps-importacao` e dependências de teste/preflight. |
| `package-lock.json` | modificado | Lock de `yauzl`, tipos, Vitest e cobertura V8. |
| `docs/stories/story-cs-nps-importacao-em-lote.md` | criado/modificado | Story, rastreabilidade, evidências, limitações e File List. |
| `prisma/schema.prisma` | não modificado | Nenhuma migration necessária. |

---

## Dev Agent Record

### Debug Log References

- `npm test`: **PASS**, 3 arquivos e **19/19 testes** aprovados, com cobertura V8 configurada para parser/persistência, preflight e cálculos da revisão.
- `npm run smoke:cs-nps-importacao`: **PASS** — `modelo-normal-formatacao-2001: aprovado` e zip bomb com metadado falsificado bloqueada como `ZIP_BOMB`.
- `npm run typecheck`: **FAIL global** por 3 erros preexistentes e não relacionados em `ExclusaoFiscal`, `HabilitacaoRadar` e `ModalPerfilColaborador`; não foram identificados erros novos no escopo da importação.
- `npm run build`: **FAIL ambiental** durante `prisma generate`, com `EPERM` sobre a DLL do Prisma Client bloqueada por processo no Windows.
- `npx next build`: **PASS**, usado como fallback para validar a compilação Next.js sem repetir o `prisma generate` bloqueado.
- `npm run lint`: o gate global permanece afetado pelo passivo preexistente do repositório; a revisão do escopo não introduziu bloqueador conhecido da feature.
- Validação visual autenticada: **não executada**, pois o ambiente não disponibilizou navegador com sessão válida de Admin/CEO. Deve ser realizada na revisão manual.

### Completion Notes

- Foi entregue um fluxo em quatro estados: seleção combinável de tipos, download/upload, revisão detalhada removível e resultado final. O botão fica no grupo administrativo ao lado da exportação e chama `carregarDados` após sucesso.
- O modelo Excel contém uma aba fixa `Instrucoes` e apenas as abas de dados escolhidas (`Socios`, `CS`, `Feedbacks`). CNPJ/telefone permanecem texto até a linha 2.001, datas recebem formato brasileiro e sentimento possui validação de lista.
- A prévia normaliza CNPJ/razão social, preserva aba/linha, aceita vários sócios da mesma empresa, detecta empresa inexistente ou identificadores conflitantes e exige seleção explícita quando há mais de um cliente/serviço candidato.
- A revisão exibe totais e filtros, permite remover itens, resolve ambiguidades e jamais inclui linha inválida no payload, mesmo com seleção de `clienteId` injetada.
- A confirmação revalida o ator e o destino dentro da transação, usa allowlists e `createMany` para `socios`, `log_cs` e `logFeedback`, registra auditoria de metadados e retorna resumo por empresa/tipo. Falha em qualquer entidade aborta o lote inteiro.
- As três rotas revalidam sessão, status `ATIVO`, papel atual `Admin`/`CEO` e permissão efetiva `Cliente`. A confirmação também valida origem/headers para mitigar CSRF e todas usam `no-store`.
- Foram adicionados limites de arquivo/linhas/payload, preflight ZIP por streaming, defesa contra zip bomb/tamanho falsificado, rate limit por instância e bloqueio de importações concorrentes por usuário/IP.
- A idempotência persistente ficou explicitamente fora do escopo: nenhuma tabela/chave de lote foi criada. A UI evita duplo clique e o rate limit reduz concorrência, mas uma nova confirmação manual válida pode importar novamente as mesmas linhas.
- Não houve alteração de schema Prisma nem criação automática de empresas. A importação cria somente filhos nos três modelos solicitados e não altera NPS, status ou `feedbackGoogle` do cliente.
- A implementação está pronta para revisão de código e teste manual autenticado. Os bloqueios globais de typecheck/build foram documentados e o fallback Next.js compilou com sucesso.

### Change Log

| Data | Alteração | Autor |
|------|-----------|-------|
| 2026-07-15 | Story criada em Draft a partir do pedido de importação em lote de Sócios, CS e Feedbacks, com prévia removível, resolução de destino, transação e auditoria. | River (SM) |
| 2026-07-15 | Implementado fluxo full-stack de importação em lote, modelo seletivo, prévia detalhada, resolução de destinos, remoção de linhas, transação e resumo final. | Echo / Nova |
| 2026-07-15 | Endurecidos upload e confirmação com autorização compartilhada, validação de origem, limites, rate limit, preflight streaming e proteção contra zip bomb/IDOR/mass assignment. | Echo / Anubis |
| 2026-07-15 | Adicionados Vitest, 19 testes automatizados e smoke do modelo/ZIP; build fallback aprovado e bloqueios globais documentados. | Sage / Forge |
| 2026-07-15 | Story atualizada para Ready for Review com checklist, evidências, limitações e File List real. | River (SM) |
