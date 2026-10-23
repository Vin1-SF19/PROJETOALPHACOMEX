# Freeze Aria — templates Excel Checklist — 2026-10-23

**Estado: Frozen / ReadyForPO para código. DataPending A02 e execução staging.** Escopo Main, sem DDL, dependências novas, Portal ou refatoração visual. Fonte runtime consultada: worktree `portal-api-20261023`, HEAD de referência `a1443ab3`; portar em worktree nova do staging corrente, preservando entregas concorrentes.

## 1. Decisão e invariantes

- São 59 requisitos documentais individuais em três escopos (25/17/17), com oito repetições legítimas; não são três objetos JSON. Não criar CPRB. Fonte documental: CHECK LIST; abas auxiliares servem à conferência das divergências.
- `ModeloChecklistIdentidade.id` continua PK; `codigoNormalizado` passa a ser entendido como **chave interna estável do requisito**, mantendo nome físico e unique `(escopo, codigoNormalizado)`. Não reescrever chaves existentes.
- `ModeloItemChecklist.codigo` é o código documental significativo; `ItemChecklist.codigo` e `modelosSnapshot[].codigo` recebem esse valor da revisão. Código não identifica sozinho uma exigência e nunca recebe sufixo técnico visível.
- PK da identidade/revisão e chave interna não são códigos fiscais. Sem catálogo JSON paralelo, novas tabelas, correção em massa, reaplicação de catálogo ou edição retroativa de snapshots.
- Decisão alternativa rejeitada: fundir por código/seção reduziria 59 para 51 requisitos e perderia status/contexto; seção também não distingue contrato e comprovantes. Usar colunas existentes exige corrigir poucos leitores, evitando migration.

## 2. Publicação e compatibilidade

- `publicarModeloSchema.codigo`: string não vazia, trim somente nas bordas, máximo 80; preservar caixa, letras, separadores e quebras internas. Manter `normalizarCodigoModelo` para compatibilidade de chave, nunca para código exibido. Não converter para número.
- Acrescentar somente `chaveInterna?: string` técnica, padrão `[A-Z0-9_]{1,80}`, sem normalização destrutiva. No create, usar chave informada; ausente, derivar `normalizarCodigoModelo(codigo)` como antes. Chave vazia/ilegível é erro. Sem identidadeId, colisão continua `MODEL_CODE_CONFLICT`, inclusive com outra mutationId.
- No update por `identidadeId`, buscar identidade existente; seu escopo e chave são imutáveis. Chave omitida usa a persistida; informada precisa ser exatamente igual. Não comparar chave técnica com código de negócio.
- Código lógico permanece imutável: comparar normalização do código recebido com a da última revisão; rejeitar troca de código lógico. Permitir restaurar sua grafia original significativa em nova revisão (ex.: normalizado legado → composto original). Incluir `codigo` na comparação de igualdade/no-op, para não perder essa correção de representação.
- `hidratarRevisao` usa `r.codigo`, nunca `i.codigoNormalizado`; ORDENAR/DESATIVAR conservam código original. Listagem retorna `codigo = últimaRevisão.codigo`, fallback para chave apenas em identidade antiga sem revisão; pode retornar `chaveInterna` separada para gestão, nunca como badge/campo fiscal.
- Reter autorização persistida de TI/Líder Operacional, status/sessão/módulo, antes de replay. Reter CAS, versão imutável, transação e evento/auditoria das publicações efetivas. Prévia identifica NOOP e não emite publicação desnecessária.
- PUBLICAR muda a semântica do código: marcar **somente o novo payload de journal** com versão interna de contrato (ex.: `contratoCodigo: 2`), incluindo a chave opcional e código significativo. Payload de ORDENAR/DESATIVAR continua intenção original, sem campos hidratados.
- Para replay anterior ao patch, aceitar exclusivamente o hash do formato PUBLICAR legado (sem marcador/chave, código normalizado pelo parser antigo), com mesmo ator/conta/mutationId. Não aceitar fallback para um evento novo marcado v2; ator/payload divergentes continuam CONFLICT. Implementar local ao catálogo usando hash/replay existentes; não alterar contratos gerais do journal. Preservar resultado histórico e revalidar permissão mesmo no replay.

## 3. Resolução aplicável e snapshots

- Buscar revisões ativas aplicáveis como hoje, incluindo a identidade para obter sua chave (include/select na mesma consulta, sem N+1). Agrupar pela **chave da identidade**, não por normalização do código da revisão nem por seção/nome.
- Dentro da mesma chave, específico prevalece sobre GLOBAL; sem específico ativo, GLOBAL continua aplicável como antes. Chaves diferentes sobrevivem mesmo com código/seção iguais. Manter exclusão das revisões sem identidade, ordenação estável seção/ordem/código/id e uma revisão ativa por identidade.
- Chaves legadas iguais preservam override atual sem backfill. Duas identidades novas com chaves distintas e código 3140 são duas exigências; duas 5160 em seções distintas também. Não classificar legado por prefixo: qualquer chave persistida segue a mesma regra.
- `materializarTipo` já copia revision.codigo/nome/descrição/seção/ordem/obrigatório e FK da revisão; não mudar se testes confirmarem. Somente nova instância recebe catálogo. Repetir empresa+tipo mantém itens/modelosSnapshot anteriores byte/valor a valor, sem rejoin ao catálogo.
- Portal v1 já transporta `codigo` string; conferir contrato existente sem alterá-lo. ZIP sanitiza apenas o nome de arquivo; código de domínio permanece original. Não modificar auth, transporte/API ou Portal por hipótese.

## 4. Manifesto privado e conteúdo

- Manifesto de execução privado 0600: arquivo+SHA256, aba, linha/células, código literal OOXML e código significativo, título, descrição, seção, ordem, condições, candidato de chave, operação resolvida, identidade/revisão alvo, expectedRevision, mutationId estável e resultado. Não versionar dados pessoais reais dos arquivos.
- Chave candidata de uma linha nova: `SRC_` + SHA256 UTF-8 de JSON canônico `[sha256Arquivo, nomeAbaExato, numeroLinha]`, digest hexadecimal uppercase (68 caracteres). Não depende de título/código/seção editáveis. Repetir mesmo manifesto reutiliza chave e mutationId; nunca gerar intenção nova para retry incerto.
- A chave candidata só é usada quando a prévia confirmar CREATE distinto; correspondência existente explícita pode reutilizar identidade/chave legada, preservando o mapa fonte→identidade. Mesmo arquivo alterado requer nova prévia, evitando duplicar publicação por mudança de hash.
- Usar código C significativo; B é enumeração. Preservar `4100 e\n4110 i` para contas e comprovantes, energia elétrica OU internet. Preservar 3140/3150/3540/3550/3340/3350 em requisitos separados e 5160 nas duas seções. Não inventar água, códigos ou documentos de abas auxiliares.
- `nome = título.trim()`. `descricao` compõe rótulos Obrigatoriedade/Complemento/Observações com textos da linha, sem estados de exemplo. `ordem = source_position`; seção sugerida e ordem dentro da seção preservam a sequência documental. Campo obrigatório true só para incondicional; condicional false + descrição explícita da condição, sem motor de regras.
- Anexar em `descricao` de **Formulário e Petição / 1100 / VALIDAÇÃO**, em cada escopo, as duas ORIENTAÇÕES sem código (e-CAC e DTE), incluindo a instrução de não enviar documento e condições originais pertinentes. Não criar mais seis documentos/status/uploads nem atrelar conclusão automática ao formulário. Textos originais completos ficam no manifesto privado.
- Capacidade verificada no dataset: maior nome 136/180, código significativo 13/80; descrição rotulada máxima 399 e âncora com duas orientações 618/1000. Reconferir payload final; exceder limite falha explicitamente, nunca truncar.
- A03: exigência de IPTU do ano corrente, divergência 2026/2023 registrada; A04: DAS usa 1100 da CHECK LIST, divergência legada 1500 registrada. Não importar espelhos como novos requisitos. Novas instâncias seguem PENDENTE, sem copiar OK/PRIORIDADE dos exemplos.
- **A02 DataPending**: Mutuante 2130 em CHECK LIST!C39 versus 5140 em FATOS E DIREITOS!B56; 5140 é IOF em CHECK LIST!C41. Não decidir conteúdo ou publicar a linha enquanto usuário consulta analista. Preparação, código, fixtures, gates e deploy do patch independem dessa resposta; aplicação final/reconciliação das 59 aguarda resposta e plano fechado.

## 5. Prévia do catálogo e aplicação

- Primeiro obter catálogo staging completo, paginado e somente leitura, com identidades, escopo/chave e última revisão/ativo/revision, mais resolução aplicável nos três escopos. Confirmar ambiente e banco efetivos com `.env.staging.local`, sem expor segredo e sem presumir `.env.local`.
- Comparar cada linha por código **e conteúdo/contexto**, nunca apenas código. Resolver explicitamente CREATE, REVISAR por identidade existente, ou NOOP; ambiguidade vira pendência. Não é correto declarar “59 creates” antes da prévia.
- Se GLOBAL já representa o mesmo requisito, preferir override específico na mesma chave; não criar segunda exigência não intencional. Preservar GLOBAL para outros escopos. Repetição legítima recebe chave distinta somente quando representa requisito distinto. Não desativar/editar conteúdo alheio sem autorização específica.
- Mostrar plano completo com diferenças, contagem por operação e lista efetiva futura por escopo; totais podem conter modelos alheios preservados. A declaração “59 existem fielmente” exige correspondência individual fonte→revisão e ausência de duplicação não intencional, não apenas contar catálogo bruto.
- Aplicar somente publicação/revisão canônica por identidade, uma intenção estável por comando, respeitando CAS e registro transacional. Em timeout, consultar resultado/replay da mesma intenção; conflito para e refaz prévia. Salvar IDs/revisões/eventos e efeitos exatos. Não usar action legada retroativa ou scripts de migration/bootstrap.
- Execução preferida: sessão real TI/Líder Operacional via actions atuais, inclusive automação CLI autenticada com credencial/sessão legítima. Sessão staff ainda desconhecida: **é pendência de acesso, não licença para forjar cookie/JWT ou ID**. Não criar endpoint de importação, role, impersonação ou backdoor.
- Credencial DB admin isolada não produz AtorChecklist autenticado; o contrato atual não tem ator SYSTEM. Manutenção local só seria alternativa após desenho/atestado de origem e auditoria próprios, plano explícito e aprovação aplicável; não é a via assumida deste freeze nem autoriza chamar domínio com ID inventado.
- Vault classifica o plano concreto antes de aplicar: CRUD normal versus seed/lote/risco elevado. Quando a política se aplica, exigir relatório, plano executável revisável com ambiente/banco/comandos/impacto/alternativa/rollback, backup completo verificado <=48h e confirmação específica do usuário. Nenhuma confirmação genérica agora.
- Rollback de código: versão staging anterior preparada por DevOps. Rollback de publicações novas: somente plano específico aprovado (desativar novas identidades/republicar revisões anteriores sem apagar histórico), sob Vault quando aplicável; jamais restaurar dump indiscriminado sobre trabalho concorrente. Não tocar produção.

## 6. Alterações mínimas e provas causais

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/checklist/schemas.ts` | Código significativo e chave interna opcional; manter normalizador legado |
| `src/lib/checklist/catalogo.ts` | Chave/publicação/lista/hidratação/resolução e replay compatível |
| `src/components/checklist/ModelosDocumentoForm.tsx` | Preservar código significativo no draft/edição; textarea curta se necessário para composto; controle discreto de repetição intencional no create gera chave `REQ_` + UUID sem hífens uppercase, derivada da mutationId estável, sem mostrar chave ao usuário |
| `src/components/checklist/ModelosWorkspace.tsx` | Consumir código de negócio e conservar nomes/seções distinguíveis; editar por id; alterar só se DTO exigir |
| Testes existentes `backend.service.test.ts`, `catalogo-replay.test.ts`, `checklist-modelos-frontend.test.tsx` | Estender fixtures sintéticas e cenários abaixo, sem dados reais |
| Story e operação privada pontual | Checklist/File List/evidência; manifesto e automação estreita se necessários, sem framework de import genérico |

- Actions, service, ZIP, Prisma e Portal: somente conferência; editar runtime adicional apenas se teste causal provar necessidade e retornar a Aria. Nenhuma tecnologia ou dependência nova.
- Provar publicação/lista/editar/ordenar/desativar/republicar/materializar composto preservado; dois requisitos mesmo código **e mesma seção**; duas seções 5160; três escopos corretos, nenhum CPRB. Chave interna nunca aparece como código em UI/item/snapshot/ZIP.
- Provar override GLOBAL/específico legado e fallback ativo; chave distinta preserva ambas; omitir chave mantém colisão antiga; retry mesma intenção não duplica; nova mutationId mesma chave não cria outra identidade. Atualizar representação preserva identidade e cria revisão quando código mudou.
- Provar replay PUBLICAR antigo com normalização; novo payload divergente/ator/conta divergem; replay ORDENAR/DESATIVAR após nova revisão; permissão/sessão revogada bloqueia antes de replay; CAS concorrente e falha transacional não deixam versão/evento/auditoria parciais.
- Provar snapshots/itens existentes intactos e seleção repetida sem rematerializar; UI conserva draft/mutationId em erro/pending, gestores e consulta mantêm capacidades; layout/formulário restaurado preservado. Não criar estados/publicação de rascunho novos.
- Rodar lint/typecheck/npm test/build reais após patch; Forge, Probe/Anubis/Lens e deploy staging. Reconciliação real autenticada vem depois dos gates de conteúdo/acesso/Vault. Gates não executados nesta estação documental.

## 7. Readiness e limites

[AUTO-DECISION] YOLO, análise de impacto focal usando task `architect-analyze-impact.md` e checklist arquitetural; documentos globais ausentes substituídos pelos artefatos fornecidos/scout/contrato anterior, sem inventar conteúdo. Persona canônica fallback `.aiox-core/development/agents/architect.md`; `.Codex/commands/AIOX/agents/architect.md` e `.aiox/gotchas.json` não existem.

Arquitetura pronta para PO e desenvolvimento: requisitos/limites/identidade/compatibilidade/testes definidos. Riscos concentrados em colapso por código (mitigado por chave), duplicação GLOBAL (prévia), replay legado (versão/fallback restrito), ator não autenticado (gate de acesso) e conteúdo A02 (gate de dados). Sem aumento estrutural de carga; consulta de identidade conjunta evita N+1. Novos mecanismos de infraestrutura/acessibilidade/dependências são N/A; componentes existentes mantêm teclado, labels, foco, draft guard e permissões.

## Confirmação de conteúdo posterior ao freeze — usuário, 2026-10-23
A02 RESOLVIDA: usuário respondeu explicitamente **2130** à pergunta encaminhada ao analista. Documento de Identificação do Mutuante segue CHECK LIST!C39 =2130; Guia de IOF mantém5140. A pendência de conteúdo A02 descrita historicamente acima foi encerrada; não altera arquitetura nem autoriza pular prévia, acesso legítimo ou Vault aplicável.

## Autorização posterior — gestão de modelos por Admin, 2026-10-23

O usuário autorizou explicitamente: **“Liberar Admin para gerenciar os templates também”**. Somente `gestorModelosChecklist` e sua capability passam a aceitar Admin, junto a TI e Líder Operacional. A leitura canônica e suas regras persistidas de status/sessão/módulo continuam antes de replay; o bypass administrativo de leitura já existente permanece. Não há alteração em autenticação, criação/atribuição de atendimento, edição de itens/dossiês ou permissão do Portal. Esta autorização substitui apenas as referências anteriores ao conjunto TI/Líder como gestores exclusivos.

## Evidência de preparação backend — Echo, 2026-10-23

No worktree novo baseado em `65c3b50b`, código significativo e chave interna foram separados sem DDL. PUBLICAR novo marca `contratoCodigo: 2` no payload do hash e nos dados do evento, pois o journal guarda somente hash; ausência do marcador permite verificar formato legado, mantendo validação de ator/conta e permissão antes de replay. DTO de listagem disponibiliza `chaveInterna` opcional para compatibilidade de consumidores.

Manifesto privado `/tmp/checklist-excel-20261023-manifest.json` validado por `publicarModeloSchema`: 59 payloads (25/17/17), seis orientações anexadas a 1100 e oito repetições preservadas. Descrição final máxima 616/1000 caracteres (formatação rotulada desta preparação); código máximo 13/80, nome 136/180, sem truncamento. Prévia de catálogo somente leitura não encontrou correspondência de conteúdo/código entre as 59 fontes e os três modelos alheios existentes: plano 59 CREATE, zero REVISAR/NOOP; preservar os três, total futuro 62 identidades. Aplicáveis futuros: Financeira 28, Início 18, DAS 18, CPRB somente o GLOBAL antigo (1), sem novo documento CPRB. Nenhuma publicação ou mutation em staging executada por Echo. Validação remota final segue dependente dos gates operacionais.
