# Story: Estoque Geral — reativação, preservação e reformulação completa do módulo existente

## Status

InProgress

## Executor Assignment

executor: `@dev`
quality_gate: `@architect`
quality_gate_tools: `["inventory:doctor", "inventory:list", "inventory:movements", "inventory:kit-validate", "lint", "typecheck", "tests", "build", "coderabbit"]`

## Story

**Como** responsável autorizado pela operação e pelo patrimônio da Alpha,
**quero** reativar e evoluir o módulo de estoque já existente para uma central geral de inventário em rota própria, preservando dados, integrações, links legados e funcionalidades válidas,
**para que** a empresa consiga saber o que possui, quanto está disponível, onde cada item está, quem o utiliza, o que foi movimentado, mantido ou baixado e se cada kit está completo.

## Contexto e objetivo

O estoque não é greenfield. Existe uma implementação em `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque/page.tsx`, apoiada por `src/actions/Estoque.ts` e pelos models Prisma `Categoria`, `ProdutoEstoque` e `ListaCompra`. A evolução deve ocorrer sobre esse módulo; ficam proibidos `/estoque-v2`, `/novo-estoque`, `/inventory-new` e qualquer base paralela.

O módulo atual nasceu acoplado ao painel de Serviços Gerais e à Lista de Compras. A nova entrega deve transformá-lo no **Estoque Geral do Painel Alpha**, sem quebrar esse fluxo legado. O resultado precisa atender tanto itens quantitativos/consumíveis quanto unidades individuais/patrimoniais e acrescentar movimentação rastreável, atribuição, devolução, manutenção, baixa, fotos por arquivo, tags que funcionam como modelos de kit, instâncias de kit, busca, filtros, histórico e auditoria.

A rota canônica da central passa a ser `/PainelAlpha/Estoque`. Isso não cria um segundo módulo: a implementação, domínio, dados e permissões continuam únicos. A rota legada `/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque` deve permanecer apenas como redirecionamento server-side para a canônica, preservando bookmarks e links existentes durante a transição.

A ordem vinculante é: segurança e integridade dos dados → CLI canônica → observabilidade/auditoria → interface. A UI não pode possuir regra de negócio exclusiva: comandos e UI devem usar os mesmos contratos e serviços transacionais.

## Investigação consolidada do legado

### EXISTE E FUNCIONA

- A URL legada existente é `/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque`, implementada em `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque/page.tsx`; ela é o ponto de compatibilidade que será convertido em redirecionamento para `/PainelAlpha/Estoque`.
- O cadastro/edição atual persiste nome, categoria, quantidade, estoque mínimo, unidade e imagem; há listagem, busca por nome, filtro por categoria e indicadores calculados a partir dos registros reais.
- Categorias podem ser cadastradas/listadas e a remoção falha quando há produtos relacionados.
- Estoque mínimo alimenta `ListaCompra`; o painel de Serviços Gerais exibe a Lista de Compras e `RegistrarCompra` soma a quantidade comprada ao produto.
- O banco ativo `banco-alpha-alphacomex` contém 3 produtos, 3 categorias e 0 registros em `ListaCompra`; esses dados são baseline de compatibilidade e não podem ser substituídos por mocks.
- O projeto já possui sessão NextAuth, registry/permissões efetivas, model genérico `Auditoria`, componentes shadcn/Radix, React Query, Vercel Blob e a abstração server-only de storage em `src/lib/storage/`.

### EXISTE MAS ESTÁ QUEBRADO OU INSEGURO

- `src/actions/Estoque.ts` não autentica, não autoriza por módulo/capacidade e recebe payloads sem Zod; conhecer uma action/ID é suficiente para tentar ler ou mutar estoque.
- `SalvarProduto` sobrescreve `quantidade` diretamente, sem movimento, usuário, valor anterior ou motivo. `RegistrarCompra` também altera o saldo sem histórico.
- `DeletarProduto` executa exclusão física; itens com histórico futuro não podem seguir esse comportamento.
- A imagem é apenas uma URL digitada; não há seleção local, preview, validação de MIME/tamanho, troca ou remoção segura do arquivo.
- A listagem carrega todos os produtos e filtra no cliente; não há paginação server-side, busca ampla nem filtros operacionais.
- Os caminhos passados a `revalidatePath` são inconsistentes com a URL real.
- Não foram encontrados testes automatizados específicos do estoque.

### EXISTE MAS PRECISA SER ADAPTADO

- `ProdutoEstoque` deve permanecer a raiz compatível dos 3 registros atuais, com transformação aditiva para os novos campos e comportamentos.
- `Categoria` deve ser preservada e ampliada somente se os requisitos do gerenciamento simples exigirem; categorias iniciais sugeridas pelo usuário não autorizam apagar ou renomear as existentes.
- `ListaCompra` e a tela legada de compras devem continuar integradas ao estoque mínimo e à confirmação de entrada, agora através da operação transacional de movimento.
- O campo `imagem` e URLs já persistidas devem continuar renderizando; novos uploads devem usar o mecanismo de arquivos já existente, sem storage paralelo.
- A rota legada e os consumidores em `painelTarefaSG/page.tsx`, `painelTarefaSG/Carrinho/page.tsx` e `PainelTarefaC/page.tsx` devem permanecer compatíveis; links novos apontam para `/PainelAlpha/Estoque`, e acessos antigos são redirecionados sem duplicar UI ou domínio.
- O acesso atualmente está implícito em `ServiçosGerais`; o módulo não está registrado separadamente em `MODULOS_REGISTRY`. A reativação deve usar o registry/permissões efetivas existente e preservar acesso legado comprovado durante a transição, sem criar um autorizador paralelo.

### NÃO EXISTE E SERÁ CRIADO

- Contratos de domínio, serviço transacional e CLI do inventário.
- Tipos de item quantitativo e individual/patrimonial, unidades individualizadas, localização, fornecedor, aquisição, status e arquivamento.
- Ledger de movimentações imutável, atribuições/uso, devolução por componente, manutenção, transferência, perda/dano e baixa.
- Tags como modelos de kit, requisitos obrigatório/opcional, instâncias montadas, validação de completude, entrega e devolução parcial.
- Upload de foto por arquivo com preview e ciclo de troca/remoção.
- Busca global, filtros, paginação, abas, drawer/detalhes e histórico central.
- Permissões por capacidade, auditoria das ações importantes, testes e observabilidade operacional.
- Não existe migration versionada que crie `Categoria`, `ProdutoEstoque` e `ListaCompra`; qualquer baseline/adaptação deve reconciliar o schema real sem tentar recriar ou dropar as tabelas existentes.

## Decisões vinculantes

- Evoluir o módulo existente preservando IDs, registros e integrações. `/PainelAlpha/Estoque` é a única rota canônica; `/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque` permanece somente como redirect server-side para ela. É proibido manter duas composições de UI, dois domínios ou dois estoques.
- Registrar uma única entrada `estoque` no `MODULOS_REGISTRY`, com `href: "/PainelAlpha/Estoque"` e a permissão efetiva existente do projeto. A ocultação só se aplicava ao rollout técnico anterior; após a autorização explícita de reativação, a entrada fica visível exclusivamente para usuários efetivamente autorizados. O redirect legado termina na mesma checagem de acesso da rota canônica.
- Nenhuma quantidade muda por edição cadastral. Saldo muda exclusivamente por operação transacional que grava movimento e auditoria no mesmo commit.
- O saldo nunca pode ficar negativo, salvo regra futura explícita e documentada; esta story não autoriza saldo negativo.
- Dados cadastrais podem ser editados sem reescrever ou apagar histórico.
- Item relacionado a movimento, atribuição, unidade individual, tag ou kit é arquivado/inativado, não apagado fisicamente.
- `ListaCompra` continua sendo consumidor do estoque mínimo. Confirmar uma compra deve gerar `ENTRADA`, e não uma atualização direta de saldo.
- Tag/modelo não cria item físico. Ela referencia item/categoria elegível existente; kit montado é uma instância separada e referencia unidades ou quantidades efetivamente selecionadas.
- Para item patrimonial/individual, entrega muda o estado da unidade selecionada; para consumível/quantitativo, entrega/consumo gera a saída correspondente. Nunca decrementar duas vezes.
- Upload usa a estratégia de storage do projeto após inventário dos mecanismos existentes. URL antiga continua válida; arquivos aceitos: PNG, JPG/JPEG e WEBP, com limite configurado e validado no cliente e no servidor.
- Permissões usam `MODULOS_REGISTRY`, sessão oficial e permissões efetivas. Ocultar botão não substitui autorização server-side.
- Indicadores e alertas são calculados somente de dados persistidos; nenhum número fictício ou mock é permitido em produção.
- Interface em português, alinhada ao Painel Alpha: navy escuro, azul Alpha, profundidade moderada, ícones consistentes, legibilidade, foco visível, microinterações reduzíveis e sem estética gamer.
- Operações canônicas devem existir primeiro via CLI e compartilhar o mesmo domínio da UI. A UI só começa após contratos, ledger, autorização e CLI passarem nos testes.

## Gate Vault — obrigatório antes de qualquer banco

Esta story provavelmente exige evolução aditiva do banco, mas **não autoriza executar DDL, migration, seed, backfill ou mutação em massa**. Antes desse passo o executor deve pausar, acionar `Vault` e apresentar ao usuário:

1. ambiente e banco exatos (`banco-alpha-alphacomex` ou outro alvo confirmado);
2. inventário das tabelas/colunas/índices reais e divergência em relação ao `prisma/schema.prisma`;
3. migration e transformação propostas, comandos exatos, impacto, locks/indisponibilidade, risco e alternativa sem DDL;
4. rollback testado, incluindo como restaurar dados e como reverter leitura/escrita da aplicação;
5. backup completo em `database-backups/pre-change/`, criado e verificado por restauração há no máximo 48 horas;
6. confirmação explícita e específica do usuário depois de todo o relatório.

O gate bloqueia também qualquer normalização em massa dos 3 produtos existentes. São proibidos drop/reset/truncate, recriação destrutiva, perda de IDs e remoção de registros. Backups `pre-change` não participam da limpeza automática de backups diários.

## Modelo de domínio alvo

- **Item**: cadastro comum, classificado como `QUANTITATIVO` ou `INDIVIDUAL`, com nome, descrição, categoria, subcategoria opcional, marca, modelo, código interno, unidade, localização padrão, status, mínimo, foto, observações, aquisição, valor e fornecedor.
- **Unidade individual**: pertence a um item individual; possui serial/patrimônio únicos quando informados, status, localização, foto opcional, responsável atual e histórico próprio.
- **Saldo/local**: quantidade disponível e em uso por item/localização. O saldo materializado, se adotado, é projeção do ledger e deve ser conciliável.
- **Movimento**: evento imutável com tipo, item/unidade, quantidade, antes/depois, ator, data/hora, origem, destino, colaborador, observação/motivo e correlação com kit/operação.
- **Atribuição**: vínculo ativo ou encerrado entre item/unidade/kit e colaborador/setor/local, com entrega, quantidade, condição de devolução, responsável pelo registro e observação.
- **Tag/modelo de kit**: nome, descrição, cor, ícone e categoria opcionais; seus requisitos referenciam item/categoria elegível, quantidade e obrigatoriedade.
- **Instância de kit**: numeração legível, modelo, status de completude/uso/devolução, componentes físicos selecionados, responsável/setor/local e histórico.
- **Auditoria**: ator, ação, alvo, valores anterior/novo sanitizados, data/hora, correlação e metadados seguros. O model genérico atual pode ser reutilizado apenas se suportar consultas e integridade exigidas; essa decisão deve ser validada antes do gate Vault.

## Acceptance Criteria

1. A investigação é registrada e confirmada antes de implementação: páginas, rotas, actions/APIs, componentes, models, migrations, storage, permissões, validações, integrações, dados atuais e consumidores são mapeados, sem remover código por mera aparência de desuso.
2. A entrega cria a composição canônica exclusivamente em `src/app/PainelAlpha/Estoque/page.tsx`. `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque/page.tsx` não mantém componentes próprios: executa redirect server-side reversível para `/PainelAlpha/Estoque`, preservando links legados. Não existe segunda UI, tabela, domínio ou serviço de estoque.
3. Os 3 produtos, 3 categorias e seus IDs/campos existentes continuam legíveis e editáveis após a mudança; `ListaCompra` e suas telas/consumidores continuam operacionais.
4. Qualquer alteração estrutural/migration/backfill/mutação em massa permanece bloqueada até relatório Vault, backup completo verificado com até 48 horas, rollback e confirmação explícita; a migration aprovada é aditiva, idempotente onde aplicável e não usa drop/reset/truncate.
5. Existe uma camada de domínio server-only compartilhada pela CLI, actions/APIs e UI; nenhum componente React contém a única implementação de saldo, kit, autorização ou auditoria.
6. Antes da UI reformulada, CLIs documentadas oferecem ao menos `doctor`, listagem/busca paginada, criação/edição cadastral, entrada, saída/ajuste, atribuição/devolução, manutenção/retorno/baixa, histórico, criação/validação de modelo/instância de kit e reconciliação dry-run, com JSON estável, exit codes e saída sem dados sensíveis.
7. O cadastro rápido suporta nome, descrição, categoria, subcategoria opcional, marca, modelo, código interno, patrimônio e serial quando aplicáveis, tipo de item, quantidade inicial, quantidade mínima, unidade, localização, status, foto, observações, aquisição, valor e fornecedor; campos avançados ficam em seção secundária sem bloquear o fluxo principal.
8. O domínio diferencia `QUANTITATIVO` de `INDIVIDUAL`: consumíveis controlam quantidade e patrimônios controlam unidades com serial/patrimônio, status, responsável, foto e histórico próprios; restrições impedem serial/patrimônio duplicado.
9. Criação com quantidade inicial não insere saldo opaco: registra movimento inicial `ENTRADA` ou `AJUSTE_INICIAL` equivalente documentado, ator e antes/depois. Edição cadastral posterior não altera quantidade.
10. Ações explícitas cobrem `ENTRADA`, `SAÍDA`, `EM_USO`, `DEVOLUÇÃO`, `TRANSFERÊNCIA`, `AJUSTE`, `BAIXA`, `MANUTENÇÃO`, `RETORNO_DE_MANUTENÇÃO`, `PERDA`, `DANO` e `OUTRO`; cada uma valida sua semântica, exige motivo quando aplicável e grava movimento.
11. Todo movimento grava item/unidade, quantidade, tipo, usuário autenticado, timestamp, origem, destino quando aplicável, colaborador relacionado quando aplicável, observação, valor anterior e novo valor; atualização de saldo/estado, movimento e auditoria são atômicos.
12. Concorrência é protegida: duas operações simultâneas não geram saldo perdido ou negativo, reenvio não duplica movimento e conflito retorna erro explícito/reconciliável.
13. `+ Adicionar quantidade` solicita quantidade, local e observação; `- Remover quantidade` solicita quantidade, motivo e destino/responsável quando aplicável; ajuste exige justificativa e não aceita valores inválidos.
14. `EM USO` exige colaborador, setor, local, data de entrega, quantidade/unidade e observação opcional; não há atribuição ativa anônima. A aba Em uso mostra foto, item, responsável, setor, entrega, status e ação.
15. Devolução registra data, ator e condição `BOM`, `COM_AVARIA`, `NECESSITA_MANUTENÇÃO` ou `DANIFICADO`; atualiza saldo/estado uma única vez e encaminha automaticamente para manutenção/dano quando a condição justificar.
16. Transferência exige origem e destino diferentes e mantém total; manutenção exige motivo, data, fornecedor opcional e observação; retorno encerra a manutenção; baixa exige motivo `DANIFICADO`, `DESCARTADO`, `EXTRAVIADO`, `FIM_DE_VIDA` ou `OUTRO` e preserva histórico.
17. Status suportam Disponível, Em uso, Reservado, Em manutenção, Danificado, Baixado, Extraviado e Sem estoque; o estado exibido é coerente com tipo, unidade, saldo e atribuições, sem status impossível ou calculado por mock.
18. Quantidade mínima gera alerta somente quando o disponível real satisfaz a regra documentada; cartões e contadores de itens cadastrados, disponíveis, em uso e estoque baixo são compactos e derivados da consulta real.
19. O upload permite selecionar PNG, JPG/JPEG ou WEBP do computador, mostra preview antes de salvar, valida MIME real/extensão/tamanho no servidor, rejeita arquivo inválido e permite trocar/remover a foto; utiliza o storage já existente, gera chave segura e não quebra URLs legadas.
20. Lista e detalhes usam thumbnail dimensionada/lazy-loaded, fallback por categoria sem foto e imagem maior/zoom no drawer sem baixar o original gigante desnecessariamente; remoção/substituição de blob só ocorre após verificar ownership, referências e sucesso persistente.
21. Categorias existentes são preservadas. Caso o gerenciamento atual seja insuficiente, a interface permite gerenciar categorias como TI, Mobiliário, Telefonia, Periféricos, Material Administrativo, Equipamentos, Consumíveis e Outros sem duplicar nomes nem inserir seed destrutivo.
22. Tags/modelos de kit possuem nome, descrição, cor, ícone e categoria opcionais e identidade visual. Requisitos referenciam estoque existente, com quantidade necessária e `OBRIGATÓRIO`/`OPCIONAL`; criar/editar tag não duplica item físico.
23. A montagem cria uma **instância de kit** separada do modelo, com identificador legível, e permite selecionar unidades patrimoniais ou quantidades consumíveis elegíveis sem dupla alocação.
24. A validação compara requisitos do modelo com componentes selecionados, mostra `n/m` por requisito, obrigatório ausente, lista do que falta, percentual real e status `KIT_INCOMPLETO` ou `KIT_COMPLETO`; opcionais não impedem completude.
25. Um kit pode ser atribuído a colaborador, setor e local. Na entrega, cada componente gera os movimentos/atribuições coerentes com sua natureza: unidade patrimonial vai para Em uso e consumível gera saída; a operação é atômica ou falha sem entrega parcial silenciosa.
26. Devolução de kit verifica cada componente e sua condição, registra devolvidos e ausentes e mantém `DEVOLUÇÃO_PENDENTE` até resolver obrigatórios/componentes entregues; perda, dano ou manutenção geram os respectivos movimentos sem dupla entrada.
27. Tags que não são kits continuam possíveis para agrupamento futuro (`Equipamentos TI`, `Itens Críticos`, `Reserva`), mas a implementação atual entrega composição, montagem, validação, atribuição e devolução de kits reais.
28. A página principal mostra “Estoque Alpha”, o subtítulo “Gestão de equipamentos, materiais e patrimônios da empresa.” e ações `+ Novo Item`, `+ Nova Tag / Kit` e `Movimentar estoque`, seguidas apenas por indicadores compactos e pelas abas Itens, Tags / Kits, Em uso e Movimentações.
29. A aba Itens exibe foto, nome, categoria, disponível, em uso, total, localização, status, tags e ações; clique abre drawer/página com foto, quantidades, localização, serial/patrimônio, tags, responsáveis, histórico, observações e ações autorizadas.
30. A aba Tags / Kits exibe cards com requisitos obrigatórios/opcionais, kits completos/incompletos calculados e ações Ver, Montar Kit e Editar. A tela de montagem mostra requisitos, progresso, faltantes e ação para adicionar item.
31. A aba Movimentações apresenta histórico central paginado com tipo, delta/item ou kit, ator e data/hora; o detalhe do item/unidade/kit apresenta seu histórico paginado sem carregar todo o histórico da empresa.
32. Busca server-side encontra nome, código, serial, patrimônio, categoria, responsável e tag. Filtros combináveis cobrem categoria, status, localização, responsável, tag, com estoque, sem estoque, estoque baixo e manutenção; limpar filtros restaura a consulta paginada.
33. Listagem, busca e histórico usam paginação/cursor e consultas/índices avaliados para crescimento; imagens usam lazy loading e o cliente nunca recebe o banco inteiro para filtrar localmente.
34. Empty, loading, error e retry states existem para itens, tags, uso e movimentos, com mensagens amigáveis e sem fabricar dados.
35. O módulo é registrado uma única vez no sistema atual de módulos/permissões, sob a rota canônica `/PainelAlpha/Estoque`, com estratégia de compatibilidade aprovada para usuários legados de `ServiçosGerais`; página canônica, redirect legado, CLI e todas as mutações convergem para a mesma autorização server-side e exigem sessão, usuário ativo, permissão/capacidade e validação. A UI oculta ações não permitidas, e o item do registry fica visível somente para usuários efetivamente autorizados.
36. Inputs de actions/APIs/CLI são validados com Zod ou padrão canônico equivalente; IDs, usuário, saldo, origem, destino e ownership são resolvidos no servidor. Respostas não expõem stack, tokens, chaves de storage ou dados de outro usuário.
37. Todas as ações importantes geram auditoria pesquisável com ator, ação, data/hora, alvo, valor anterior/novo quando aplicável e correlation ID: cadastro/edição/arquivamento, movimento, transferência, atribuição/devolução, manutenção/baixa, foto, categoria, tag/modelo e instância de kit.
38. Itens com qualquer relação/histórico são arquivados/inativados; exclusão física só pode ocorrer em registro sem relações e após confirmação, ou não é oferecida. Código legado só é removido após prova de ausência de consumidor, integração e dado relacionado.
39. A composição visual usa componentes coerentes (header, filtros, lista/row, drawer, formulário, modal de movimento, tags, editor, builder/validator, uso e histórico), sem componente monolítico; componentes Client ficam restritos às interações necessárias.
40. A interface é utilizável em 1920×1080, 1600×900, 1440×900 e 1366×768 e permanece funcional em tablet; teclado, foco, labels, contraste, Esc, leitor de tela e `prefers-reduced-motion` são cobertos.
41. Compatibilidade regressiva cobre cadastro, edição cadastral, entrada por compra, lista de compras, categorias, busca, alerta real de mínimo e leitura de imagem URL. Nenhum mock permanece no bundle/caminho de produção.
42. Testes automatizados cobrem todos os fluxos funcionais e negativos da matriz desta story, inclusive dados legados, autorização, concorrência, atomicidade, arquivos inválidos, paginação e kit incompleto/completo.
43. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam, juntamente com CLIs do inventário; CodeRabbit não possui achado CRITICAL aberto e story/checklist/File List são atualizados antes de conclusão.

## Tasks / Subtasks

- [x] Task 1 — Congelar baseline e completar investigação read-only (AC: 1–3, 41)
  - [x] Inventariar rota, imports, consumidores, actions, models, banco real, permissões, storage, auditoria, testes e links de navegação.
  - [x] Registrar snapshot lógico dos 3 produtos/3 categorias/0 ListaCompra por IDs e campos, sem expor dados sensíveis.
  - [x] Exercitar read-only o cadastro/listagem/categoria/ListaCompra atual e classificar cada função nos quatro estados do diagnóstico.
  - [x] Provar dependências antes de remover qualquer arquivo ou função.

- [x] Task 2 — Contratos de domínio e invariantes (AC: 5, 7–18, 22–27, 36)
  - [x] Definir schemas Zod, enums e comandos/resultados para item, unidade, movimento, atribuição, tag/modelo, requisito, kit e componente.
  - [x] Definir matriz tipo de item × movimento × efeito em disponível/em uso/total/status.
  - [x] Definir idempotência, concorrência, transação, invariantes de saldo e erros estáveis antes da UI.
  - [x] Criar testes unitários de domínio e propriedades críticas.

- [x] Task 3 — CLI First (AC: 5–6, 11–18, 22–27, 31–33)
  - [x] Implementar `inventory:doctor`, list/search, histórico e reconciliação dry-run.
  - [x] Implementar comandos canônicos de cadastro e movimento usando o mesmo serviço da aplicação.
  - [x] Implementar comandos de tag/modelo, montagem e validação de kit.
  - [x] Garantir JSON/exit codes sanitizados e executar a suíte CLI antes de qualquer composição visual.

- [x] Task 4 — Plano de dados e checkpoint Vault (AC: 3–4, 8–12, 21–27, 37–38)
  - [x] Comparar schema Prisma com `banco-alpha-alphacomex`, incluindo a ausência de migration versionada dos três models legados.
  - [x] Elaborar migration aditiva e transformação preservando IDs/dados e um rollback real.
  - [x] Acionar Vault, gerar/verificar backup de até 48 horas e aguardar confirmação explícita.
  - [x] Somente após aprovação, aplicar a migration autorizada e validar contagens, constraints, índices e leitura dos registros antigos.

- [x] Task 5 — Serviço transacional de movimentos e compatibilidade da Lista de Compras (AC: 9–18, 21, 37, 41)
  - [x] Substituir mutações diretas por serviço transacional com ledger, auditoria e idempotência.
  - [x] Adaptar `SalvarProduto` para edição cadastral sem saldo e `RegistrarCompra` para `ENTRADA` registrada.
  - [x] Preservar e testar gatilho real de estoque mínimo/ListaCompra.
  - [x] Implementar arquivamento seguro e bloqueio de exclusão relacionada.

- [x] Task 6 — Autenticação, autorização e auditoria (AC: 35–38)
  - [x] Definir acesso compatível entre `ServiçosGerais` e o novo registro/capacidades do Estoque Geral.
  - [x] Registrar `estoque` no `MODULOS_REGISTRY` com `href` canônico `/PainelAlpha/Estoque`, visível somente para usuários efetivamente autorizados, sem criar autorização paralela.
  - [x] Exigir sessão, usuário ativo e permissão em página, action/API e CLI mutável.
  - [x] Validar inputs/ownership no servidor e testar acesso negado/IDOR.
  - [x] Implementar auditoria consultável e logs sanitizados com correlation ID.

- [x] Task 7 — Upload e ciclo de vida da foto (AC: 19–20, 36)
  - [x] Inventariar e selecionar o mecanismo de storage já existente; documentar provider, limite e cleanup.
  - [x] Implementar seleção, preview, validação dupla, upload, troca, remoção e compatibilidade com URL legada.
  - [x] Gerar variantes/entrega dimensionada ou configuração equivalente para thumbnail e detalhe.
  - [x] Testar MIME adulterado, excesso de tamanho, falha de upload/persistência e remoção referenciada.

- [x] Task 8 — Tags/modelos e instâncias de kit (AC: 22–27, 37)
  - [x] Implementar CRUD/arquivamento do modelo e composição com requisitos obrigatório/opcional.
  - [x] Implementar seleção de componentes quantitativos/individuais e bloqueio de dupla alocação.
  - [x] Implementar validador determinístico, percentual, faltantes e estados completo/incompleto.
  - [x] Implementar entrega/devolução parcial transacional do kit e histórico por componente.

- [x] Task 9 — Consulta paginada, busca e filtros (AC: 18, 28–34)
  - [x] Implementar consultas server-side paginadas para itens, uso, movimentos e kits.
  - [x] Avaliar/medir índices para os campos de busca/filtro antes de incluí-los no plano Vault.
  - [x] Calcular indicadores e alertas reais na mesma camada de consulta.
  - [x] Testar combinação/limpeza de filtros, paginação estável e dataset grande sintético somente em testes.

- [x] Task 10 — Refatoração visual do módulo existente (AC: 28–40)
  - [x] Compor `InventoryHeader`, resumo, filtros e abas somente na rota canônica `/PainelAlpha/Estoque`.
  - [x] Substituir a página da rota antiga por redirect server-side para a canônica, inicialmente temporário/reversível durante rollout; não duplicar componentes.
  - [x] Implementar lista/row, drawer de detalhe, formulário rápido/avançado e modais de movimento.
  - [x] Implementar cards/editor/builder/validator de Tag/Kit e telas Em uso/Movimentações.
  - [x] Implementar estados loading/vazio/erro/retry, permissões visuais, responsividade e acessibilidade.

- [ ] Task 11 — Regressão, performance e entrega (AC: 3, 32–43)
  - [ ] Executar matriz funcional completa, testes de compatibilidade e testes negativos.
  - [ ] Validar breakpoints solicitados e tablet com dados reais preservados.
  - [ ] Rodar CLIs, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e CodeRabbit.
  - [ ] Atualizar checkboxes, File List, decisões, rollback e instruções operacionais antes do handoff.

## Dev Notes

### Código e integrações existentes

- Página atual: `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque/page.tsx`. É um Client Component único, carrega produtos/categorias/lista integralmente e contém cards, formulário, categorias e carrinho. [Source: `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque/page.tsx`]
- Actions atuais: `src/actions/Estoque.ts`. `SalvarProduto` faz upsert incluindo quantidade; `RegistrarCompra` soma saldo; `DeletarProduto` apaga fisicamente; não há `auth`, Zod ou checagem de permissão. [Source: `src/actions/Estoque.ts`]
- Consumidores legados: `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/page.tsx`, `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/Carrinho/page.tsx` e `src/app/PainelAlpha/PainelTarefas/PainelTarefaC/page.tsx`. [Source: busca de imports de `@/actions/Estoque`]
- Dados atuais: `Categoria` tem nome/cor/ícone; `ProdutoEstoque` tem imagem/nome/quantidade/mínimo/unidade/preço/categoria; `ListaCompra` guarda snapshot de mínimo/status por produto. [Source: `prisma/schema.prisma#model-Categoria`, `#model-ProdutoEstoque`, `#model-ListaCompra`]
- `Auditoria` já guarda `userId`, ação, detalhes, IP e timestamp, mas a suficiência para before/after pesquisável deve ser avaliada, não presumida. [Source: `prisma/schema.prisma#model-Auditoria`]
- Registry e autorização existentes: `podeVisualizarModulo` considera admin, roles permitidas e permissões efetivas; hoje só `ServiçosGerais` aponta para o painel pai e não existe item separado do estoque. [Source: `src/lib/modulos-registry.ts`]
- Permissões efetivas são obtidas em `src/actions/PermissoesSetor.ts`/`src/lib/permissions/effective`; não criar um segundo sistema. [Source: `src/actions/PermissoesSetor.ts#getPermissoesEfetivas`]
- Storage existente inclui Vercel Blob e abstração em `src/lib/storage/`; o mecanismo exato para foto deve ser escolhido após inventário, preservando URLs antigas. [Source: `src/lib/storage/inventory.ts`, `src/lib/storage/catalog.ts`, `src/app/api/blueprint/upload/route.ts`]
- Não há referência aos três models nas migrations versionadas pesquisadas. Tratar isso como risco de drift e reconciliar com banco real antes de gerar migration. [Source: `prisma/migrations/`, pesquisa por `ProdutoEstoque` e `ListaCompra`]

### Project Structure Notes

- A composição visual passa a existir em `src/app/PainelAlpha/Estoque/page.tsx`. A página antiga em `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque/page.tsx` vira somente um redirect server-side. Durante o rollout deve ser usado redirect temporário/reversível para evitar cache permanente antes dos gates; a adoção de redirect permanente fica condicionada à estabilização posterior.
- Componentes menores podem ficar em uma pasta coesa do Estoque; contratos e serviços compartilhados devem ficar em domínio server-only coerente com `src/lib/`. Nenhuma regra ou componente é copiado para a rota legada.
- `MODULOS_REGISTRY` registra apenas `estoque`, apontando para `/PainelAlpha/Estoque`. A ocultação foi encerrada pela autorização explícita de reativação e a visibilidade continua condicionada à permissão efetiva; `ServiçosGerais` permanece integração/consumidor, não um segundo registro do estoque.
- Actions/APIs permanecem adaptadores finos sobre o domínio; comandos CLI em `scripts/` chamam o mesmo serviço.
- Não há `accumulated-context.md` no repositório após busca por nome. A coerência entre stories foi verificada pelas stories atuais e pelos artefatos reais disponíveis; essa ausência deve ser registrada, não compensada com contexto inventado.
- Os caminhos configurados `docs/framework/coding-standards.md`, `docs/framework/tech-stack.md` e `docs/framework/source-tree.md` não existem. Foram usados como fontes efetivas a Constitution, o código vigente, `package.json`, `AGENTS.md` e as stories do repositório.
- [AUTO-DECISION] Criar uma story local descritiva, em vez de numerá-la por epic → o repositório usa majoritariamente `story-<slug>.md`, e o usuário priorizou explicitamente esta solicitação sem fornecer epic numerado.
- [AUTO-DECISION] Manter Status `Draft` durante a criação → concluído; após validação GO do PO, a story passa a `Ready`. A implementação de banco continua bloqueada pelo checkpoint Vault no momento apropriado.

### Ordem de implementação

1. investigação/baseline;
2. contratos e testes de domínio;
3. CLI canônica;
4. plano de dados e Vault;
5. persistência/movimentos/compatibilidade;
6. autorização/auditoria;
7. fotos;
8. tags/kits;
9. consultas/paginação;
10. UI;
11. regressão e gates.

## Testing

### Estratégia

- Unitários: schemas, enums, matriz de transição, cálculo de saldo/status/mínimo, validador de kit, percentual e permissões puras.
- Integração: Prisma transacional, concorrência, idempotência, ledger/saldo/auditoria, compatibilidade de dados e `ListaCompra`.
- Actions/API/CLI: auth, usuário inativo, permissão/capacidade, validação, IDOR, paginação, exit code, JSON e erros sanitizados.
- Componentes: formulários, preview, abas, filtros, drawer, modal de movimento, builder de kit, loading/vazio/erro/retry, teclado e responsividade.
- E2E: fluxos críticos com registros existentes e novos; nenhum teste deve alterar produção. Mocks são permitidos somente nos testes e não podem alcançar bundle/caminho produtivo.

### Matriz funcional obrigatória

1. abrir os 3 produtos e 3 categorias legados;
2. criar item quantitativo sem foto e com quantidade inicial auditada;
3. criar item individual com unidade, serial e patrimônio;
4. rejeitar serial/patrimônio duplicado;
5. editar apenas dados cadastrais sem mudar saldo/histórico;
6. adicionar PNG/JPG/JPEG/WEBP e visualizar preview;
7. rejeitar MIME falso, tipo não permitido, arquivo corrompido e excesso de tamanho;
8. trocar foto sem perder a anterior se persistência falhar;
9. remover foto sem apagar blob ainda referenciado;
10. adicionar quantidade com local/observação e verificar antes/depois/ator;
11. retirar quantidade com motivo/destino;
12. bloquear quantidade zero, negativa, decimal incompatível e saldo insuficiente;
13. executar ajuste com justificativa;
14. duas saídas concorrentes não geram saldo negativo;
15. retry idempotente não duplica movimento;
16. colocar item quantitativo em uso para colaborador/setor/local;
17. colocar unidade patrimonial específica em uso;
18. bloquear item em uso sem responsável;
19. devolver em condição Boa;
20. devolver com avaria;
21. devolver necessitando manutenção;
22. devolver Danificado;
23. transferir entre locais mantendo total;
24. enviar e retornar de manutenção;
25. dar baixa por cada motivo suportado;
26. registrar perda/dano/outro;
27. alerta baixo aparece exatamente no limite documentado e desaparece após entrada;
28. confirmação de compra gera uma única entrada e integra `ListaCompra`;
29. criar, editar e arquivar categoria sem apagar produto;
30. criar Tag/Kit com cor/ícone/categoria;
31. adicionar requisito obrigatório e opcional de item existente;
32. editar quantidade necessária/obrigatoriedade sem duplicar item;
33. montar kit com unidade patrimonial e quantidade consumível;
34. bloquear dupla seleção de unidade alocada;
35. validar kit incompleto e listar componente/quantidade faltante;
36. validar kit completo e mostrar contagem/100% reais;
37. atribuir kit e conferir reflexo correto por natureza de componente;
38. falha em um componente reverte entrega atômica;
39. devolver kit completo;
40. devolver kit sem um componente e manter Devolução pendente;
41. registrar condição distinta por componente devolvido;
42. buscar por nome, código, serial, patrimônio, categoria, responsável e tag;
43. combinar todos os filtros e limpar filtros;
44. paginar itens, movimentos, uso e kits com ordem estável;
45. navegar lista/detalhe/histórico sem carregar histórico integral;
46. usuário sem sessão recebe 401/redirect seguro;
47. usuário ativo sem permissão recebe 403/negação e não vê ações;
48. ID de item/unidade/kit fora do acesso não é mutável;
49. usuário autorizado de Serviços Gerais mantém o fluxo legado conforme política aprovada;
50. arquivar item com histórico e impedir exclusão física;
51. indicadores/empty states refletem apenas dados reais;
52. validar 1920×1080, 1600×900, 1440×900, 1366×768 e tablet;
53. validar navegação por teclado, foco, labels, Esc, contraste e reduced motion;
54. validar logs/auditoria sem token, URL assinada, stack ou arquivo binário;
55. executar upgrade/rollback ensaiado em cópia restaurada do backup e conferir contagens/IDs.
56. abrir `/PainelAlpha/Estoque` com usuário autorizado e confirmar a composição canônica única; abrir a URL legada e confirmar redirect server-side para a canônica, sem loop, bypass de permissão ou segunda renderização.
57. confirmar que a entrada `estoque` do registry aponta somente para a rota canônica e aparece apenas para usuários autorizados; usuários legados mapeados preservam o acesso e usuários sem permissão continuam negados.

## CodeRabbit Integration

### Story Type Analysis

**Primary Type**: Architecture  
**Secondary Type(s)**: Database, API, Frontend, Security  
**Complexity**: High — refatoração brownfield, dados existentes, ledger transacional, múltiplos fluxos e autorização.

### Specialized Agent Assignment

**Primary Agents**:

- `@dev` — implementação e pre-commit.
- `@architect` — desenho do domínio, transações, compatibilidade e decomposição.
- `@db-sage` / `@data-engineer` — schema, índices, migration, preservação e rollback após Vault.

**Supporting Agents**:

- `@ux-design-expert` — fluxo, responsividade e acessibilidade.
- `@qa` — matriz, concorrência, regressão e gate de qualidade.
- `Vault` — gate obrigatório antes de banco.
- `@github-devops` — Pre-PR/deploy, sem substituir a autoridade do Vault.

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): executar CodeRabbit sobre mudanças não commitadas, CLIs e testes escopados.
- [ ] Pre-PR (`@github-devops`): validar compatibilidade, migration/rollback, segurança e diff contra `main`.
- [ ] Pre-Deployment (`@github-devops`): confirmar backup, migration aprovada, smoke read-only/escrita autorizada e rollback.

### Self-Healing Configuration

**Expected Self-Healing**:

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL

**Predicted Behavior**:

- CRITICAL: auto-fix por até 2 iterações e reexecutar gates.
- HIGH: documentar e encaminhar para QA/arquitetura; não ocultar como sucesso.
- MEDIUM/LOW: registrar conforme política, sem alegar correção automática.

### CodeRabbit Focus Areas

**Primary Focus**:

- Atomicidade entre saldo/estado, movimento e auditoria; concorrência e idempotência.
- Autenticação/autorização server-side e validação Zod em toda entrada.
- Migration aditiva, preservação de IDs/dados e rollback.
- Regressão da Lista de Compras e demais consumidores legados.

**Secondary Focus**:

- Upload seguro, ownership e ciclo de vida de blobs.
- Paginação/índices/N+1 e lazy loading.
- Acessibilidade, responsividade e divisão de componentes.
- Ausência de mocks, números fictícios, segredo ou PII em logs.

## Story Draft Checklist Validation

| Categoria | Status | Evidência / observação |
| --- | --- | --- |
| 1. Goal & Context Clarity | PASS | Objetivo brownfield, valor, URL, baseline e ordem de execução estão explícitos. |
| 2. Technical Implementation Guidance | PASS | Integrações, domínio, invariantes, fases, Gate Vault e arquivos-chave foram identificados sem prescrever tecnologia inexistente. |
| 3. Reference Effectiveness | PASS | Referências apontam para arquivos e símbolos diretamente relevantes; findings críticos estão resumidos na própria story. |
| 4. Self-Containment Assessment | PASS | Diagnóstico, decisões, edge cases, modelo conceitual e matriz funcional estão incluídos. |
| 5. Testing Guidance | PASS | Abordagem unitária/integração/API/CLI/componente/E2E e 55 cenários verificáveis estão definidos. |
| 6. CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos estão completos conforme configuração habilitada. |

**Final Assessment: GO validado pelo PO (9/10); story em Ready.**

Não há lacuna de requisito que impeça a preparação. A implementação continua condicionada à decisão arquitetural detalhada e, antes de qualquer alteração de banco, ao Gate Vault e à aprovação explícita do usuário.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-18 | 0.1 | Story Draft criada a partir do pedido explícito, investigação verificada e baseline do módulo existente. | River (SM) |
| 2026-09-18 | 0.1.1 | Validated GO (9/10) — Status: Draft → Ready | @po |
| 2026-09-18 | 0.1.2 | Decisão arquitetural: `/PainelAlpha/Estoque` é a rota canônica; rota anterior vira redirect compatível e o módulo entra no registry/permissões existente com rollout oculto inicial. | Aria (Architect) |
| 2026-09-18 | 0.2.0 | Development started (YOLO) — Status: Ready → InProgress; rota canônica, UI base, autorização e redirect implementados. A autorização explícita do usuário reativou a entrada para usuários efetivamente autorizados, encerrando a ocultação técnica inicial. | @dev |
| 2026-09-18 | 0.3.0 | Vault executado com backup verificado; baseline, V1/V2 e V3 aprovados foram aplicados no Turso de produção na sequência autorizada e validados sem divergência. Domínio, ledger, fotos, kits, CLI, UI e compatibilidade legada implementados. | Codex |
| 2026-09-18 | 0.3.1 | Revisão final corrigiu ACL efetiva do CLI, busca ampliada do catálogo de kits, limite dos consumidores legados e visibilidade da rota para `ServiçosGerais`; suíte focal passou com 81 testes e build aprovado. | Codex |
| 2026-09-18 | 0.3.2 | Snapshot completo do workspace promovido somente ao stage `stagepainel-alpha.alpak.ai`: release isolada `20260918-205653`, build `mNP7t39fTnLeIqQ9eByps`, smoke e pós-deploy aprovados. | DevOps / Codex |
| 2026-09-18 | 0.3.3 | Refinamento de usabilidade: categorias com atualização imediata e edição auditada, guia rápido do módulo e composição de Kit com colunas explícitas de produto, quantidade e obrigatoriedade. | Dex / Codex |
| 2026-09-19 | 0.3.4 | Nota fiscal em PDF/imagem usando o storage existente, seletor visual compartilhado com 30 ícones, detalhe de Kit com disponibilidade/faltantes e alertas reais, e movimentação iniciada por Item ou Kit com origem empresarial fixa e destino descritivo. Stage atualizado na release `20260919-135233`. | Dex / DevOps |
| 2026-09-19 | 0.3.5 | Disponibilidade dos cards de Kit corrigida pelo saldo real dos requisitos obrigatórios; quantidade de atribuição padronizada em 1; visão pessoal de posse/histórico liberada a todos os colaboradores; gestão restrita a Admin, TI, CEO, Financeiro e Recursos Humanos; confirmação de devolução restrita ao TI. | Dex / Codex |
| 2026-09-19 | 0.3.6 | Exclusão definitiva de Item e Tag/Kit adicionada como operação distinta de Baixa e Arquivamento, com confirmação `EXCLUIR`, auditoria, limpeza de anexos gerenciados e bloqueio de registros com histórico operacional. | Dex / Codex |
| 2026-09-19 | 0.3.7 | Versão com exclusão definitiva promovida somente ao stage na release isolada `20260919-145121`, build `7xYVwwtVXj0A74K9Msz8A`; smoke local, serviço e HTTPS aprovados. | DevOps / Codex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex — Dex (Builder)

### Debug Log References

- `npx eslint <arquivos do estoque> --max-warnings=0` — aprovado.
- `npx vitest run tests/estoque --coverage.enabled=false` — 95 testes aprovados em 11 arquivos após os refinamentos de usabilidade e documentos/Kits.
- `npx vitest run tests/estoque --coverage.enabled=false` — 107 testes aprovados em 12 arquivos após disponibilidade dinâmica, visão pessoal e ACL por setor.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false` — nenhum erro nos arquivos focais do estoque; baseline global permanece vermelho em rotas/API e componentes externos ao módulo.
- `npm run build` — bloqueado por erro externo ao estoque em `src/actions/RecuperarSenha.ts:42` (`Server Actions must be async functions`); a compilação focal do estoque não apresentou erro.
- `npm test` — 3451 testes passaram, 1 ficou todo e 20 falharam em 12 arquivos externos ao estoque (Alpha SEO, BPM, Gerador de Documentos, Onyx, Parceiros e parser PPTX); os 107 testes focais do estoque seguem verdes.
- `npm run lint` — baseline global permanece vermelho com 3642 ocorrências em arquivos/frameworks externos ao passe; ESLint focal dos arquivos tocados pelo estoque passou sem erro ou warning.
- `npx vitest run tests/estoque --coverage.enabled=false` — 111 testes aprovados em 12 arquivos, incluindo exclusão física em banco temporário e bloqueio de Item/Kit com movimentação.
- `npm run build` — aprovado; 80 páginas geradas e rota dinâmica `/PainelAlpha/Estoque` incluída, com apenas warnings preexistentes do `pdfjs` do Bibble.
- `bash scripts/deploy-staging-release.sh` — stage atualizado na release `20260919-145121`, build `7xYVwwtVXj0A74K9Msz8A`; serviço `active`, HTTP local 200 e HTTPS público 200.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run typecheck` — bloqueado por erros preexistentes fora dos arquivos deste passe; nenhum erro reportado em actions, autorização, rota ou componentes do Estoque tocados aqui.
- `npm run lint` — baseline global com 3.693 problemas fora do escopo; lint focal do estoque aprovado sem warnings.
- `npm run build` — aprovado; rota dinâmica `/PainelAlpha/Estoque` e endpoints de imagem/nota fiscal incluídos. Permanecem apenas warnings preexistentes do `pdfjs` do Bibble.
- `git diff --check` e `npx prisma validate` — aprovados.
- Regressão ampliada (`estoque` + registry/auth relacionados) — 120/121; a única falha é o contrato preexistente de `tests/alpha-seo/integration-wiring.test.ts`, que ainda procura a expressão antiga da sidebar `[...pinnedModulos, ...unpinnedModulos].map`.
- CodeRabbit — indisponível neste host; decisão `CONCERNS` documentada em `docs/qa/coderabbit-reports/estoque-geral-2026-09-18.md`, sem fabricar aprovação.

### Completion Notes List

- Rota canônica `/PainelAlpha/Estoque` criada; rota antiga redireciona para a mesma implementação.
- Módulo `estoque` registrado e visível somente para autorização efetiva; compatibilidade temporária com `ServiçosGerais` mantida no servidor.
- UI componentizada entregue com indicadores agregados reais, abas, busca/filtros/paginação server-side, detalhes, categorias e estados vazios sem mocks.
- Actions legadas preservadas por nome, agora com sessão/permissão, Zod, transações e auditoria cadastral.
- A autorização relê usuário ativo e role atual no banco antes de calcular as permissões efetivas; o carrinho deriva o snapshot do produto persistido, sem confiar nos campos enviados pelo cliente.
- Edição cadastral não altera quantidade; entradas, compras e demais variações de saldo usam o ledger transacional existente.
- Entrada de item individual direciona ao cadastro da unidade patrimonial, evitando uma submissão que o domínio rejeitaria.
- Exclusão física foi bloqueada; arquivamento exige saldo zero e ausência de atribuição/manutenção ativa, preserva relações e gera auditoria.
- O CLI mutável usa a mesma resolução efetiva da aplicação (`SetorPermissao` + overrides `ADD/REMOVE`) e exige `--execute --actor-id` com usuário ativo.
- O catálogo de Tags/Kits permite busca server-side e mescla resultados além do recorte inicial; consumidores legados de `buscarProdutos` passaram a ter limite padrão.
- Categorias criadas/editadas/excluídas atualizam imediatamente filtros, cadastro de item e Tags/Kits, sem reload; edição preserva before/after na auditoria.
- A composição do modelo de Kit explicita produto/item, saldo disponível, quantidade necessária e obrigatoriedade; o guia recolhível orienta os fluxos principais sem ampliar o dashboard.
- Nota fiscal pode ser anexada ao lado do valor em PDF/JPG/PNG/WebP por um controle compacto; troca/remoção usam o storage existente, validação de assinatura/tamanho e auditoria, sem migration.
- Categorias e Tags/Kits usam o mesmo seletor visual com 30 ícones Lucide, evitando nomes técnicos digitados manualmente.
- O detalhe de Kit mostra descrição do componente, disponível, necessário, quantidade de kits possíveis e faltantes; alerta amarelo pulsa quando resta no máximo um kit e fica vermelho quando um obrigatório zera.
- O modal `Movimentar estoque` permite escolher Item ou Kit; origem empresarial fica fixa em `Alpha Comex & Compliance`, destino aceita texto livre e é preservado nos metadados auditáveis do movimento.
- O card de cada Kit agora mostra quantos kits podem ser montados imediatamente a partir do menor saldo entre componentes obrigatórios; instâncias salvas aparecem separadamente como kits montados e não geram disponibilidade falsa.
- Atribuições de item iniciam com quantidade 1 e cada instância de Kit representa explicitamente uma unidade; saldos disponível/em uso continuam derivados do ledger.
- Todos os colaboradores ativos veem a rota do estoque, mas usuários fora de Admin, TI, CEO, Financeiro e Recursos Humanos recebem apenas `Itens em sua posse` e o próprio histórico. Gestores também possuem a aba `Minha posse`.
- A confirmação de devolução de item ou componentes de Kit é protegida no servidor e exposta somente ao setor TI; os demais usuários visualizam o estado sem poder confirmar.
- Item e Tag/Kit possuem agora `Excluir definitivamente`, separado de Baixa e Arquivamento. A exclusão exige digitar `EXCLUIR`, remove fisicamente cadastros sem histórico e preserva a auditoria tombstone; vínculos operacionais impedem a destruição do ledger.
- A exclusão de item limpa relações descartáveis, fotos/notas fiscais registradas e tenta remover os respectivos blobs gerenciados; composição de Kit deve ser desvinculada antes de apagar o item.
- O CLI recebeu `item-delete` e `tag-delete`, ambos condicionados a `--execute --actor-id` e `--confirm EXCLUIR`, mantendo a regra CLI-first.
- Backup pré-mudança verificado: `painelalpha_turso_pre_change_2026-09-18T18-53-24-571Z.sql`, 131.930.201 bytes, SHA-256 `1dae46a7ac5b375581ec199b139801019f76dae59b141af304ac3561d31e3d17`.
- Produção: baseline `cbe76024…c743`, V1/V2 `2a634b3b…a9e3` e V3 `6cfea978…c5e` aplicados somente após preflight 3 categorias/3 produtos/soma 18. Pós-validação: 3 itens, 3 saldos, 3 operações, 3 movimentos, divergência 0, FK check 0 e `ListaCompra` sem alteração estrutural.

### File List

- `docs/stories/story-estoque-geral-reativacao-reformulacao.md` — decisão de rota canônica, redirect legado, registry/permissões e rollout.
- `src/app/PainelAlpha/Estoque/page.tsx` — rota canônica autorizada, SSR limitado e resumo agregado do Estoque Alpha.
- `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque/page.tsx` — redirect de compatibilidade.
- `src/actions/Estoque.ts` — validação, autorização, proteção de quantidade e auditoria das ações legadas.
- `src/actions/EstoqueMovimentos.ts` — contrato paginado consumido pela UI, incluindo resolução server-side de estoque baixo sem alterar o serviço compartilhado.
- `src/actions/EstoqueKits.ts` — consulta limitada/pesquisável e actions autenticadas para Tags, instâncias, entrega e devolução.
- `src/components/Estoque/*` — workspace, cabeçalho, indicadores, browser paginado, lista, detalhes, movimentações, atribuições, manutenção, patrimônio, categorias, formulário e estados vazios.
- `src/components/Estoque/InventoryGettingStarted.tsx` — guia rápido recolhível com atalhos para cadastro, movimentação e Kits.
- `src/lib/estoque/*` — autorização, serviços compartilhados de itens/movimentos/kits, contratos, imagens e view-model do módulo.
- `src/app/api/estoque/itens/[itemId]/imagem/route.ts` — upload, troca e remoção autenticados usando o storage existente.
- `src/app/api/estoque/itens/[itemId]/nota-fiscal/route.ts` — upload, troca e remoção autenticados de PDF/imagem usando `InventoryImage` sem alteração estrutural.
- `src/components/Estoque/InventoryIconSelect.tsx` — seletor visual compartilhado com 30 opções de ícone para categorias e Tags/Kits.
- `src/lib/estoque/documents.ts` e `documents-client.ts` — validação e cliente do anexo de nota fiscal.
- `scripts/inventory/*` — CLI e dry-run/restauração do plano Vault.
- `prisma/manual-migrations/20260918_inventory_legacy_baseline.sql` — baseline aprovado por hash.
- `prisma/migrations/20260918193000_inventory_general_foundation/migration.sql` — migration aditiva V1/V2 aprovada por hash.
- `prisma/manual-migrations/20260918_inventory_legacy_backfill_v3.sql` — backfill idempotente aprovado por hash.
- `src/lib/modulos-registry.ts` — registro canônico e visível do módulo `estoque`.
- `src/lib/estoque/access.ts` e `authorization.ts` — política de gestão por setor, visão pessoal e capacidade exclusiva de devolução do TI.
- `src/components/Estoque/InventoryWorkspace.tsx`, `InventoryAssignmentsPanel.tsx` e `InventoryMovementsPanel.tsx` — experiência pessoal de posse/histórico e aba equivalente para gestores.
- `src/components/Estoque/kits/InventoryKitsPanel.tsx` e `KitBuilder.tsx` — disponibilidade dinâmica por componentes, entrega unitária explícita e devolução restrita ao TI.
- `src/lib/estoque/items-service.ts` e `kits-service.ts` — exclusão física transacional segura de cadastros sem histórico, com auditoria preservada.
- `src/components/Estoque/InventoryItemDetails.tsx` e `kits/InventoryKitsPanel.tsx` — ações destrutivas com confirmação forte e mensagens de bloqueio.
- `src/components/layout/GlobalSidebar.tsx` — ícone do módulo na navegação.
- `tests/estoque/*` — testes de filtros, indicadores, autorização, rota e invariantes de quantidade.
- `plan/self-critique-inventory-app-base.json` — autoavaliação obrigatória da implementação base.

## QA Results

**Decisão atual: CONCERNS / InProgress.** O escopo focal do Estoque está aprovado: 81/81 testes, ESLint focal, `git diff --check`, Prisma validate, build, dry-run restaurado, doctor e reconcile sem divergência. Revisões independentes não deixaram achado CRITICAL/HIGH aberto após as correções finais.

A story ainda não pode ser marcada `Done` porque o AC43 exige gates globais que permanecem vermelhos por baseline fora do Estoque (`npm run lint`, `npm run typecheck` e `npm test`), o CodeRabbit não está instalado/autenticado neste host e a matriz visual autenticada nos breakpoints/tablet ainda não foi executada. Não houve commit, push, PR ou deploy de produção da aplicação. Houve apenas deploy autorizado no stage, pela release isolada `20260918-205653`; no banco, somente os três artefatos SQL expressamente autorizados foram aplicados ao Turso.
