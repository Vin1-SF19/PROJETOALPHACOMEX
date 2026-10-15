# Story: Chamados — atendimento multissetorial no layout atual

## Status

Ready for Review — código implementado e migração aplicada no Turso `banco-alpha` após consentimento específico **“sim autorizo”** e liberação Vault. Foram inseridas 53 categorias; 224 chamados legados e demais dados antigos foram preservados. Validação Prisma real somente leitura aprovada; lint, TypeScript, build e testes de Chamados passaram. A suíte global mantém as seis falhas anteriores de BPM/builder. Homologação autenticada completa/realtime real e publicação não foram executadas; a story não está Done. O usuário autorizou o commit local com “commite”; PR, push e deploy permanecem fora do pedido.

## Executor Assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["lint", "typecheck", "vitest", "build", "review-autorizacao", "Vault"]

## Story

Como colaborador do Painel Alpha, quero abrir e acompanhar chamados para qualquer setor ativo e real da empresa, para encaminhar demandas à equipe correta, com categorias pertinentes, responsável opcional e atendimento seguro pela equipe de destino.

## Origem, contexto e dependências

- Requisito direto do usuário nesta sessão: reformulação total, abertura também para TI/Admin, setor antes de categoria, categorias por setor, gestão de categorias somente TI por ícone ao lado de Categoria, renomear Técnico desejado e preservar urgência, conclusão desejada e descrição.
- Decisão confirmada pelo usuário: **“Qualquer colaborador ativo do setor de destino”** pode assumir chamados da fila.
- Decisão confirmada pelo usuário: **“Manter a visão geral desses perfis; demais pessoas veem seus pedidos e a fila do próprio setor”**, referindo-se a Admin, CEO e TI.
- Correção posterior do usuário: **“voce mudou demais a visualização, analise o codigo do chamados e ai sim crie o plano correto”**. O desenho da versão 0.1 foi rejeitado; esta versão usa a página e os componentes reais como referência visual, mantendo o escopo funcional confirmado.
- Continuidade: [preferência, prazo e feedback](story-rm-2026-a6f2c9-chamados-feedback-preferencia-prazo.md#acceptance-criteria) separa preferência de atribuição real e reserva a assunção ao escolhido; [assunção concorrente](story-rm-2026-d03061-assumir-chamado.md#critérios-de-aceite) impede sobrescrever o primeiro atendente; [painel TI](story-chamados-painel-operacional-ti.md#acceptance-criteria) reutiliza actions canônicas. Preservar esses contratos, generalizando apenas o destino e a elegibilidade.
- Não há epic específico fornecido. A story deriva do pedido e dos contratos atuais, sem atribuir aprovação a um epic ou ao PO. **“Aplique”** autorizou implementação do código; posteriormente **“sim autorizo”** confirmou o delta específico de banco apresentado, com gate Vault aprovado antes da aplicação.

## Acceptance Criteria

1. Todos os usuários ativos autorizados ao módulo, incluindo TI e Admin, encontram **Novo chamado** e podem abrir demandas para qualquer setor ativo e real. O catálogo é obtido da tabela canônica `Setor`; não existe lista fixa de destinos no runtime.
2. O formulário preserva **Título do chamado**, com limite atual de 120 caracteres, como primeiro campo. Depois apresenta **Setor de destino**, **Categoria**, **Nível de urgência**, **Responsável desejado** opcional, **Conclusão desejada** opcional e **Descrição**. Preservam-se os quatro níveis de urgência existentes, regra de data/fuso e limite atual de 800 caracteres da descrição.
3. O novo seletor de setor reutiliza o `Select` e o `inputClass` existentes: largura total, altura `h-12`, `rounded-2xl` e `bg-black/40`, inserido imediatamente antes de Categoria. Trocar setor limpa categoria e responsável incompatíveis e remove o default fixo Hardware. A categoria continua em cartões radio, com rótulo e descrição, agora preenchidos por opções ativas do destino selecionado; o servidor rejeita IDs incompatíveis ou inativos.
4. Cada setor real ativo possui categorias coerentes, incluindo **Outros do setor**. A inspeção confirmou 13 destinos reais, incluindo MARKETING e ADMINISTRATIVO; o provisionamento autorizado inseriu 53 categorias. Novos setores não ficam dependentes de editar um enum/lista no runtime.
5. Imediatamente ao lado do texto Categoria, no mesmo legend, existe somente um ícone `Settings` de gestão, com tooltip e nome acessível **Gerenciar categorias**, visível exclusivamente para role normalizada exatamente TI, incluindo legado `T.I`. Admin e CEO não herdam essa permissão. O ícone abre um `Dialog` no padrão escuro de `DetalhesChamado`, com fundo `#080e1a` e `rounded-[2rem]`; não cria nova tela. Toda action de gestão repete essa validação no servidor.
6. O gestor permite listar por setor, adicionar, renomear, arquivar/reativar e excluir categorias. Nomes vazios/duplicados no mesmo setor são rejeitados; categorias usadas são arquivadas, não apagadas. Exclusão física exige ausência de referências verificada também na transação; renomear/arquivar não altera rótulos históricos dos chamados.
7. Responsável desejado lista somente colaboradores ativos do destino selecionado. **Sem preferência** mantém fila aberta ao setor; uma escolha preserva a reserva exclusiva atual. Preferência não preenche a atribuição efetiva, e a elegibilidade é revalidada na abertura e na assunção.
8. Admin, CEO e TI mantêm visão global. Demais usuários ativos veem somente seus próprios pedidos e chamados destinados ao próprio setor. Listas, contadores, detalhe, chat, protocolos, notificações e integrações aplicam o mesmo escopo no servidor.
9. Visão global não concede operação global. Assunção exige colaborador ativo do destino, estado `ABERTO`, ausência de atendente e respeito à reserva. Conclusão rápida/com protocolo exige atendente efetivamente atribuído, ativo e elegível no destino. Dois atores concorrentes não podem assumir o mesmo chamado.
10. Mensagens distinguem solicitante e atendente por IDs persistidos. O solicitante pode participar do próprio chamado, e a resposta operacional exige o responsável efetivo conforme contrato atual. Ser Admin/TI/CEO ou abrir um pedido para o próprio setor não transforma o usuário automaticamente em atendente.
11. Os 224 chamados antigos preservam categoria textual, protocolo, atendentes, mensagens, prazo e feedback. Não há backfill: destino nulo é interpretado como TI pela autorização central. Uma categoria antiga chamada Financeiro não altera o destino legado para Financeiro.
12. Notificações persistidas e realtime respeitam destinatário/visibilidade; não encaminham automaticamente demandas de outros setores ao contato fixo de WhatsApp usado pelo TI. A integração legada de WhatsApp e Agenda TI mantém seu comportamento para chamados TI, sem criar agenda para os demais setores neste escopo.
13. O chat usa canal privado autorizado, valida acesso ao chamado ao assinar/ler/escrever e deriva lado/identidade no servidor. Marcadores atuais por lado não são apresentados como recibos individuais; não se cria sem requisito um sistema de leitura por pessoa.
14. Acesso direto por URL, Server Action, API, Pusher, Bibble e ChatBot não contorna setor, categoria, reserva nem ownership. Entradas legadas sem setor recebem tratamento de compatibilidade explícito e validado; não ocorre fallback silencioso de uma demanda multissetorial para TI.
15. A página mantém a tabela única de **Histórico de Atendimentos**, com as colunas atuais `#`, `Assunto / Categoria`, `Solicitante` condicional, `Urgência`, `Status`, `Abertura`, `Chat` e `Gestão`. Para colaborador comum, a consulta autorizada retorna seus pedidos OU chamados do próprio setor; para Admin/CEO/TI, retorna a visão global confirmada. A coluna Solicitante já existente passa a aparecer também para a equipe autorizada a visualizar a fila do setor, para identificar quem abriu demandas recebidas; sua condição não depende apenas da leitura global administrativa. O destino aparece como informação discreta junto da categoria na segunda linha da célula existente de assunto/categoria, sem exigir coluna nova. Os quatro cards originais continuam filtrando status pela URL e contando somente o universo autorizado. Não criar abas, navegação, busca ou filtros novos como consequência desta mudança.
16. Mudanças estruturais e seed exigem relatório Vault, backup completo verificado com até 48 horas, explicação do delta/ambiente/impactos/rollback e confirmação explícita específica. Esses requisitos foram atendidos antes da aplicação: após **“sim autorizo”**, gate Vault aprovado e comando específico aplicado com exit 0. Não houve backfill. Qualquer novo delta continua sujeito ao mesmo protocolo de AGENTS.md.
17. Preservar o visual atual: cabeçalho `CHAMADOS INTERNOS` em caixa alta, itálico e `font-black`, contêiner `max-w-7xl`, identificação Operador, botão Protocolos e quatro cards com os rótulos **Volume Total**, **Pendentes**, **Em Resposta** e **Concluídos**, cores, formas e espaçamentos atuais. O formulário mantém um único card de vidro centralizado em `max-w-2xl`, cores/radii/tipografia/espaçamento existentes, categorias radio roxas em duas colunas no desktop, urgência com as quatro cores originais, responsável e data lado a lado e botão azul inferior de largura total. Detalhes e chat conservam apresentação e estrutura; somente recebem destino e rótulos genéricos necessários. Não introduzir sidebar, nome Central de serviços, temas alternativos ou substituição global de fontes/tokens/densidade.

## Matriz de acesso implementada no código

| Ator ativo | Leitura | Assumir | Responder como atendente / concluir | Categorias |
|---|---|---|---|---|
| Colaborador comum | Próprios pedidos + fila do seu setor | Destino = seu setor; respeita reserva | Apenas se atribuído e elegível | Consultar ativas |
| Admin / CEO | Global | Mesmas regras de destino e reserva | Apenas se atribuído e elegível | Consultar ativas |
| TI / T.I | Global | Mesmas regras de destino e reserva | Apenas se atribuído e elegível | Gerenciar todos os setores |
| Solicitante | Próprio chamado | Só se também elegível para a fila | Mensagens como solicitante; sem autoatribuição | Consultar ativas |
| Não autenticado / inativo | Negado | Negado | Negado | Negado |

Autoassunção é permitida para pessoa ativa elegível ao destino, respeitando a reserva. Se solicitante e responsável são a mesma pessoa, o código não cria convite de feedback para si nem autoalertas de abertura/assunção/conclusão. Autoria de mensagem é resolvida pelos IDs persistidos; o papel global não transforma solicitante em atendente.

## Catálogo inicial provisionado com autorização

Inspeção real somente leitura registrada no [relatório Vault](../reports/vault-chamados-multissetorial-2026-10-15.md#checkpoint-anterior-à-edição-do-schema): 14 setores ativos, sendo 13 destinos reais e DESVINCULADO técnico excluído; TI já existia. Cada linha inclui **Outros do setor**, totalizando 53 categorias inseridas pelo provisionamento autorizado. O catálogo runtime consulta as categorias persistidas, sem seed durante leitura.

| Setor conhecido | Categorias iniciais |
|---|---|
| TI | Hardware; Software; Rede; Acesso |
| Admin | Compras e suprimentos; Documentos administrativos; Infraestrutura e patrimônio |
| CEO | Aprovação estratégica; Priorização e decisão; Assuntos institucionais |
| OPERACIONAL | Processos de importação; Desembaraço e documentação; Logística e entrega |
| COMERCIAL | Propostas e cotações; Clientes e oportunidades; Pós-venda |
| Lider Comercial | Aprovação comercial; Metas e distribuição de carteira; Apoio à negociação |
| RECURSOS HUMANOS | Férias e ausências; Folha e benefícios; Documentos e admissão |
| FINANCEIRO | Pagamentos e reembolsos; Contas a receber; Conciliação e comprovantes |
| JURÍDICO | Contratos; Pareceres e dúvidas; Notificações e prazos |
| PARCEIRO | Apoio ao parceiro; Documentação de parceria; Integração operacional |
| Serviços Gerais | Limpeza e conservação; Manutenção predial; Apoio e organização de ambientes |
| MARKETING | Comunicação e conteúdo; Materiais e identidade visual; Campanhas e divulgação |
| ADMINISTRATIVO | Processos administrativos; Documentos e registros; Materiais e suprimentos |

`DESVINCULADO` foi confirmado como sentinela técnica e é excluído por `isBase`. A role técnica TV não corresponde a destino e não recebe fila. As correspondências normalizadas dos destinos existentes não são ambíguas. Setores novos recebem categorias no fluxo transacional explícito de criação de setor, incluindo **Outros do setor**; leituras nunca fazem seed/upsert. Exclusão de TI ou de setor com categorias/chamados vinculados é impedida para preservar o histórico.

TI preserva a distinção atual entre Hardware, Software, Rede e Acesso e suas descrições. A categoria legada Financeiro/Contábil e Outro continua legível no histórico; ela não determina o destino do chamado antigo. Categorias dinâmicas têm nome/descrição e mantêm o padrão visual dos cartões; nenhum campo de código/SVG livre foi adicionado ao gestor.

## Implementação técnica e aplicação persistida

1. **Catálogo e identidade.** `acesso.ts` resolve usuário ativo e setor por `usuarios.role` normalizada, sem herdar operação global; `catalogo.ts` consulta setores/categorias e colaboradores ativos em leitura pura. Correspondência ausente/ambígua não libera atendimento.
2. **Persistência aditiva aplicada.** `ChamadoCategoria`, mapeado para `chamado_categoria`, contém setor, nome/normalizado, descrição opcional, ativo, ordem e timestamps, com unicidade por setor/nome. Chamados receberam `setorDestinoId`, `setorDestinoNome` e `categoriaId`, nullable; `categoria` textual permanece snapshot. SQL manual com FKs RESTRICT e índices aplicado após autorização específica. `tecnicoId` e `tecnicoSolicitadoId` continuam internos.
3. **Compatibilidade.** Zero UPDATE/backfill dos 224 legados; null significa TI na autorização. Novos chamados exigem setor/categoria válidos e gravam snapshots. Após a primeira demanda multissetorial, rollback mantém autorização nova e estruturas, bloqueando novas aberturas se necessário; app antigo não é rollback seguro. O app novo depende da migração e não deve ser publicado contra o banco antigo.
4. **Autorização central.** Actions/rotas reutilizam predicados de leitura, assunção, resposta e conclusão, com sessão/usuário persistido e CAS. Reserva exclusiva e elegibilidade são revalidadas; conclusão é restrita ao responsável ativo do destino. Gestão de categorias usa transação e valida TI novamente; categoria usada é arquivada, nunca removida do histórico.
5. **Integração.** Abertura manual, Bibble e ChatBot usam criação canônica; detalhe/chat/protocolos/notificações/Pusher aplicam o mesmo escopo. Chat usa canal privado e lado derivado pelo servidor. Agenda e WhatsApp fixo permanecem apenas TI; autoatendimento não cria feedback/autoalertas.

## Checkpoint Vault e backup

Relatório: [vault-chamados-multissetorial-2026-10-15.md](../reports/vault-chamados-multissetorial-2026-10-15.md). Após a etapa histórica WAITING_SPECIFIC_CONFIRMATION, o usuário confirmou **“sim autorizo”**, o gate Vault foi aprovado e o comando específico foi aplicado no Turso `banco-alpha` com exit 0. Resultado: 53 categorias inseridas em 13 destinos, 224 chamados preservados, integridade `ok` e zero violações de FK. Nenhum backfill ou setor criado.

- Backup completo dedicado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-15T17-32-29-956Z.sql` e manifesto correspondente, ignorados pelo Git.
- Manifesto em `2026-10-15T17:37:26.183Z`; 346.696.791 bytes, 336 tabelas e 270.656 registros. SHA-256 `843eda3280017886f40d5e12f05ffcf41e356a562cc063a1824e10f91b65f084`.
- Verificador executado com exit 0 antes da aplicação: restauração integral temporária, hash/tamanho/contagens iguais, `integrity_check = ok` e zero violações de FK; backup dentro de 48 horas.
- Aplicado somente SQL manual aditivo e seed idempotente pelo script específico, com banco/hash do plano/manifesto verificados. A proposta automática Prisma que reconstruía/removia chamados foi descartada.
- Evidências pós-aplicação em `.cache/chamados-multissetorial/database-apply.json`, `preservacao-before.json`, `preservacao-after.json` e `runtime-readonly.json`; comando/log em `/tmp/chamados-multissetorial-apply.log`. Hashes de todos os campos antigos iguais para 224 chamados, 179 mensagens, 43 feedbacks e 3 templates. O verificador de backup não foi tratado como ensaio do DDL novo; a aplicação autorizada foi validada diretamente.

## Plano visual derivado do código atual

O visual de referência é o módulo existente, observado no print original `/home/ialpha/projetos/image.png` e nos componentes abaixo. O desenho da versão 0.1 está **REJEITADO / SUPERADO**. A revisão 0.3 corrigiu a [prévia](../previews/chamados-multissetorial-v3.html), também disponível no caminho local anterior `chamados-multissetorial.html`. Após **“Aplique”**, os componentes reais foram implementados preservando o layout. Formulário/gestor e transição local do detalhe foram verificados em navegador com actions simuladas; validação autenticada contra banco migrado continua pendente. A tabela a seguir registra o diagnóstico pré-alteração; números de linha referem-se àquele snapshot.

| Evidência no código atual | Ajuste necessário, preservando a apresentação |
|---|---|
| `src/app/PainelAlpha/Chamados/page.tsx:63`: flag `podeAbrirChamado`; consulta filtra apenas solicitante para comuns | Liberar botão para ativos autorizados; expandir consulta para próprios pedidos OU destino do setor. Manter header, Operador, Protocolos, `max-w-7xl` e tabela única. |
| Mesma página `:195` e `:235`: cabeçalho/célula Solicitante condicionados a `podeVerTodos` | Reutilizar essa coluna também para membros autorizados da fila do setor; mostrar o solicitante da demanda recebida sem criar nova coluna ou outro layout. |
| `src/components/FiltroChamado.tsx`: quatro cards de status com navegação por query string | Manter rótulos, cores, tamanhos, raios, espaçamento e filtro por URL; calcular contadores com escopo autorizado. |
| `src/app/PainelAlpha/Chamados/NovoChamado/NovoChamadoForm.tsx:22` e `:48`: catálogo fixo e default Hardware | Carregar categorias do setor, preservando cartões com título/descrição; retirar seleção default incompatível. |
| Mesmo formulário `:77` e `:81`: `inputClass` compartilhado e `max-w-2xl` | Inserir somente o Select de destino em largura total após Título, usando o componente e as classes existentes. Conservar o único card central. |
| Mesmo formulário `:106`: legend Categoria e grid radio roxo | Tornar opções dinâmicas; adicionar `Settings` imediatamente junto ao texto Categoria, somente TI; abrir Dialog existente como referência visual. |
| Mesmo formulário `:113`: urgência com quatro valores e cores | Preservar integralmente valores, rótulos, disposição e estilos. |
| Mesmo formulário `:120`: técnico/data em grid de duas colunas | Renomear para Responsável desejado e filtrar por destino; manter posição, Select, data opcional e texto sobre reserva. |
| `src/app/PainelAlpha/Chamados/NovoChamado/page.tsx:18`: lista exclusiva de técnicos TI | Retornar colaboradores ativos do setor escolhido, com validação repetida no servidor. |
| `src/lib/chamados/schemas.ts:47`: enum fixo de categorias | Validar IDs dinâmicos coerentes com setor; preservar título 120, descrição 800, urgência e data. |
| `src/components/DetalhesChamado.tsx:103` e `:104`: papel administrativo usado nas ações | Revalidar capacidade por destino/atribuição; acrescentar setor junto da categoria nos metadados existentes e trocar rótulos técnico por responsável, sem refazer modal. |
| `src/components/ChatChamado.tsx`: chat existente | Manter visual; corrigir autorização/autoria/lado no servidor para contexto multissetorial. |
| `src/actions/chamados.ts:217`, `:237` e `:416`: criação, checagem TI e assunção | Generalizar elegibilidade ao destino, preservando validação, reserva e CAS. |
| `prisma/schema.prisma:702` e `:2454`: chamados sem destino e tabela Setor já existente | Propor vínculos aditivos ao catálogo canônico; qualquer execução aguarda Vault. |

Fluxo visual do formulário: **Título → Setor de destino → Categoria em cartões + ícone TI → Urgência atual → Responsável desejado e Conclusão desejada lado a lado → Descrição → botão Abrir chamado atual**. Alterar textos de ajuda que dizem técnico para responsável. No gestor, adicionar/editar/arquivar/excluir categorias dentro de Dialog coerente com `DetalhesChamado`, sem transformá-lo em nova página ou reorganizar o módulo.

## Preparação e autorização de implementação

- [x] Mapear fluxo atual, catálogo no código e integrações.
- [x] Registrar as duas decisões de acesso confirmadas pelo usuário.
- [x] Preparar plano revisado em Draft, com categorias iniciais e etapas futuras.
- [x] Rever evidências do código e registrar ajustes mínimos de apresentação.
- [x] Registrar rejeição do protótipo anterior e preservar o layout atual como requisito verificável.
- [x] Substituir o HTML anterior pela prévia v0.3, preservando header/cards/tabela/formulário e acrescentando apenas os elementos multissetoriais previstos.
- [x] Conferir a prévia corrigida em Chromium: título 900/italic/uppercase, quatro cards, oito colunas, formulário centralizado, dependências de setor/responsável, gestão TI, CRUD/arquivamento e mobile de 390 px sem overflow; zero erros JS e zero requisições externas. Evidência: `docs/previews/chamados-v3-validacao.json`.
- [x] Receber **“Aplique”** para implementação do código, preservando o gate específico de banco.

## Tasks / Subtasks

- [x] Fase 1 — Inventário e regras (AC 1, 4, 7–14, 17).
  - [x] Inspeção real somente leitura: 13 setores ativos reais, TI existente, `DESVINCULADO` técnico excluído. Marketing e Administrativo foram encontrados além do inventário inicial no código. Os 224 chamados legados permanecerão intactos; destino nulo é atendido pela compatibilidade TI, sem backfill.
  - [x] Fechar leitura global versus operação por destino, reserva exclusiva, autoassunção permitida e supressão de auto-feedback/autoalertas.
  - [x] Registrar layout original e correção da prévia; usar componentes reais como referência da implementação.
- [x] Fase 2 — Estrutura e provisionamento (AC 4, 6, 11, 16).
  - [x] Preparar schema Prisma, SQL manual aditivo e script específico com dry-run padrão; validar schema e gerar cliente localmente.
  - [x] Preparar 53 sugestões em 13 destinos e proteção idempotente que insere somente nomes ausentes, sem editar/reativar categorias existentes.
  - [x] Emitir relatório Vault, gerar backup completo dedicado e comprovar restauração/integridade/FKs/contagens.
  - [x] Apresentar delta concreto e obter confirmação explícita específica do banco/plano: **“sim autorizo”**, com gate Vault aprovado.
  - [x] Aplicar somente o comando específico autorizado; validar catálogo/colunas/índices/integridade/contagens, sem backfill, com exit 0.
  - [x] Comprovar hashes idênticos dos campos antigos de chamados/mensagens/feedbacks/templates e validar runtime Prisma real somente leitura.
- [x] Fase 3 — Backend e contratos implementados localmente (AC 1–14).
  - [x] Centralizar ator ativo, catálogo em leitura pura, visibilidade e elegibilidade por destino.
  - [x] Criar validação compartilhada e abertura canônica com categoria/colaborador do destino e snapshots.
  - [x] Implementar CRUD/arquivamento TI, assunção/conclusão com reserva/CAS e protocolo compatível.
  - [x] Corrigir chat privado, autoria/lado no servidor, notificações e integrações Bibble/ChatBot; preservar Agenda/WhatsApp somente TI.
  - [x] Cobrir matriz de autorização, categorias, criação, reserva, concorrência e integrações com testes.
- [x] Fase 4 — UI integrada no código, mantendo o layout (AC 2–15, 17).
  - [x] Liberar Novo chamado para ativos, reutilizar tabela/coluna Solicitante e exibir destino junto da categoria.
  - [x] Adicionar Select de setor antes dos cartões de categoria, filtrar responsáveis, preservar título/urgência/data/descrição e conectar Dialog de categorias TI.
  - [x] Adequar detalhe/chat a capacidades do servidor, rótulos genéricos e destino; corrigir estado local após conclusão.
- [ ] Fase 5 — Qualidade, aplicação persistida e encerramento (AC 1–17).
  - [x] Executar lint/TypeScript/build e suíte geral, separando falhas antigas; toda a suíte de Chamados aprovada.
  - [x] Verificar Form/Dialog React reais em navegador com actions simuladas, incluindo TI/Admin, dependências, CRUD e mobile.
  - [x] Verificar mesma instância do detalhe após assumir/concluir e reabrir chamado concluído, sem ações indevidas e sem erros JS.
  - [x] Concluir revisão Lens: aprovado com ressalvas, sem bloqueante/importante remanescente. A pendência de banco então registrada foi resolvida pela aplicação autorizada; baseline global permanece.
  - [x] Atualizar checklist, File List e evidências desta story.
  - [x] Aplicar delta autorizado e registrar validação pós-aplicação, preservação de dados e leitura real Prisma.
  - [ ] Homologar fluxo completo autenticado com persistência real, realtime e regressão visual contra o original.
  - [x] Encaminhar para review com limites explícitos; sem marcar Done integral, PR, commit, push, deploy ou publicação.

## Dev Notes e referências

- `prisma/schema.prisma`, modelos `chamados`, `ChamadoCategoria`, `Setor`, `usuarios`, `MensagensChamado`: contrato aditivo aplicado no banco real após consentimento específico; preferência e atribuição permanecem distintas.
- `src/actions/gestaoSetores.ts`, catálogo base e `getSetoresParaSelect`: inventário no código; a leitura atual pode escrever, por isso não deve ser reutilizada como consulta pura.
- `src/actions/chamados.ts`: abertura, listagem, assunção, mensagens, finalização rápida e consulta operacional com autorização central; `avisarNoZap` condicionado ao destino TI.
- `src/lib/chamados/schemas.ts`: contrato compartilhado por IDs, preservando urgência/data/descrição. `src/lib/roles.ts`: normalização de TI/T.I e bypass de `isAdminRole`, inadequado para gestão exclusiva TI.
- Stories anteriores registram dívidas globais de lint/typecheck/test e risco residual de ausência de E2E real; seus resultados históricos não validam a reformulação.
- No levantamento inicial, a configuração apontava `docs/architecture/index.md` e `docs/framework/`, ausentes neste checkout; `.aiox/gotchas.json` e `accumulated-context.md` não foram encontrados. O contexto técnico foi obtido pelo código e pelas stories relacionadas, seguido de revisão de arquitetura/segurança da implementação.
- [AUTO-DECISION histórica] Criar draft local sem epic/ClickUp → usar pedido direto e stories existentes; nenhum vínculo externo foi fornecido e não houve sincronização externa.
- O inventário inicialmente proposto foi substituído pela evidência real somente leitura do relatório Vault.

## Testing — cobertura e validação pendente

- **Domínio/actions, Vitest:** tabela de papéis cruzando solicitante, mesmo setor, outro setor, escolhido, atribuído e inativo; exigir leitura correta e negar operação mesmo com visão global. Testar payload forjado de setor/categoria/responsável.
- **Concorrência:** duas assunções simultâneas geram um único vencedor; escolhido exclusivo, usuário desativado/remapeado, mudança de estado e duas conclusões não duplicam efeitos.
- **Categorias/histórico:** criar/editar/arquivar/reativar, duplicidade por setor, delete sem referência e corrida delete x abertura; categoria usada nunca desaparece do histórico. Setor desativado não recebe novas demandas.
- **Integração:** página, filtros, contadores, detalhes, chat, protocolos, painel TI, central/polling/realtime e APIs compartilham escopo. Canal privado nega terceiros; remetente/lado forjado é ignorado. Bot/Bibble não burlam validação.
- **Regressão:** `tests/chamados/`, `tests/bibble/chamado-creation-security.test.ts` e `tests/google-calendar/chamado-solicitante-readonly.test.ts`; preservar feedback, data civil `America/Sao_Paulo`, Agenda TI e falhas de Pusher sem perda de persistência.
- **UI/E2E autenticado:** TI/Admin conseguem abrir; comum vê fila do setor e próprios pedidos na mesma tabela, com nome do solicitante de demandas recebidas na coluna existente; manager só TI; trocar setor limpa dependências; foco, teclado, viewport móvel e estados vazio/erro/loading funcionam.
- **Regressão visual obrigatória:** comparar a implementação futura com `/home/ialpha/projetos/image.png` e captura autenticada da aplicação original nas mesmas dimensões. Confirmar header/Operador/Protocolos, cards originais, tabela/colunas, `max-w-7xl`, formulário `max-w-2xl`, categorias radio roxas, urgência, grid responsável/data, descrição e botão azul. Diferenças esperadas limitam-se ao novo destino, ícone/modal TI, categorias por setor e textos necessários. HTML/PNGs rejeitados não podem servir de baseline ou de evidência de aceite do usuário.
- **Banco:** aplicação específica autorizada concluída; contagens/hashes antigos preservados, integridade/FKs e catálogo verificados. Runtime Prisma real somente leitura validou 13 destinos, 53 categorias, 27 responsáveis elegíveis e 29 atores ativos, comparando escopo SQL e predicado para cada ator. E2E autenticado de criação/atendimento com escrita real continua pendente.
- **Gates executados:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; evidências finais na seção QA. Suíte global mantém as falhas anteriores; testes reais pós-migração foram somente leitura e não substituem homologação autenticada completa.

**Baseline histórico da análise (2026-10-15, anterior à implementação):** lint/TypeScript aprovados; lint com 1.193 avisos e zero erros. Testes: 624 arquivos aprovados/4 com falha; 4.648 testes aprovados/6 com falha/4 ignorados/1 todo. Falhas fora de Chamados em `tests/bpm/arquivamento-modal-react.test.ts`, `tests/builder/embed.test.ts`, `tests/bpm/card-modal-integration.test.ts` e `tests/bpm/em-tratativa.test.ts`. Logs `/tmp/chamados-planejamento-{lint,typecheck,tests}.log`. Até aquele checkpoint somente documental, código não havia sido alterado e build não havia sido executado; os resultados posteriores de implementação estão abaixo.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Integration; secundários Database, API, Frontend e Security; complexidade alta.

**Specialized Agents:** `@dev` executor; `@architect` revisão de contratos/autorização; `@data-engineer`/`@db-sage` desenho/SQL com Vault; `@ux-design-expert`/`@ux-expert` UI; `@qa` qualidade; `@devops`/`@github-devops` somente quando houver publicação autorizada.

**Quality Gate Tasks:**

- [x] Revisão local do delta, contratos, auth, concorrência e acessibilidade: Lens aprovado com ressalvas; sem bloqueantes/importantes remanescentes. Não há evidência de execução da CLI CodeRabbit nesta etapa.
- [ ] Pre-PR (@github-devops): integração, compatibilidade e testes; somente se PR for solicitado/autorizado.
- [ ] Pre-Deployment (@github-devops): SQL/backup/rollback e ausência de escritas não autorizadas, se houver deploy.

**Self-Healing Configuration:** @dev light, máximo 2 iterações/15 minutos, CRITICAL com tentativa de correção; HIGH documentado, MEDIUM/LOW fora do auto-fix. QA full até 3 iterações/30 minutos para CRITICAL/HIGH; DevOps check reporta. Indisponibilidade da CLI deve ser registrada, sem alegar revisão executada.

**Focus Areas:** escopo por setor em todas as superfícies, separação leitura/operação, reserva e CAS, IDs coerentes, canal privado/autoria, preservação histórica, migrations aditivas e não ampliação da Agenda/WhatsApp TI.

## File List

**Autoria desta story:** `docs/stories/story-chamados-multissetorial.md`.

**Prévia corrigida v0.3 que antecedeu a autorização “Aplique”:** `docs/previews/chamados-multissetorial.html` (substituído no mesmo caminho) e sua cópia versionada `docs/previews/chamados-multissetorial-v3.html`.

**Imagens/evidências v0.3:** `docs/previews/chamados-v3-painel.png`, `chamados-v3-novo.png`, `chamados-v3-categorias.png`, `chamados-v3-mobile.png` e `chamados-v3-validacao.json`, na mesma pasta. Os aliases `chamados-central.png`, `chamados-novo.png`, `chamados-categorias.png`, `chamados-mobile.png` e `chamados-validacao.json` foram atualizados para esta versão. `chamados-atelier.png` e `chamados-operacao.png` continuam históricos e rejeitados.

**Evidência dos componentes reais:** `.cache/chamados-multissetorial/browser-react.json`, `browser-details.json`, `formulario-real-desktop.png`, `formulario-real-mobile.png` e `gerenciamento-real-desktop.png`. Actions simuladas; nenhum acesso ao banco nesses ensaios.

**Evidência da aplicação e leitura real:** `.cache/chamados-multissetorial/database-apply.json`, `preservacao-before.json`, `preservacao-after.json`, `runtime-readonly.json`; log temporário `/tmp/chamados-multissetorial-apply.log`. Dumps/manifestos reais permanecem ignorados pelo Git.

**Memória relacionada, atualizada pelo agente principal:** `.bibble/memory/architecture.md`, `decisions.md`, `codebase-map.md`, `integration-points.md`, `components.md`, `journal.md`, `design-tokens.md` e `patterns.md`, todos em `.bibble/memory/`.

**Arquivos reais de implementação conferidos no status/diff, somente escopo Chamados:**

- Banco/CLI/relatório: `prisma/schema.prisma`; `prisma/migrations/20261015190000_chamados_multissetorial/migration.sql`; `scripts/chamados-multissetorial.mjs`; `docs/reports/vault-chamados-multissetorial-2026-10-15.md`. Delta específico aplicado após consentimento; não foram executadas migrations globais.
- Actions: `src/actions/chamados.ts`; `src/actions/chamados-categorias.ts`; `src/actions/protocolos.ts`; `src/actions/gestaoSetores.ts`.
- Domínio: `src/lib/chamados/acesso.ts`; `catalogo.ts`; `categorias-iniciais.ts`; `criacao.ts`; `schemas.ts`; `conclusao.ts`; `notificacoes.ts`; `notificacoes-server.ts`, todos em `src/lib/chamados/`.
- Páginas: `src/app/PainelAlpha/Chamados/page.tsx`; `src/app/PainelAlpha/Chamados/NovoChamado/page.tsx`; `src/app/PainelAlpha/Chamados/NovoChamado/NovoChamadoForm.tsx`.
- Componentes: `src/components/chamados/GerenciarCategoriasDialog.tsx`; `src/components/DetalhesChamado.tsx`; `src/components/ChatChamado.tsx`.
- APIs/notificações: `src/app/api/ChatBot/AbrirChamado/route.ts`; `src/app/api/notificacoes/route.ts`; `src/app/api/pusher/auth/route.ts`; `src/hooks/useAdminChamadosNotifications.ts`.
- Bibble/registro: `src/lib/bibble/tools.ts`; `src/lib/bibble/tool-executor.ts`; `src/lib/bibble/chamado-guard.ts`; `src/lib/modulos-registry.ts`.
- Testes novos: `tests/chamados/multissetorial-acesso.test.ts`; `multissetorial-actions.test.ts`; `multissetorial-setores.test.ts`; `integracoes-auth-api.test.ts`; `integracoes-notificacoes-hook.test.ts`, todos em `tests/chamados/`.
- Testes atualizados em `tests/chamados/`: `assumir.test.ts`, `central-notificacoes-painel.test.ts`, `conclusao-feedback.test.ts`, `criar-chamado-preferencia.test.ts`, `feedback-schemas.test.ts`, `feedback-ui.test.ts`, `finalizar-protocolo-agenda.test.ts`, `finalizar-rapido-feedback.test.ts`, `mensagens-central.test.ts`, `notificacoes-api.test.ts`, `notificacoes.test.ts`, `origem-bibble.test.ts` e `painel-operacional-ti.test.ts`.
- Teste Bibble atualizado: `tests/bibble/chamado-creation-security.test.ts`.

Mudanças locais de Agenda Alpha, CRM e outras stories não pertencem a esta File List e foram preservadas. `FiltroChamado`, shell, painel operacional e store foram reutilizados sem alteração direta, por isso não são listados como arquivos implementados.

## Validação documental e estado de encerramento

Checklist de draft aplicada na preparação: `.aiox-core/product/checklists/story-draft-checklist.md`, modo YOLO; esta revisão atualiza rastreabilidade com os artefatos reais. Resultados de implementação e limites constam em QA.

| Categoria | Resultado | Evidência / limite |
|---|---|---|
| Objetivo e contexto | PASS | Pedido direto, duas regras confirmadas e dependências resumidas |
| Orientação técnica | PASS | Modelo proposto, matriz, integração, fases, File List e tabela código → ajuste mínimo |
| Referências | PARTIAL | Fontes locais e stories verificadas; arquitetura central ausente; protótipo anterior rejeitado, referência visual agora é o original |
| Autocontenção | PASS | Catálogo, regras, compatibilidade e edge cases no documento |
| Testes | PASS documental | Cobertura executada e limitações de banco/E2E explicitadas em QA |
| CodeRabbit | PASS | Tipos, agentes, checkpoints, self-healing e foco definidos |

**Avaliação: Ready for Review, homologação autenticada pendente.** Código implementado, delta específico autorizado/aplicado e banco validado, incluindo leitura real Prisma e preservação de dados. A apresentação preserva o módulo existente; alternativas visuais da versão 0.1 seguem rejeitadas. E2E autenticado/realtime real e publicação não foram executados; não declarar Done integral.

## Change Log

| Data | Versão | Alteração | Autor |
|---|---|---|---|
| 2026-10-15 | 0.1 | Draft de análise e plano multissetorial, sem implementação ou mutação de banco. | River / Codex |
| 2026-10-15 | 0.2 | Plano corrigido após rejeição visual: evidências do código, layout atual preservado, ajustes mínimos e protótipos anteriores marcados como superados. Nenhuma alteração de aplicação, protótipo ou banco. | River / Codex |
| 2026-10-15 | 0.3 | HTML efetivamente substituído no mesmo caminho e cópia versionada criada; screenshots e validação Chromium renovados. Layout original preservado; somente prévia/documentação, sem alteração de aplicativo ou banco. | Nova / Codex |
| 2026-10-15 | 0.4 | Código implementado após “Aplique”, catálogo real 13/53, legados null=TI sem backfill, gates e navegador de componentes reais registrados; Lens aprovado com ressalvas. Backup restaurado/verificado e SQL preparado, aguardando consentimento específico de banco. | Codex / River |
| 2026-10-15 | 0.5 | Após “sim autorizo” e gate Vault aprovado, migração específica aplicada no banco-alpha: 53 categorias, integridade/FKs e preservação histórica verificadas; Prisma real readonly aprovado. Ready for Review, homologação autenticada/realtime e publicação pendentes. | Codex / River |

## Dev Agent Record

### Agent Model Used

Codex, com agentes de backend, frontend, integrações, dados/Vault e revisão Lens; consolidação documental River.

### Completion Notes

- Implementados catálogo dinâmico, abertura multissetorial, gestor TI e autorização compartilhada, preservando layout e contratos de reserva/CAS.
- Colaborador vê próprios pedidos + destino do setor; Admin/CEO/TI mantêm leitura global sem operação global. Autoassunção elegível permanece; não há feedback/autoalertas para si.
- Integrações manual/Bibble/ChatBot, protocolos/chat e notificações usam escopo canônico; Agenda e WhatsApp fixo permanecem TI. Detalhe reconcilia estado local após conclusão.
- Schema/SQL aditivos e seed idempotente aplicados após consentimento específico, com 13 destinos e 53 categorias inseridas. Os 224 chamados antigos não foram atualizados; destino null significa TI.
- Backup dedicado verificado, gate Vault aprovado e aplicação com exit 0. Hashes antigos, integridade e FKs preservados; Prisma real somente leitura aprovado. Homologação autenticada/realtime e publicação não executadas.

### Debug Log References

- `/tmp/chamados-implementacao-lint.log` e `/tmp/chamados-integracoes-lint.log` — lint sem erros, com avisos documentados abaixo.
- `/tmp/chamados-probe-typecheck.log` — TypeScript aprovado.
- `/tmp/chamados-implementacao-build-final.log` — build final aprovado.
- `/tmp/chamados-implementacao-tests-final.log` — suíte final com as mesmas falhas globais do baseline.
- `.cache/chamados-multissetorial/browser-react.json` e `browser-details.json` — ensaios dos componentes reais com actions simuladas.
- Relatório Vault vinculado nesta story — inventário, SQL, hashes, backup, consentimento e execução específica.
- `/tmp/chamados-multissetorial-apply.log` e `.cache/chamados-multissetorial/{database-apply,preservacao-before,preservacao-after,runtime-readonly}.json` — aplicação e validações reais pós-migração.

## QA Results

- **Lint:** aprovado, zero erros. O log global registra 1.194 avisos contra 1.193 no baseline; o aviso adicional de `_setor` no teste Bibble foi corrigido posteriormente. Reexecução final de `npx eslint tests/bibble/chamado-creation-security.test.ts` passou sem avisos (`/tmp/chamados-bibble-lint-final.log`). O log global anterior não foi recontado após essa correção.
- **TypeScript e build finais:** aprovados, com logs acima. Schema Prisma validado e cliente gerado localmente; DDL foi aplicado posteriormente pelo comando específico autorizado, não pelo build/validador.
- **Testes finais:** 629 arquivos aprovados e 4 com falha; 4.693 testes aprovados, 6 com falha, 4 ignorados e 1 todo, de 4.704. Todos os testes de Chamados passam. Permanecem as mesmas seis falhas anteriores de BPM/builder nos quatro arquivos já documentados no baseline; a suíte global não é declarada verde.
- **Navegador — Form/Dialog reais:** `browser-react.json` aprovado; valida campos obrigatórios, setor→categoria/responsável, ícone exclusivo TI/Admin sem gestor, CRUD/arquivo/reativação, formulário em portal sem submeter chamado, limpeza de dependências, FormData real e mobile 390 px sem overflow. Zero erros JS. Actions simuladas, sem leituras/escritas de banco.
- **Navegador — detalhe real:** `browser-details.json` aprovado; mesma instância/ID passa ABERTO→assumir→Finalizar imediato→fechar→rerender CONCLUIDO→reabrir sem Assumir/Finalizar. Zero erros JS; actions simuladas, sem banco.
- **Lens:** APROVADO COM RESSALVAS; nenhum bloqueante/importante remanescente. A ressalva histórica de banco pendente foi resolvida pela aplicação/validação autorizada; permanecem baseline global e limites de homologação.
- **Vault/aplicação real:** após **“sim autorizo”** e gate aprovado, comando exato aplicado no Turso `banco-alpha` com exit 0; 53 categorias inseridas em 13 destinos, quatro índices conferidos, 224 chamados legados preservados, integridade `ok` e zero violações de FK. `database-apply.json` aprovado; backup completo restaurado/verificado antes da mudança.
- **Preservação real:** hashes antes/depois iguais para todos os campos antigos de 224 chamados, 179 mensagens, 43 feedbacks e 3 templates. Nenhum backfill; destinos legados continuam null=TI.
- **Runtime real somente leitura:** `runtime-readonly.json` aprovado via Prisma; 13 destinos, 53 categorias com datas válidas, 27 responsáveis elegíveis e 29 atores ativos. Escopo SQL coincide com predicado de acesso para cada ator; legados null preservados. Uma leitura adicional sofreu ConnectTimeout pontual e passou no retry somente leitura; nenhuma mutação foi repetida.
- **Limites:** não houve E2E autenticado com criação/atendimento persistido, validação realtime real, PR, commit, push, deploy ou publicação. Componentes com actions simuladas e Prisma real readonly não substituem essas etapas. Status Ready for Review, sem Done integral.
