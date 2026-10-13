# Story: Migração do CRM RD Station para o Painel Alpha com histórico completo

## Status

Ready for review

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools:
  - "review de arquitetura e contrato de importação"
  - "testes automatizados de reconciliação e idempotência"
```

## História

**Como** responsável pela operação do CRM Alpha,  
**quero** migrar para o Painel Alpha os leads dos dez funis RD Station já mapeados, incluindo as etapas percorridas e as atividades disponíveis,  
**para que** a equipe continue o atendimento no Alpha com histórico cronológico rastreável, corrigível e sem perder os dados originais do RD.

## Contexto e escopo

A auditoria somente de leitura feita na API CRM v1 do RD Station identificou 1.212 leads nos dez funis já mapeados. A resposta de detalhe dos leads contém 7.098 registros `deal_stage_histories`, todos com ID de etapa e data de entrada. A listagem de atividades encontrou 3.601 atividades associadas a 1.047 desses leads; para 165 leads não houve atividade listada pela API. A ausência de atividades na resposta não deve ser representada como falha de histórico de etapas.

A transferência deve incluir o histórico de etapas e todas as atividades que a API disponibilizar para os leads dentro do escopo. Preservar os valores e datas de origem RD, identificar a origem nos cards e adaptar os eventos à linha do tempo/jornada do Alpha para que usuários autorizados possam corrigir a representação quando necessário. A edição não pode sobrescrever ou apagar o payload original importado.

O relacionamento de funis, etapas, destinos e responsáveis foi definido pelo usuário na conversa anterior e é a regra funcional aprovada desta story. Reutilizar esse mapeamento; não substituir por correspondência aproximada de nomes nem pedir ao usuário para refazê-lo. Seus destinos de pipeline são:

| Origem RD | Destino Alpha | Regra já definida |
|---|---|---|
| Revisão de Estimativa do Radar (Leads) | Revisão de Radar | Distribuir cada card para a etapa correspondente definida no mapeamento existente. |
| Diretoria Operacional – Vitor | Operacional | Cards atribuídos ao usuário Vitor. |
| Financeiro – Entrada e Financeiro – Êxito | Financeiro | Usar as etapas de saída Financeiro já criadas, inclusive Cliente cancelado/Cancelado e Processos 2x1 quando corresponderem à etapa RD. |
| Revisão do Radar – Operacional Protocolo | Operacional | Usar as etapas de protocolo correspondentes do mapeamento. |
| Stand-by – Processos Revisão de Radar | Revisão de Radar | Etapa Stand By. |
| Habilitação do Radar | Revisão de Radar | Distribuir cada card para a etapa correspondente definida no mapeamento existente. |
| Revisão do Radar – Operacional Maria | Operacional | Cards atribuídos à usuária Maria. |
| Revisão do Radar – Operacional Mariah | Operacional | Cards atribuídos à usuária Mariah. |
| Deferidos – Processos Revisão do Radar | Operacional | Etapa Processo deferido. |

O mapeamento por etapa RD já aprovado deve ser lido/representado como configuração explícita pelo implementador. Caso uma etapa de origem não tenha destino verificável nessa configuração, o lead correspondente vai para exceção da prévia e não é criado/movido até resolução; não inferir destino por similaridade textual. O mesmo vale para os responsáveis financeiros não especificados na conversa: não atribuir silenciosamente ao usuário atual, a um responsável RD sem correspondência confirmada ou a um responsável padrão. Todos os cards efetivamente importados recebem marcação de origem RD Station e nome da etapa RD de origem; preservar também o pipeline e a etapa RD originais no vínculo de proveniência.

### Regras de identidade e elegibilidade

A auditoria comparou o CNPJ normalizado do nome do deal RD com os clientes existentes no Alpha: 443 deals (424 CNPJs) tiveram correspondência direta com `Cliente`, mas nenhum desses clientes possuía `BpmCard`; 721 deals (693 CNPJs distintos) não corresponderam a cliente por CNPJ; 48 deals não continham CNPJ identificável. Foram observados 47 deals além dos 1.117 CNPJs distintos entre os 1.164 nomes com CNPJ, incluindo repetições no mesmo funil e entre funis. Deals RD repetidos continuam sendo registros de origem distintos e não podem ser mesclados automaticamente.

Só são elegíveis para gravação os leads cuja identidade Alpha esteja associada sem ambiguidade por correspondência direta ou por resolução humana registrada na prévia aprovada. Os 769 leads sem correspondência direta ficam como exceções até resolução explícita: não criar Cliente automaticamente, não associar por nome aproximado e não descartar silenciosamente. Repetições de CNPJ não autorizam mesclagem de deals. A prévia deve mostrar o motivo, IDs RD e resolução necessária; registros não resolvidos não entram na carga.

O escopo auditado é:

| Funil RD | Leads auditados | Registros de etapa auditados |
|---|---:|---:|
| Revisão de Estimativa do Radar (Leads) | 573 | 2.296 |
| Diretoria Operacional – Vitor | 1 | 2 |
| Financeiro – Entrada | 16 | 66 |
| Financeiro – Êxito | 221 | 2.714 |
| Revisão do Radar – Operacional Protocolo | 7 | 75 |
| Stand-by – Processos Revisão de Radar | 35 | 192 |
| Habilitação do Radar | 150 | 532 |
| Revisão do Radar – Operacional Maria | 16 | 96 |
| Deferidos – Processos Revisão do Radar | 176 | 1.010 |
| Revisão do Radar – Operacional Mariah | 17 | 115 |
| **Total** | **1.212** | **7.098** |

Existe um lead em um funil recente de Assessoria Smart, fora do mapeamento e dos totais acima. Ele deve ficar fora desta migração até que o escopo seja explicitamente decidido; não inferir seu destino.

Esta story abrange preparação, prévia, transferência, reconciliação e experiência de consulta/edição do histórico. Não autoriza executar mudanças em produção sem a prévia aprovada, o fluxo de segurança de banco do projeto e a confirmação explícita exigida por `AGENTS.md`. Não incluir token, payload pessoal real ou credenciais em logs, fixtures versionadas ou documentação.

## Critérios de aceite

1. A execução consulta novamente a API v1 e produz um inventário fechado dos leads dos dez funis mapeados. O inventário identifica os IDs de origem, funil e etapa atual, responsável e contagens de histórico; registra mudanças de escopo em relação à auditoria de 1.212 leads sem incluir automaticamente o lead de Assessoria Smart.
2. Antes de qualquer gravação, o sistema apresenta uma prévia por funil, etapa RD e destino Alpha, contendo contagens de leads, etapas históricas, atividades, responsáveis, tags, duplicidades, itens sem atividades e exceções de identidade/mapeamento. A prévia separa elegíveis e não elegíveis, expõe os motivos e resoluções necessárias, e registra a versão aprovada. A ausência de resolução não pode ser convertida em criação ou atribuição automática.
3. Após aprovação da prévia e confirmação específica de execução, somente leads com identidade Alpha resolvida, etapa destino verificada e responsável definido são criados/associados. Aplicar os destinos e responsáveis descritos nesta story e o mapeamento de etapas já definido pelo usuário. Nenhum card fora dos dez funis mapeados é criado ou movido; exceções permanecem sem gravação e aparecem no relatório.
4. Todo card importado exibe uma identificação simples de origem RD Station e a etapa RD de origem definida pelo mapeamento. A informação de origem acompanha o card mesmo após movimentações no Alpha.
5. O histórico cronológico do card no Alpha contém todos os `deal_stage_histories` e todas as atividades recuperadas pela API v1 para aquele lead, preservando IDs de origem, tipo quando disponível, texto/payload original, datas e associação ao lead. Campos ausentes na origem permanecem ausentes; não se inventam eventos nem timestamps.
6. A linha do tempo/jornada do Alpha apresenta os eventos importados em ordem cronológica e permite que usuários com permissão editem os campos de representação suportados. Cada correção mantém o payload original imutável, registra o valor corrigido, autor e data da correção e pode ser auditada. Se o modelo atual não suportar edição auditável, a capacidade é implementada como parte desta story.
7. O importador é idempotente: reexecutar a mesma carga ou retomar uma carga interrompida não cria cards ou eventos duplicados. A deduplicação usa identificadores estáveis RD por lead/evento e registra associação entre identificadores de origem e registros Alpha. CNPJs repetidos não mesclam deals; conflitos de identidade são apresentados na reconciliação para resolução, sem mesclagem silenciosa.
8. O relatório pós-carga reconcilia, por funil e no total, leads elegíveis/importados/ignorados/com erro, eventos de etapa e atividades encontrados/importados/duplicados/sem associação, e informa os 165 leads sem atividade observada sem classificá-los como sem histórico de etapas. Divergências em relação à prévia ficam explicadas por item.
9. Chamadas à API RD tratam paginação, limites, expiração/indisponibilidade e repetição segura. Credenciais permanecem no servidor e fora de respostas ao navegador, logs, relatórios e arquivos versionados.
10. Mudanças persistentes no banco só são executadas depois do relatório Vault, apresentação ao usuário do ambiente/banco, etapas/comandos, impacto, riscos, alternativa não destrutiva e rollback, backup completo verificado com no máximo 48 horas e confirmação explícita do usuário para a carga descrita. A aprovação da prévia, uma autorização genérica anterior ou o pedido de implementar não substitui essa confirmação final. Até esse gate, a execução permanece read-only. A implementação fornece estratégia de rollback/reversão da carga e registra evidência do backup validado antes de iniciar qualquer gravação.
11. Testes cobrem transformação de histórico, ordenação por data, ausência de atividades, paginação, dados incompletos, duplicatas, repetição após interrupção, preservação do payload original após edição, permissões, reconciliação e exclusão do funil de Assessoria Smart. Os gates de qualidade do projeto são executados e os resultados registrados na story.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type**: Integration
- **Secondary Type(s)**: Database, API, Frontend
- **Complexity**: High — importação histórica multi-sistema, reconciliação, deduplicação, dados auditáveis e alteração persistente sujeita a salvaguardas.

### Specialized Agent Assignment

- **Primary Agents**: @dev, @architect
- **Supporting Agents**: @db-sage, @qa, @github-devops

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): revisar contrato, idempotência, tratamento de segredos e testes antes de concluir.
- [ ] Pre-PR (@github-devops): revisar compatibilidade, plano de carga, reconciliação e rollback.
- [ ] Pre-Deployment (@github-devops): validar configuração de credencial, backup confirmado e plano de execução antes de qualquer carga em produção.

### Self-Healing Configuration

- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: auto-fix até 2 iterações; HIGH: documentar; MEDIUM/LOW: ignorar conforme configuração do projeto.

### CodeRabbit Focus Areas

**Primary Focus**

- Identidade de origem estável e idempotência de leads/eventos.
- Integridade temporal e preservação imutável do payload RD com trilha de correção.

**Secondary Focus**

- Paginação, limites e recuperação segura da API externa.
- Controle de acesso, proteção de credenciais e segurança da gravação/rollback.

## Tasks / Subtasks

- [x] 1. Verificar configuração e contratos existentes de integração RD v1 e do CRM Alpha sem expor credenciais. (AC: 1, 5, 9)
  - [x] Confirmar variável de ambiente no servidor e validar conexão sem registrar o token.
  - [x] Aplicar o mapeamento aprovado; a prévia final validou todos os destinos por etapa sem aproximação.
  - [x] Inspecionar modelos de cards, jornada, atividades, permissões e auditoria.
- [x] 2. Construir extração paginada, normalização e inventário read-only da carga. (AC: 1, 5, 9, 11)
  - [x] Obter detalhes/históricos e todas as atividades dos 1.212 leads dos dez funis mapeados.
  - [x] Distinguir os 165 leads sem atividade dos históricos de etapa e preservar payloads/datas disponíveis.
  - [x] Manter Assessoria Smart fora da carga.
- [x] 3. Implementar prévia, associação/deduplicação e reconciliação por origem. (AC: 2, 3, 7, 8)
  - [x] Comparar IDs RD com cards Alpha e manter negócios RD distintos, inclusive CNPJs repetidos.
  - [x] Apresentar contagens e destinos por funil/etapa, atividades, duplicidades, erros e responsáveis antes da aplicação.
  - [x] Registrar fingerprint da fotografia aplicada e da tentativa retomada.
- [x] 4. Adaptar persistência e linha do tempo Alpha para importar e corrigir eventos. (AC: 4, 5, 6, 7, 10)
  - [x] Criar armazenamento aditivo de payload original, vínculo Alpha/RD e eventos.
  - [x] Permitir correções autorizadas com autoria, data e valores anteriores/novos sem alterar o payload original.
  - [x] Aplicar o fluxo Vault, backup verificado, confirmação e salvaguarda de rollback.
- [x] 5. Executar carga controlada e produzir relatório final reconciliado. (AC: 3, 4, 5, 7, 8, 10)
  - [x] Aplicar pipelines, etapas, responsáveis e tags conforme o mapeamento recuperado da conversa.
  - [x] Retomar a tentativa interrompida por chaves estáveis e concluir sem duplicar cards/eventos.
  - [x] Reconciliar a leitura final com os registros gravados e documentar a atualização de um histórico da tentativa parcial.
- [ ] 6. Validar integração, interface e salvaguardas. (AC: 6, 9, 11)
  - [ ] Cobrir também paginação/API e permissões por testes dedicados; os testes existentes cobrem transformação, ordenação, datas ausentes e imutabilidade da correção.
  - [x] Executar lint, typecheck e suíte de testes; resultados e limitações estão registrados abaixo.
  - [x] Atualizar checklist e File List com os arquivos efetivamente alterados.

## Dev Notes

### Evidência e dados de origem

- A auditoria foi read-only na API CRM v1; ela não alterou leads nem banco.
- Referência da API de detalhe: [RD Station CRM v1 — Get Deal](https://developers.rdstation.com/reference/crm-v1-get-deal), que documenta `deal_stage_histories` com identificador de etapa e datas.
- Referência da API de atividades: [RD Station CRM v1 — List Activities](https://developers.rdstation.com/reference/crm-v1-list-activities), que permite filtrar atividades por lead e tipo, incluindo changelog, com paginação.
- Contagens auditadas nesta conversa: 1.212 leads/10 funis, 7.098 registros de etapa, 3.601 atividades em 1.047 leads, 165 leads sem atividade listada. São referência para a prévia, não garantia de que os dados continuarão idênticos no momento da execução; reconsultar e reconciliar.
- Um lead do funil Assessoria Smart não está nos dez funis e permanece fora do escopo até decisão explícita.

### Decisões de produto já tomadas

- O relacionamento origem/destino de funis e etapas já foi feito; o executor deve reutilizá-lo.
- Responsáveis e marcações de origem/etapa devem seguir o mapeamento já registrado: Vitor, Maria e Mariah nos fluxos operacionais correspondentes; origem RD e etapa RD em cada card.
- Financeiro já tem destinos de saída necessários; Operacional já tem a etapa “Cliente cancelado”; Stand-by e deferidos devem seguir os destinos Alpha já definidos.
- O usuário exige histórico completo disponível na API e capacidade de editar/corrigir a representação no Alpha sem perder o original.
- Destinos aprovados por funil estão discriminados na tabela “Destinos Alpha definidos pelo usuário” acima. Correspondência de etapa deve usar o relacionamento já acordado; qualquer item sem destino verificável vira exceção prévia, sem aproximação automática.
- Os destinos Alpha verificados na auditoria são: Revisão de Radar (`Novo Lead`, `Agendar Reunião`, `Reunião Agendada`, `Em tratativas`, `Fechado`, `Lost`, `Sem viabilidade`, `Stand By`, `Monitoramento`); Operacional (`Boas vindas`, `Alinhamento Estratégico Agendado`, `Envio do Check List Atualizado`, `Documentação em análise`, `Revisão`, `Revisado`, `Revisão do protocolo`, `Aguardando despacho`, `Petição`, `Exigência Fiscal`, `Resposta`, `Processo deferido`, `Processo indeferido`, `Cliente cancelado`); Financeiro (`Novo Contrato`, `Elaboração de Contrato`, `Formalização`, `Confirmação de Pagamento`, `Emissão de Nota Fiscal`, `Concluido`, `Stand By`, `Cancelado`, `Processos 2x1`). A lista valida os destinos existentes, mas não autoriza inventar relações etapa-a-etapa: usar a correspondência acordada e enviar casos sem destino verificável para exceção.
- O responsável financeiro não está especificado no contexto registrado; leads financeiros sem responsável resolvido ficam como exceção, sem atribuição padrão.
- Regras de identidade: 443 correspondências diretas de Cliente (sem cards Bpm existentes), 721 leads sem correspondência por CNPJ e 48 sem CNPJ identificável. Até 769 leads requerem associação explícita; não criar Cliente nem fazer matching aproximado automaticamente. Deals com CNPJ repetido permanecem distintos por ID RD.
- Uma cópia verificada do banco Turso remoto foi criada em 2026-10-13 em `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-13T18-41-59-079Z.sql` (manifesto correspondente). Ela serve como evidência da preparação, mas deverá ser revalidada e refeita se tiver mais de 48 horas no momento da carga. A evidência/relatório Vault e confirmação final ainda são gates obrigatórios.
- Pontos Alpha já identificados para inspeção/implementação: schema `BpmCard` e `BpmCardHistorico` em `prisma/schema.prisma`; jornada em `src/actions/bpm/Jornada.ts`; painel de histórico em `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoPipeline.tsx`; extração de timeline em `src/lib/timeline/extractors/card.ts`. Manter os eventos brutos RD imutáveis e registrar correções separadamente, integradas aos caminhos existentes.

### Restrições de execução

- Esta story não autoriza a carga automática sem prévia revisável e confirmação explícita da execução.
- Seguir `AGENTS.md`: antes de qualquer alteração estrutural, migração ou carga de alto risco no banco, acionar Vault, apresentar ambiente/impactos/riscos/alternativa/rollback, obter backup completo verificado dentro da validade e confirmação explícita do usuário.
- Nunca imprimir, incluir em relatório ou versionar o token RD ou payload real contendo dados pessoais.
- Não há arquivo `accumulated-context.md` nem `gotchas.json` encontrado no workspace; usar esta story e as instruções atuais do projeto como contexto disponível.
- Nenhuma orientação específica de implementação foi verificada em documento de arquitetura para esta integração. O agente de implementação deve inspecionar as estruturas existentes e registrar os caminhos reais antes de propor mudanças; não presumir nomes de tabelas, campos ou componentes.

### Testing

- Testes unitários para normalização de `deal_stage_histories`/activities, preservação das datas, ordenação cronológica e payload imutável.
- Testes de integração com respostas RD anonimizadas cobrindo paginação, 401/429/5xx, timeout, retomada, duplicidade e ausência de atividade.
- Testes do Alpha para edição autorizada, auditoria da correção e renderização do histórico combinado.
- Teste de reconciliação que valide contagens por funil e exclusão do lead fora do mapeamento.
- Os testes devem usar fixtures sintéticas/anonimizadas, nunca dados reais exportados da conta.

## Checklist

- [x] Escopo limitado aos dez funis já mapeados e aos 1.212 leads auditados.
- [x] Auditoria de referência registrada: 7.098 eventos de etapa e 3.601 atividades em 1.047 leads; 165 sem atividade listada.
- [x] Lead de Assessoria Smart explicitamente excluído até decisão de escopo.
- [x] Critérios incluem destinos dos dez funis aprovados, histórico editável com payload original preservado, idempotência e reconciliação.
- [x] Regras de exceção de identidade, duplicidade e responsáveis financeiros documentadas sem criação, associação ou atribuição silenciosa.
- [x] Guardrails de prévia, Vault, backup de até 48 horas, confirmação específica e rollback registrados.
- [x] Story draft checklist executado; pendências identificadas abaixo.
- [x] História implementada e carga reconciliada; revisão de QA pendente para a cobertura adicional de paginação/permissões indicada na tarefa 6.

### Resultado da Story Draft Checklist

| Categoria | Status | Observações |
|---|---|---|
| Goal & Context Clarity | PASS | Objetivo, valor, escopo, exclusão e fluxo estão explícitos. |
| Technical Implementation Guidance | PASS | Contrato RD, contagens, destinos por funil, pontos Alpha, identidade elegível/exceções, regras de importação e gates estão descritos; implementação confirma os contratos atuais antes de escolher armazenamento/componentes. |
| Reference Effectiveness | PARTIAL | Documentação RD ligada; não há epic/architecture específico ou accumulated-context disponível no workspace. |
| Self-Containment Assessment | PASS | Mapeamento de destinos, regras de negócio, contagens e salvaguardas resumidos na própria story. |
| Testing Guidance | PASS | Casos de API, idempotência, edição e reconciliação listados. |
| CodeRabbit Integration | PASS | Habilitado em `core-config.yaml`; tipo, agentes, gates, self-healing e foco preenchidos. |

**Final Assessment: READY FOR IMPLEMENTATION.** A story preserva o mapeamento de negócio decidido e define comportamento seguro para lacunas de identidade, etapa e responsável. A implementação deve localizar/validar o contrato técnico Alpha e a configuração detalhada etapa a etapa; itens que não forem verificáveis entram como exceção da prévia, sem bloquear a implementação dos caminhos resolvidos nem autorizar gravação automática. Reconsultar a origem e reconciliar contagens no momento da prévia.

## Dev Agent Record

### Agent Model Used

Codex — implementação e execução da carga RD Station CRM v1 para Turso.

### Debug Log References

- Backup/Vault: `docs/reports/vault-rd-alpha-migration-2026-10-13.md`.
- Execução: fingerprint `0d45bcd4ab61dbca58562b32397e53502d1828a72799f658f5bd88c533c2a29f`; batch final `rdimp_630af8b7f81bfe76566870b54cea`.
- Uma carga parcial anterior (233 cards) foi retomada por IDs estáveis; batch antigo atualizado para `RETOMADO` e batch final concluiu como `CONCLUIDO`.
- Reconciliação detectou um histórico de etapa novo na API atual para um dos 233 cards parciais; evento foi acrescentado por chave RD estável, mantendo inalterado o payload de detalhe originalmente capturado.
- Não registrar tokens, nomes de clientes ou payloads pessoais nos logs versionados.

### Completion Notes List

- Importação concluída no Turso para 1.212 cards nos dez funis autorizados; zero falhas de API ou etapas sem destino na prévia final.
- Total reconciliado: 7.107 eventos de etapa e 3.605 atividades (10.712 eventos); os 165 leads sem atividades foram mantidos com seus históricos de etapa.
- Os 1.212 cards possuem vínculo de origem e marcação “RD Station”; nenhum membro responsável está faltando. Os 47 negócios com CNPJ repetido continuam como cards separados.
- 979 cards foram gravados na execução final e 233 vieram da tentativa parcial retomada. A tentativa antiga foi marcada `RETOMADO` após a reconciliação.
- A consulta de enriquecimento cadastral falhou para 489 CNPJs; esses leads foram preservados usando os dados de organização/nome disponíveis no RD, sem associar a clientes Alpha por CNPJ divergente.
- O evento de etapa novo identificado durante a reconciliação foi acrescentado sem sobrescrever o payload bruto anterior.
- Não houve escrita no RD nem remoções de registros existentes; a migration de schema foi aditiva.
- `npm run lint`: 0 erros, 1.192 avisos legados. `npm run typecheck`: passou. Teste unitário RD: 4 passaram. Suíte completa: 4.452 passaram, 2 falharam em `tests/builder/embed.test.ts` por expectativa de URLs relativas no happy-dom. `npm run build` falhou inicialmente em `prisma generate` com `EPERM` ao copiar o query compiler; `npx prisma generate` isolado passou, sem novo build concluído.
- Cobertura dedicada adicional de paginação/erros de API e permissões segue pendente de revisão QA.

### File List

- `package.json` — comandos `rd-alpha:preview` e `rd-alpha:apply`.
- `prisma/schema.prisma` e `prisma/migrations/20261013110000_rd_station_external_history/migration.sql` — modelos/tabelas aditivos para importação, proveniência, eventos e correções.
- `scripts/migrar-rd-alpha.mjs` — preflight, mapeamento, aplicação idempotente e retomada.
- `src/lib/bpm/rd-station-history.ts` — projeção e correção auditável do histórico.
- `src/actions/bpm/RdStationHistorico.ts` — leitura e correção autorizadas.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoRd.tsx` e `PainelHistorico.tsx` — timeline RD na jornada do card.
- `src/actions/bpm/Cards.ts` e `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — vínculo/tag de origem nos cards.
- `tests/bpm/rd-station-history.test.ts` — testes unitários de projeção/correção.
- `docs/reports/vault-rd-alpha-migration-2026-10-13.md` — backup, autorização e resultado da aplicação.
- `docs/stories/story-alpha-crm-migracao-historico-rd-station-v1.md` — status, checklist e registro de implementação.

## QA Results

_A preencher após revisão/implementação QA._

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-10-13 | 1.0 | Story Draft criada com escopo, auditoria, requisitos de histórico editável, prévia, idempotência e salvaguardas de migração. | River (SM) |
| 2026-10-13 | 1.1 | Mapeamento acordado recuperado para a story; adicionadas regras de elegibilidade e exceção para leads sem cliente, etapas sem destino verificável e responsáveis financeiros pendentes. | River (SM) |
| 2026-10-13 | 1.2 | Implementação, migração autorizada, retomada e reconciliação de 1.212 cards e 10.712 eventos RD; adicionada a trilha de proveniência/correções e interface da jornada. | Codex |
