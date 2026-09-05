# Diagnóstico integral do Alpha CRM/BPM

**Data do diagnóstico:** 2026-09-04
**Horário de corte dos dados:** 21:46 UTC
**Commit publicado analisado:** `bd14013710de77a313e1f5d0a0d4ad7ef6f490fd`
**Banco ativo:** Turso `banco-alpha-alphacomex.aws-us-east-1.turso.io`
**Modo do diagnóstico:** somente leitura. Nenhuma mutation, migration, correção de código, reinício de serviço ou alteração de configuração foi executada.

## 1. Conclusão executiva

O CRM/BPM possui uma base técnica ampla: Kanban, cards, formulários por etapa, tarefas, histórico, reuniões, anexos, checklists, cadências, regras, SLA, automações, webhooks, permissões e configurações administrativas estão modelados no código e no schema.

Apesar disso, o ambiente **não está pronto para uma operação normal ponta a ponta pelas equipes**. O núcleo de cards é utilizável por administradores, mas há bloqueios operacionais e de entrega importantes:

1. As equipes `COMERCIAL` e `OPERACIONAL` não possuem acesso efetivo ao módulo CRM no banco atual.
2. Dez campos de seleção ativos não possuem nenhuma opção e renderizam somente `Selecione...`.
3. Automação, regras, SLA, cadências, checklists e conhecimento possuem estrutura, porém estão sem configuração/dados reais.
4. Dois jobs legados importantes existem no código, mas não estão no manifesto de cron do Vercel.
5. Existe uma tarefa vencida com alerta devido e ainda não disparado.
6. O fluxo de fechamento do modal em `Em tratativa` perdeu o retorno de estado do checklist de follow-up e pode permanecer bloqueado em `CARREGANDO`.
7. A suíte BPM está vermelha: 666 testes passam e 22 falham.
8. O typecheck global tem 34 erros; 5 estão diretamente no motor de pendências BPM.
9. Três páginas do CRM e três migrations necessárias existem apenas no workspace local, fora do commit publicado.
10. Há dois mecanismos de transição simultâneos. O mecanismo novo permite todos os 276 pares; o legado tem somente 19 relações e usa fallback aberto quando uma etapa não possui saídas cadastradas.

### Veredito por dimensão

| Dimensão | Estado | Diagnóstico |
|---|---|---|
| Integridade do banco | Verde | `integrity_check=ok`, zero violações de FK e zero órfãos nas relações críticas verificadas. |
| Deploy atual | Verde com ressalvas | Vercel concluiu com sucesso o commit `bd140137`, mas o build ignora validação TypeScript. |
| Cards/Kanban | Amarelo | Núcleo implementado e com dois cards reais, porém praticamente só administradores conseguem operar. |
| Campos por etapa | Amarelo | Estrutura avançada e 217 ocorrências efetivas; há seleções vazias, campos sem chave e etapas sem campos. |
| Transições | Vermelho | Matriz nova totalmente aberta e fallback legado permite movimentos não desenhados. |
| Automações/jobs | Vermelho | Motores sem definições cadastradas e jobs legados ausentes do cron publicado. |
| Regras/SLA/checklists/cadências | Vermelho | Código e tabelas existem, mas não há configuração operacional. |
| Permissões | Vermelho | Comercial e Operacional têm zero usuários com acesso efetivo ao CRM. |
| Qualidade automatizada | Vermelho | Testes, typecheck e lint não estão completamente verdes. |
| Reprodutibilidade da entrega | Vermelho | Rotas e migrations necessárias continuam locais e não rastreadas no Git. |

## 2. Achados prioritários

### P0 — corrigir antes de declarar o CRM operacional

#### P0.1 — Comercial e Operacional sem acesso efetivo

O backend exige, corretamente, usuário ativo e permissão efetiva `crm`. Para não administradores, também exige compatibilidade com o setor do pipeline ou vínculo como membro de algum card do pipeline.

Estado atual:

| Perfil | Usuários ativos | Acesso efetivo ao CRM |
|---|---:|---:|
| Admin | 2 | 2 |
| CEO | 2 | 2 |
| TI | 2 | 2 |
| FINANCEIRO | 1 | 1 |
| Lider Comercial | 4 | 1 |
| COMERCIAL | 6 | 0 |
| OPERACIONAL | 5 | 0 |
| Demais perfis ativos | 6 | 0 |

Setores dos pipelines:

| Pipeline | Setor exigido |
|---|---|
| Financeiro | FINANCEIRO |
| Operacional | OPERACIONAL |
| Radar, inativo | OPERACIONAL |
| Revisão de Radar | COMERCIAL |

Consequências:

- os cinco usuários Operacionais não passam pela permissão do módulo;
- os seis usuários Comerciais não passam pela permissão do módulo;
- o único Lider Comercial com `crm` não corresponde ao setor `COMERCIAL` e não está vinculado a card;
- existem somente um vínculo em `BpmCardMembro`, pertencente a TI;
- os dois cards atuais têm responsável TI, que passa pelo bypass administrativo.

Na prática, os pipelines Comercial e Operacional ficam dependentes de Admin, CEO ou TI.

#### P0.2 — seleções impossíveis de preencher

Há 28 campos ativos do tipo seleção. Dez não possuem opção estruturada nem `opcoesJson`. O componente `CampoBpmInput` renderiza um `<select>` somente com a opção vazia, e o backend rejeita qualquer valor que não pertença ao catálogo.

Campos afetados:

- Financeiro: `Status da assinatura`, `Status do contrato`, `Status financeiro`.
- Operacional: `Andamento/status atual`, `Motivo do indeferimento/exigência`, `Classificação do motivo`, `Solução adotada`.
- Revisão de Radar: `Regime tributário`, `Radar atual`, `Status da sede`.

Esses campos estão funcionalmente indisponíveis até terem opções válidas.

#### P0.3 — agendamentos incompletos

O manifesto `vercel.json` agenda somente `/api/bpm/jobs/automacoes` a cada cinco minutos.

Também existem as rotas:

- `/api/bpm/jobs/automacao-novos-leads` — follow-up, ciclo de oito dias, Standby, Monitoramento e polling de transcrição;
- `/api/bpm/jobs/alertas-tarefas` — alertas internos de tarefas.

Essas duas rotas não estão no manifesto publicado. Não foi encontrada outra configuração versionada que as agende. Pode existir um scheduler externo não versionado, mas não há evidência dele no repositório.

Evidência operacional: há duas tarefas pendentes com prazo e alerta; uma já está vencida, seu alerta está devido e `alertaDisparadoEm` continua nulo.

O cron que está agendado processa os motores configuráveis, porém o banco possui zero automações, zero agendas, zero eventos de domínio e zero cadências. Portanto, o cron publicado não substitui os comportamentos legados enquanto eles não forem migrados e ativados.

#### P0.4 — regressão no fechamento do card em Em tratativa

`CardFullViewModal` mantém o estado `estadoFollowUpAtual` e bloqueia o fechamento do modal em `Em tratativa` enquanto o checklist estiver `CARREGANDO`, `ERRO` ou `EM_ANDAMENTO`.

Após a refatoração para `CardOpenFormSlot`, o callback `onEstadoFollowUpChange` não é repassado por `PainelRegistrar`. O slot usa o callback padrão vazio. `CardAbertoLayout` recebe o callback, mas também não o utiliza.

Resultado provável: em `Em tratativa`, o estado externo permanece `CARREGANDO`, mesmo quando o painel interno terminou de carregar. Isso pode impedir o usuário de fechar o card. O lint confirma várias props relacionadas que ficaram sem uso, e os testes de integração do modal estão falhando justamente após essa redistribuição de responsabilidades.

#### P0.5 — entrega publicada diferente do workspace

O commit publicado está verde no Vercel, mas ainda faltam arquivos necessários que existem somente localmente:

- página `/PainelAlpha/AlphaCRM/pendencias` e seus componentes;
- página `/PainelAlpha/AlphaCRM/admin/conhecimento` e seu componente;
- página `/PainelAlpha/AlphaCRM/admin/regras` e seus componentes;
- migration `20260904133000_bpm_regras_persistencia`;
- migration `20260904160000_bpm_sla_prazos_alertas`;
- migration `20260904180500_bpm_sla_config_completa`.

O menu publicado aponta para Pendências e Base de Conhecimento, mas as páginas não pertencem ao commit. Essas URLs tendem a responder 404 na versão publicada. A página de regras também não está empacotada.

As tabelas de regras e SLA já existem no banco ativo. Sem as migrations no Git, um ambiente novo não consegue reproduzir o schema somente a partir do repositório.

No horário de corte havia 33 entradas modificadas/não rastreadas no worktree. O workspace não deve ser usado como prova daquilo que está efetivamente publicado.

### P1 — completar a configuração do produto

#### P1.1 — motores avançados vazios

Todas estas capacidades possuem código e schema, mas zero configuração operacional:

- automações e versões;
- agendas e execuções de automação;
- eventos de domínio/outbox;
- cadências e vínculos de cadência;
- regras gerais e regras financeiras;
- SLA, instâncias, limites, disparos e eventos;
- templates e instâncias de checklist;
- links da base de conhecimento;
- substatus;
- visibilidade por etapa;
- acesso por perfil de campo;
- mapeamentos/cópias de campos;
- interações, anexos e vínculos entre cards.

Isso significa que a presença da tela ou da tabela não equivale a uma funcionalidade ativa.

#### P1.2 — transições abertas e duas fontes de verdade

Existem dois modelos simultâneos:

1. `BpmTransicaoEtapa`: 276 pares, todos `permitida=true`, todos com origem `AMBOS`. É a matriz completa de todos os pares internos dos quatro pipelines.
2. `BpmEtapaTransicaoPermitida`: 19 relações legadas, usadas para limitar opções no modal e também validadas no backend.

Comportamento efetivo:

- se uma etapa possui pelo menos uma relação legada de saída, somente os destinos legados são aceitos;
- se a etapa não possui relação legada de saída, o backend usa fallback aberto;
- a matriz nova também está totalmente aberta, portanto não acrescenta restrição;
- o Operacional não tem relações legadas e, hoje, aceita qualquer movimento interno;
- etapas finais/laterais da Revisão de Radar sem saída legada também caem no fallback aberto;
- isso contradiz regras de negócio documentadas, como Monitoramento sair somente para Em tratativa ou Lost.

No Financeiro há ainda uma relação entre a etapa ativa `Elaboração do Contrato` e uma etapa inativa com o mesmo nome. A UI tende a ocultar o destino inativo, mas a relação é resíduo de configuração.

#### P1.3 — metadados das etapas não configurados

Das 32 etapas:

- 31 estão ativas;
- zero têm `ehInicial=true`;
- zero têm `ehFinal=true`;
- zero têm `slaDias`;
- zero têm script;
- zero têm cor configurada.

O sistema continua funcionando por ordem e fallbacks, mas o gestor de etapas não está realmente parametrizado.

#### P1.4 — campos avançados parcialmente migrados

- 117 campos cadastrados;
- 111 ativos e 6 inativos;
- 18 campos ativos sem chave estável;
- 167 configurações por etapa, todas visíveis e agrupadas;
- 144 configurações editáveis e 23 somente leitura;
- 4 obrigatórias na etapa;
- zero obrigatórias para entrada;
- 19 obrigatórias para saída;
- zero condições de visibilidade;
- zero condições de obrigatoriedade;
- zero regras de acesso por perfil;
- zero mapeamentos entre campos.

Há 36 campos globais ativos:

- 7 ligados a fontes canônicas (`CLIENTE` ou `CONTATO`);
- 29 campos globais personalizados com entidade `CLIENTE`;
- somente 5 valores globais personalizados persistidos.

Os 18 campos ativos sem chave são:

- Financeiro: `Regime tributário do cliente`, `Contato/Nome do responsável`, `Observações comerciais`, `Status do contrato/assinatura`, `Regime tributário do prestador`, `Alíquota IRRF`, `Valor IRRF`, `Alíquota CSRF`, `Valor CSRF`, `Total de retenções`, `Valor líquido para pagamento`, `Memória de cálculo`, `Comprovante de pagamento`.
- Operacional: `CPF do responsável`.
- Revisão de Radar: `Exportador`, `Nível de complexidade para a revisão`, `Histórico de tentativas anteriores de revisão`, `Motivo de Lost - Outro`.

#### P1.5 — dados residuais

Existe a tabela `BpmCard_old_fixfk` com quatro cards antigos que não existem em `BpmCard`. Os quatro ainda referenciam empresas, pipeline e etapas existentes, mas não têm histórico, valores ou tarefas relacionados nas tabelas vivas.

Não é possível concluir somente por leitura se eram testes, backup de reparo ou cards que deveriam ter sido preservados. A tabela não deve ser apagada sem backup e decisão de negócio.

### P2 — qualidade e manutenção

#### P2.1 — testes BPM

Resultado da suíte `tests/bpm`:

- 95 arquivos;
- 688 testes;
- 666 aprovados;
- 22 falhos em 8 arquivos.

Distribuição das falhas:

| Arquivo | Falhas | Leitura |
|---|---:|---|
| `card-modal-integration.test.ts` | 11 | Asserções estáticas não acompanharam a refatoração; também revelam wiring incompleto do follow-up. |
| `criar-card-nova-empresa.test.ts` | 3 | Mocks/IDs não acompanham publicação de eventos e novas dependências. |
| `fechado-ui.test.ts` | 1 | Expectativa de ordem/estrutura do componente divergente. |
| `lost-actions.test.ts` | 1 | Mock da leitura transacional não acompanha as leituras adicionais; o código ainda contém comparação CAS. |
| `lost-ui.test.ts` | 2 | Teste procura `PainelRequisitosAvanco.tsx`, que não existe mais. |
| `membros-card-ui.test.ts` | 2 | Teste ainda espera composição no arquivo anterior à extração de layout. |
| `sem-viabilidade-actions.test.ts` | 1 | Diferença `undefined` versus `null` no serviço. |
| `standby-follow-up.test.ts` | 1 | Teste procura o painel diretamente em `PainelRegistrar`, mas ele foi movido ao slot. |

Boa parte é dívida de teste após refatoração, mas o gate continua vermelho e não deve ser ignorado. O bug de propagação do follow-up é uma consequência funcional real dessa mesma refatoração.

#### P2.2 — TypeScript e lint

`npm run typecheck` retorna 34 erros globais. Cinco estão diretamente no CRM/BPM, todos em `src/lib/bpm/pendencias/motor.ts`:

- status `EM_ANDAMENTO` incompatível com `BpmSlaStatus`;
- `cardId` potencialmente nulo em dois pontos;
- relação `slaConfig` não reconhecida em dois pontos.

O lint direcionado a 182 arquivos do CRM/BPM encontrou:

- 1 erro em `CRMBackground.tsx`, por `setState` síncrono dentro de effect;
- 16 avisos em `CardAbertoLayout.tsx`, `CardFullViewModal.tsx` e executor de cadências, principalmente props/variáveis não usadas.

O `next build` está configurado para pular validação de tipos. Por isso o deploy pode ficar verde com o typecheck vermelho.

## 3. Inventário funcional

| Área | Implementação encontrada | Estado real do banco/entrega |
|---|---|---|
| Dashboard | Métricas e abertura de cards | Funciona sobre apenas 2 cards atuais. |
| Lista de pipelines | Filtro por permissão e setor | 3 ativos, 1 inativo. Acesso das equipes está mal configurado. |
| Kanban | Colunas, filtros, drag-and-drop, rollback, realtime e abertura do card | Implementado; transições estão excessivamente abertas. |
| Criação de card | Empresa existente/nova, CNPJ, responsável, transação e histórico | Entrada permitida somente na etapa canônica Novos leads. |
| Card aberto | Perfil da empresa, serviço, membros, telefones, histórico, campos, tarefas e próxima etapa | Implementado; wiring do follow-up está regressado. |
| Campos dinâmicos | 18 tipos, validação server-side, grupos, escopo global, fontes e opções | 111 ativos; 10 seleções inutilizáveis e 18 campos sem chave. |
| Campos por etapa | visibilidade, edição, leitura, obrigatoriedade, grupo, padrão e condições | 167 configurações; condições e obrigatoriedade de entrada não são usadas. |
| Perfil de campo | ADMIN, RESPONSAVEL e MEMBRO | Tabela vazia; prevalece o fallback padrão do campo/etapa. |
| Mapeamento de campos | copiar, sincronizar e referenciar | Implementado, sem nenhum mapeamento cadastrado. |
| Tarefas | CRUD, tipo, prioridade, prazo, alerta, presets e central global | 2 pendentes; 1 vencida e com alerta não disparado. |
| Reuniões | Google Calendar/Meet, reagendamento e transcrição | 1 card com reunião/evento/link; zero transcrições. |
| Interações | anotação, ligação e histórico | Implementado, zero registros atuais. |
| Anexos | upload, download protegido, vínculo a campo/card | Implementado, zero registros atuais. |
| Membros | responsável, administrador e participante | 1 vínculo atual; os dois responsáveis são TI. |
| Vínculos entre pipelines | criação e histórico cruzado | Implementado, zero vínculos atuais. |
| Follow-up | próximo contato, checklist de follow-up, Standby e interrupção | Código presente; scheduler e wiring do modal precisam correção. |
| Checklists configuráveis | templates, itens, materialização e bloqueio de avanço | Código/tabelas presentes, zero templates e zero instâncias. |
| Cadências | CRUD, passos, vínculo, pausa/cancelamento e executor | Código/tabelas presentes, zero cadências. |
| SLA | configurações, limites, instâncias, eventos e alertas | Código/tabelas presentes, zero configuração e zero instâncias. |
| Regras gerais | SE/ENTÃO, versões, bloqueios, mensagens, fórmulas e tabela de decisão | Código/tabelas presentes, zero regras; página não publicada. |
| Regras financeiras | retenções, cálculo e comissões | Interface publicada, zero regras; cálculos configurados retornam nulo. |
| Automações | editor amigável, motor central versionado, fila, agenda, eventos e monitor | Código presente, zero definições/execuções/agendas/eventos. |
| Webhooks | endpoint autenticado, idempotência e entrada para o motor | 1 endpoint ativo, zero entradas. |
| Base de conhecimento | links por pipeline | Código presente e zero links; página não publicada. |
| Central de pendências | tarefas, checklists e SLA | Código local com 5 erros de tipo; página não publicada. |
| Auditoria | histórico de card e auditoria de configuração | 17 eventos de card e 50 alterações de configuração. |

## 4. Pipelines e etapas

### Financeiro

- Pipeline ativo, ordem 0, setor `FINANCEIRO`.
- 6 etapas ativas e 1 duplicata inativa de `Elaboração do Contrato`.
- Fluxo legado principal: Solicitação → Elaboração → Formalização → Pagamento → Nota Fiscal → Concluídos.

### Operacional

- Pipeline ativo, ordem 1, setor `OPERACIONAL`.
- 13 etapas ativas.
- Nenhuma transição legada configurada; o fallback atual deixa qualquer movimento interno aberto.

### Radar

- Pipeline inativo, ordem 2, setor `OPERACIONAL`.
- Suas três etapas continuam ativas: `Em Monitoramento`, `Pendência` e `Concluído`.
- Não possui campos ativos próprios.

### Revisão de Radar

- Pipeline ativo, ordem 3, setor `COMERCIAL`.
- 9 etapas ativas.
- É o único pipeline com cards vivos no momento.

## 5. Campos efetivos por etapa

Legenda:

- `*` — obrigatório na etapa pelo resolvedor atual;
- `[saída]` — exigido para sair da etapa;
- `[RO]` — somente leitura/automático;
- campos de reunião, próximo contato, follow-up, checklists e SLA podem aparecer em painéis próprios e não entram na contagem de campos dinâmicos abaixo.

### Financeiro — 75 ocorrências efetivas

#### Solicitação de Contrato — 21 campos

Obrigatórios na etapa: 2. Obrigatórios para saída: 15. Somente leitura: 6.

`CNPJ [saída, RO]`; `Serviço contratado [saída]`; `Razão Social [saída, RO]`; `Valor acordado no contrato [saída]`; `Forma de pagamento [saída]`; `Rua [saída]`; `Condição negociada`; `Número [saída]`; `Complemento`; `Vendedor responsável [saída]`; `Bairro [saída]`; `Canal de origem [saída]`; `CEP [saída]`; `Parceiro responsável`; `Município [saída, RO]`; `Estado [saída, RO]`; `E-mail [saída, RO]`; `Regime tributário [saída, RO]`; `Regime tributário do cliente *`; `Contato/Nome do responsável *`; `Observações comerciais`.

#### Elaboração do Contrato — 5 campos

`Contrato elaborado`; `Data de elaboração`; `Contrato enviado para assinatura`; `Data do envio`; `Link/arquivo do contrato`.

#### Formalização — 23 campos

Obrigatórios na etapa: 2.

`Status da assinatura`; `Valor acordado no contrato`; `IRRF aplicável`; `Status do contrato`; `Data da assinatura`; `Valor do IRRF`; `Contrato assinado/anexo`; `CSRF aplicável`; `Valor do CSRF`; `Valor líquido a pagar`; `Forma de pagamento`; `Vencimento`; `Link/dados para pagamento`; `Status financeiro`; `Status do contrato/assinatura *`; `Regime tributário do prestador *`; `Alíquota IRRF`; `Valor IRRF`; `Alíquota CSRF`; `Valor CSRF`; `Total de retenções`; `Valor líquido para pagamento`; `Memória de cálculo`.

#### Pagamento — 8 campos

`Pagamento confirmado`; `Data do pagamento`; `Valor esperado`; `Valor recebido`; `Forma de pagamento`; `Comprovante`; `Pagamento no êxito`; `Comprovante de pagamento`.

#### Nota Fiscal — 5 campos

`NF emitida`; `Número da NF`; `Data de emissão`; `Valor da NF`; `Arquivo/link da NF`.

#### Concluídos — 13 campos

Somente leitura: 4.

`CNPJ [RO]`; `Razão Social [RO]`; `Contato responsável/representante [RO]`; `E-mail [RO]`; `Serviço contratado`; `Contrato assinado/anexo`; `Valor acordado no contrato`; `Forma de pagamento`; `Pagamento confirmado`; `NF emitida`; `Vendedor responsável`; `Parceiro responsável`; `Canal de origem`.

### Operacional — 76 ocorrências efetivas

#### Boas-vindas — 22 campos

Somente leitura: 5. A etapa possui ainda uma regra especial de acesso reservada à Diretoria.

`Embasamento do processo`; `Radar pretendido`; `Radar atual`; `Mês para protocolar`; `Regime tributário [RO]`; `Data de abertura da empresa`; `Situação do capital social`; `Faturamento dos últimos 5 anos`; `Status da sede`; `Armazenamento`; `Faturas sob titularidade da empresa`; `Produtos comercializados`; `Atuação da empresa`; `Tributos pagos no último semestre`; `Fonte`; `Estado [RO]`; `Vendedor responsável`; `Contato responsável/representante [RO]`; `CNPJ [RO]`; `Razão Social [RO]`; `Responsável pelo processo`; `CPF do responsável pelo processo`.

#### Alinhamento Estratégico agendado — 3 campos

`Responsável pelo processo`; `CPF do responsável *`; `Resumo da reunião [saída]`.

#### Envio do checklist — 0 campos

Não há campo dinâmico configurado. O painel de checklists também não materializa nada enquanto não houver templates.

#### Em análise — 18 campos

Somente leitura: 3.

`Embasamento do processo`; `Radar pretendido`; `Radar atual`; `Mês para protocolar`; `Regime tributário [RO]`; `Data de abertura da empresa`; `Situação do capital social`; `Faturamento dos últimos 5 anos`; `Status da sede`; `Armazenamento`; `Faturas sob titularidade da empresa`; `Produtos comercializados`; `Atuação da empresa`; `Tributos pagos no último semestre`; `Fonte`; `Estado [RO]`; `Vendedor responsável`; `Contato responsável/representante [RO]`.

#### Revisão — 2 campos

`Resultado da revisão`; `Responsável pela revisão`.

#### Protocolo — 3 campos

`Resultado da revisão`; `Data do protocolo`; `Certificado digital utilizado`.

#### Revisão do protocolo — 4 campos

`Data do protocolo`; `Número do protocolo`; `Informações de conferência`; `Documentos/códigos utilizados`.

#### Aguardando Despacho — 5 campos

`CNPJ [RO]`; `Data do protocolo`; `Número do protocolo`; `Prazo de análise/devolutiva do fiscal`; `Andamento/status atual`.

#### Petição — 3 campos

`Petição/anexo [saída]`; `Data relacionada à petição`; `Prazo`.

#### Exigência Fiscal — 5 campos

`Prazo do fiscal`; `Data da exigência`; `Motivo do indeferimento/exigência`; `Classificação do motivo`; `Descrição`.

#### Resposta ao Fiscal — 5 campos

`Data da resposta`; `Solução adotada`; `Descrição da solução`; `Petição/anexo [saída]`; `Prazo`.

#### Deferido — 6 campos

`Data do deferimento`; `Tentativa do deferimento`; `Solução adotada`; `Validação da solução adotada`; `Duração do processo`; `Oportunidades de novos serviços`.

#### Indeferido — 0 campos

Não há campo dinâmico configurado para registrar o encerramento do indeferimento.

### Revisão de Radar — 66 ocorrências efetivas

Cinco campos gerais são reaproveitados em quase todas as etapas: `Faturamento nos últimos 5 anos`, `Exportador`, `Nível de complexidade para a revisão`, `Histórico de tentativas anteriores de revisão` e `Motivo de Lost - Outro`. O último aparece fora de Lost porque está configurado como campo geral; somente dentro de Lost a UI aplica a regra condicional “mostrar se motivo = Outro”.

#### Novos leads — 4 campos

`Nome do responsável *`; `CNPJ * [RO]`; `Radar pretendido *`; `Qualificação`.

#### Agendar reunião — 5 campos

`Faturamento nos últimos 5 anos`; `Exportador`; `Nível de complexidade para a revisão`; `Histórico de tentativas anteriores de revisão`; `Motivo de Lost - Outro`.

O agendamento de data/hora fica em painel próprio e não aparece nesta contagem.

#### Reunião Agendada — 22 campos

Obrigatórios na etapa: 5. Somente leitura: 3.

`Embasamento do processo`; `Radar pretendido *`; `Radar atual`; `Mês para protocolar *`; `Regime tributário [RO]`; `Data de abertura da empresa`; `Situação do capital social`; `Faturamento nos últimos 5 anos *`; `Status da sede`; `Armazenamento *`; `Faturas sob titularidade da empresa *`; `Produtos comercializados`; `Atuação da empresa`; `Exportador`; `Tributos pagos no último semestre`; `Fonte`; `Nível de complexidade para a revisão`; `Estado [RO]`; `Histórico de tentativas anteriores de revisão`; `Vendedor responsável`; `Contato responsável/representante [RO]`; `Motivo de Lost - Outro`.

#### Em tratativa — 7 campos

`Faturamento nos últimos 5 anos`; `Valor acordado no contrato *`; `Forma de pagamento *`; `Exportador`; `Nível de complexidade para a revisão`; `Histórico de tentativas anteriores de revisão`; `Motivo de Lost - Outro`.

#### Fechado — 7 campos

`Valor acordado no contrato *`; `Forma de pagamento *`; `Faturamento nos últimos 5 anos`; `Exportador`; `Nível de complexidade para a revisão`; `Histórico de tentativas anteriores de revisão`; `Motivo de Lost - Outro`.

O status pós-fechamento aparece em painel próprio.

#### Lost — 6 campos

`Motivo de Lost * [saída]`; `Faturamento nos últimos 5 anos`; `Exportador`; `Nível de complexidade para a revisão`; `Histórico de tentativas anteriores de revisão`; `Motivo de Lost - Outro`.

#### Sem viabilidade — 5 campos

`Faturamento nos últimos 5 anos`; `Exportador`; `Nível de complexidade para a revisão`; `Histórico de tentativas anteriores de revisão`; `Motivo de Lost - Outro`.

#### Standby - Follow Up — 5 campos

`Faturamento nos últimos 5 anos`; `Exportador`; `Nível de complexidade para a revisão`; `Histórico de tentativas anteriores de revisão`; `Motivo de Lost - Outro`.

O controle de Standby aparece em painel próprio.

#### Monitoramento — 5 campos

`Faturamento nos últimos 5 anos`; `Exportador`; `Nível de complexidade para a revisão`; `Histórico de tentativas anteriores de revisão`; `Motivo de Lost - Outro`.

## 6. Catálogo de campos

### Tipos ativos usados

| Tipo | Quantidade |
|---|---:|
| Seleção | 28 |
| Texto | 27 |
| Data | 16 |
| Texto longo | 12 |
| Número | 11 |
| Booleano | 9 |
| Moeda | 3 |
| CPF | 2 |
| Arquivo | 2 |
| Usuário | 1 |
| **Total** | **111** |

O admin suporta 18 tipos: texto, texto longo, número, moeda, percentual, data, data/hora, seleção, multiseleção, booleano, usuário, CPF, CNPJ, e-mail, telefone, URL, arquivo e relacionamento.

Tipos suportados mas ainda não usados como tipo explícito: percentual, data/hora, multiseleção, CNPJ, e-mail, telefone, URL e relacionamento. Alguns CNPJs/e-mails legados continuam como texto, com tratamento adicional pelo nome do campo.

### Campos inativos preservados

Há seis campos inativos, mantidos para preservar histórico:

- Financeiro: `CNPJ`, `Valor bruto do contrato`, `Forma de pagamento`, `Origem do cliente`, `Forma de pagamento utilizada`.
- Revisão de Radar: `Faturamento dos últimos 5 anos`.

Essa desativação eliminou duplicidades visuais recentes, sem apagar linhas antigas.

### Opções

Dos 28 campos de seleção ativos:

- 2 usam opções estruturadas;
- 16 usam apenas JSON legado;
- 10 não têm opções.

Há 14 registros em `BpmCampoOpcao`, concentrados em poucos campos. A migração para opções estruturadas está apenas começando.

## 7. Dados e uso atual

| Entidade | Quantidade |
|---|---:|
| Pipelines | 4 |
| Etapas | 32 |
| Campos | 117 |
| Campos ativos | 111 |
| Associações campo/pipeline | 123 |
| Configurações campo/etapa | 167 |
| Opções estruturadas | 14 |
| Valores globais personalizados | 5 |
| Cards vivos | 2 |
| Valores de campo em cards | 22 |
| Eventos de histórico | 17 |
| Membros de card | 1 |
| Tarefas | 2 |
| Auditorias de configuração | 50 |
| Webhook endpoints | 1 |
| Webhook entradas | 0 |
| Cards na tabela legada `old_fixfk` | 4 |

Distribuição dos cards vivos:

- 1 em Revisão de Radar → Novos leads;
- 1 em Revisão de Radar → Agendar reunião;
- zero cards em Financeiro;
- zero cards em Operacional;
- zero cards no Radar inativo.

Recursos usados nos dois cards:

- ambos têm próximo contato futuro;
- um tem reunião, Google Event e Meet link;
- nenhum tem transcrição;
- nenhum tem status pós-fechamento;
- nenhum está com follow-up de Standby interrompido.

Histórico atual:

- 12 atualizações de card;
- 2 tarefas criadas;
- 1 reunião agendada;
- 1 movimento;
- 1 criação de card.

O volume real ainda é pequeno demais para considerar Financeiro e Operacional validados por uso de produção.

## 8. Segurança e autorização

### Controles corretos encontrados

- layout exige sessão;
- Server Actions relevantes revalidam sessão no servidor;
- acesso ao módulo usa usuário ativo, permissões de setor, permissões legadas e overrides;
- Admin, CEO e TI possuem bypass global explícito;
- não administradores precisam ser membros do card para visualizar ou agir;
- responsável/administrador do card gerencia membros e exclusão; participante trabalha no card sem gerenciar composição;
- upload e download de anexos validam sessão e ownership;
- crons exigem `CRON_SECRET`;
- ingestão NoLoss exige segredo próprio;
- webhooks usam segredo por endpoint e chave de idempotência;
- ações críticas de movimento e edição repetem verificações dentro da transação;
- `Boas-vindas` possui restrição especial para Diretoria.

### Lacunas de configuração

- `BpmCampoAcesso` está vazio: não existe diferenciação real entre ADMIN, RESPONSAVEL e MEMBRO no nível de campo;
- `BpmEtapaVisibilidade` está vazio: o fallback permite ver/agir para os perfis que já chegaram ao card;
- a configuração de permissão `crm` não contempla as equipes que deveriam operar Comercial e Operacional;
- não foi feito teste de invasão, pentest ou tentativa de exploração; este diagnóstico validou controles estáticos e dados de autorização, não segurança ofensiva.

## 9. Banco, migrations e integridade

Validações executadas no banco ativo:

- `PRAGMA integrity_check`: `ok`;
- `PRAGMA foreign_key_check`: zero linhas;
- zero cards órfãos de etapa;
- zero valores órfãos de card/campo;
- zero configurações campo/etapa órfãs.

Não existe tabela `_prisma_migrations` no banco. O projeto utiliza aplicação de SQL fora do mecanismo padrão de rastreamento do Prisma, o que aumenta a importância de manter todos os arquivos de migration versionados.

Risco atual: as tabelas de Regras e SLA existem no banco, porém três migrations correspondentes ainda não pertencem ao commit. O banco ativo e a história versionada do repositório não são reproduzíveis entre si.

## 10. Deploy e qualidade de release

### Situação confirmada

- `origin/main` e `HEAD` estavam em `bd140137` no corte;
- Vercel: `success`, concluído às 21:29:04 UTC;
- o build completo do workspace local também compilou, mas incluiu arquivos ainda não publicados;
- uma tentativa de build isolado com `node_modules` por symlink foi rejeitada pelo Turbopack por isolamento de filesystem e não foi considerada falha do produto;
- o deploy do Vercel é a evidência válida do commit publicado.

### Ressalvas

- o build Next ignora validação de tipos;
- três rotas visíveis/planejadas não estão no commit;
- migrations de regras/SLA não estão no commit;
- existem 33 entradas locais modificadas/não rastreadas;
- não foi executado smoke autenticado em navegador contra produção;
- não foram disparados cron, webhook, Google APIs, NoLoss ou automações reais durante o diagnóstico.

## 11. Plano recomendado de correção

Nenhuma ação abaixo foi executada neste diagnóstico.

### Fase 0 — congelar e reconciliar a entrega

1. Pausar alterações paralelas no CRM por uma janela curta.
2. Separar alterações BPM das alterações de outros módulos.
3. Versionar páginas, componentes e migrations necessários.
4. Confirmar que nenhum arquivo obrigatório permanece untracked.
5. Fazer build a partir de clone/worktree limpo e comparar rotas com o menu.

### Fase 1 — restaurar operação básica

1. Conceder acesso efetivo `crm` a Comercial e Operacional conforme a política desejada.
2. Validar acesso com usuários reais de cada perfil, sem usar bypass Admin/CEO/TI.
3. Cadastrar opções para as 10 seleções vazias.
4. Corrigir a propagação de `onEstadoFollowUpChange` no modal.
5. Publicar/agendar os jobs de novos leads e alertas, ou concluir a migração equivalente para o motor central.
6. Processar e confirmar a tarefa vencida/alerta pendente de maneira auditável.

### Fase 2 — fechar o desenho dos pipelines

1. Definir etapa inicial e final de cada pipeline.
2. Configurar cores, scripts e SLA onde fizer sentido.
3. Escolher uma única fonte de verdade para transições.
4. Remover fallback aberto onde o processo precisa ser determinístico.
5. Cadastrar saídas explícitas para Operacional, Monitoramento, Standby, Sem viabilidade, Lost e etapas finais.
6. Remover a relação residual com a etapa inativa duplicada.
7. Definir campos para Envio do checklist e Indeferido, ou documentar formalmente que são etapas sem formulário.

### Fase 3 — ativar capacidades avançadas

1. Criar templates de checklist e validar materialização/bloqueio.
2. Criar regras gerais e financeiras com versões publicadas.
3. Cadastrar SLA e testar instâncias, pausa, retomada, alerta e vencimento.
4. Criar cadências e validar seu executor.
5. Migrar comportamentos hardcoded para automações centrais com equivalência comprovada.
6. Cadastrar links de conhecimento por pipeline.
7. Configurar visibilidade de etapa e acesso por perfil de campo.
8. Cadastrar mapeamentos entre campos quando houver cópia/sincronização real.

### Fase 4 — saneamento e aceite

1. Atribuir chave estável aos 18 campos ativos restantes.
2. Migrar opções JSON legadas para `BpmCampoOpcao` sem perder valores existentes.
3. Revisar os cinco campos gerais repetidos em todas as etapas da Revisão de Radar.
4. Decidir o destino dos quatro cards em `BpmCard_old_fixfk` após backup e validação de negócio.
5. Zerar os 5 erros TypeScript do CRM e o erro de lint.
6. Atualizar os testes pós-refatoração e manter a suíte BPM 100% verde.
7. Executar UAT por perfil e por etapa em Comercial, Operacional e Financeiro.

## 12. Critérios objetivos para considerar o CRM “em teste”

- [ ] Comercial e Operacional acessam seus pipelines com contas não administrativas.
- [ ] As 10 seleções têm opções e salvam valores válidos.
- [ ] Todas as rotas do menu existem no commit publicado.
- [ ] Todas as migrations aplicadas no banco estão versionadas.
- [ ] O modal em Em tratativa abre e fecha após o estado real do follow-up.
- [ ] Jobs de novos leads e alertas têm scheduler confirmado e observável.
- [ ] A tarefa/alerta vencido atual foi processado ou justificado.
- [ ] Transições permitidas correspondem ao processo aprovado, sem fallback acidental.
- [ ] Etapas inicial/final estão configuradas.
- [ ] Checklists, SLA, regras, cadências e automações essenciais possuem ao menos uma configuração validada ou foram explicitamente retirados do escopo.
- [ ] `npm run typecheck` não apresenta erro do CRM/BPM.
- [ ] Lint direcionado não apresenta erro.
- [ ] Suíte BPM: 688/688 ou nova contagem equivalente, sem falhas.
- [ ] Build limpo do mesmo commit publicado passa.
- [ ] Smoke autenticado por perfil e pipeline passa.

## 13. Fontes examinadas

- `AGENTS.md`, constituição e regras locais do projeto;
- `prisma/schema.prisma` e migrations;
- `src/actions/bpm/**`;
- `src/lib/bpm/**`;
- `src/components/bpm/**`;
- `src/app/PainelAlpha/AlphaCRM/**`;
- `src/app/api/bpm/**`;
- `vercel.json` e scripts BPM;
- suíte `tests/bpm/**`;
- banco Turso ativo, exclusivamente com `SELECT` e `PRAGMA`;
- Git local, `origin/main` e status de deploy do Vercel.

## 14. Limitações

Este relatório é um diagnóstico técnico e de configuração no corte indicado. Ele não substitui:

- validação de regras de negócio com os responsáveis de Comercial, Operacional e Financeiro;
- teste funcional autenticado em navegador;
- execução real de Google Calendar/Meet, NoLoss, webhook e cron;
- teste de carga, concorrência multi-instância ou segurança ofensiva;
- conferência humana dos quatro registros na tabela legada.

O diagnóstico não alterou código nem banco. A única alteração produzida foi este arquivo Markdown solicitado.
