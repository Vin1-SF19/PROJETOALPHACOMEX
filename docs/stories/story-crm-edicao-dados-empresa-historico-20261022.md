# Story: CRM — edição completa dos dados da empresa e histórico auditável

## Status e responsáveis

Ready for Development — usuário delimitou explicitamente cadastro completo, contatos, QSA e RADAR/fiscal; contratos, pagamentos e equipe ficam fora da edição. Código e artefato de schema podem ser preparados; migração e validação do runtime em staging ficam pendentes de consentimento específico, após resultado concreto, relatório Vault e backup verificado. Produção continua sem autorização. `@sm` prepara story; `@architect` define persistência; `@dev` implementa; `@qa` valida; `@devops` publica dentro da autorização vigente.

## Story

**Como** usuário autorizado do CRM, **quero** editar cadastro completo, contatos, QSA e RADAR/fiscal pela gaveta, consultar CNPJ para preencher os dados disponíveis e salvar conscientemente, **para que** o cadastro fique correto e cada alteração tenha autor, data/hora e antes/depois no histórico. Contratos, pagamentos e equipe não integram esta edição, conforme resposta explícita do usuário.

Quero também retirar do histórico visível a anotação técnica inteira criada pela importação Instagram, mantendo o histórico comercial útil e a auditoria das edições.

## Comportamento solicitado

- Botão **Editar dados** bem visível ao lado de **Fonte: CS&NPS / ATIVO** na gaveta Dados da empresa.
- Ação pede confirmação antes de habilitar a edição de todos os campos dos grupos autorizados: cadastro completo, contatos, QSA e RADAR/fiscal. Negar/fechar essa confirmação não altera dados nem entra em edição. Contratos, pagamentos e equipe conservam a apresentação existente e ficam fora do editor.
- CNPJ preenchido oferece lupa para consultar as APIs existentes e preencher os dados disponíveis (incluindo QSA, Radar e capital social), como prévia do formulário. Botões **Salvar** e **Cancelar** ficam no topo durante edição.
- Dados pendentes impedem saída silenciosa do card: salvar, descartar explicitamente ou continuar editando. Cancelar/descartar não grava dados nem auditoria de alteração.
- Cada mudança confirmada aparece no histórico com campo, antes, depois, autor e dia/hora.

## Evidência e limites

- `DadosEmpresaConteudo.tsx` contém Fonte/situação no topo e apresenta informações consolidadas de empresa, contatos, sócios, CNAEs, regime/fiscal, Radar e relacionamento; `DadosEmpresaDrawer.tsx` controla abertura/carregamento e hoje só lê.
- `ObterDadosEmpresaCardBpm` em `src/actions/bpm/Empresas.ts` verifica acesso ao card e consolida `Cliente`, `ClienteServico`, `Pessoa`/vínculos, `ConsultaPreAnalise` e `radar_fiscal`. Trata-se de múltiplas fontes; somente os grupos autorizados entram na nova edição. Não gravar contratos/pagamentos/equipe ou usar dados consolidados de negócio como se fossem cadastrais.
- Decisão explícita de `@architect`: preparar `Cliente.perfilCadastralJson Json?` para extras cadastrais/contatos/QSA/RADAR/fiscal que precisam sobreviver inclusive sem CNPJ, mantendo os atributos básicos já canônicos em `Cliente`. DTO/allowlist e snapshot fortes definem o contrato; não aceitar JSON arbitrário nem usar o novo perfil para guardar contratos, pagamentos, equipe, segredos ou marketing. Auditoria mantém campos legíveis, em vez de expor um dump bruto do JSON.
- Concorrência definida por `@architect`: CAS em `Cliente.updatedAt` contra o snapshot carregado, com alteração de atributos/perfil e auditoria existente na mesma transação. Falha de pré-condição é conflito explícito; não sobrescrever edição concorrente. Não persistir o rascunho por CNPJ como chave quando ele ainda não existe.
- `HistoricoAlteracaoCliente` já tem `campo`, `valorAnterior`, `valorNovo`, `userId`, snapshot de nome, `criadoEm` e `loteId`; `ClienteServicoHistorico` e `BpmCardHistorico` também existem. Reusar os modelos apropriados e a timeline do card, evitando duplicar auditoria visível.
- `salvarAlteracoesCliente` atual é referência parcial: requer sessão, mas não aplica ACL específica de card, não aceita CNPJ e faz atualização/auditoria separadas. Não reutilizar esse caminho como se satisfizesse autorização/transação desta story.
- Clients existentes: `getReceitaData`, `getEmpresaAquiData`, `consultarRadar` e agregador `src/lib/bpm/consulta-cnpj-lead.ts`. `ConsultarCnpjNovoContrato` é restrita à etapa financeira; não remover essa restrição para usar a lupa desta gaveta. Criar/adaptar somente a camada autorizada necessária com os clients existentes, sem nova API externa.
- `CardFullViewModal.tsx` já tem revisão de pendências com salvar, continuar editando e sair sem salvar; integrar o rascunho da gaveta ao controle existente, sem fluxo paralelo que permita fechamento indevido.
- `AssumirLeadInstagram` cria `BpmInteracaoCard` técnica com resumo `Dados recebidos do Instagram`; `src/lib/bpm/timeline.ts` monta o feed. Ocultar o item técnico inteiro com identificação estreita da origem, preservar anotações humanas e eventos reais. Não apagar registros existentes nem fazer limpeza/backfill em massa.
- Nesta fase só preparar código/artefatos de schema: **não executar DDL/migration em staging ainda**. Aplicação da coluna exige plano concreto, relatório Vault, backup verificado e consentimento específico posterior do usuário conforme AGENTS. Vault prepara o backup por operações de leitura, sem DDL. Runtime/deploy dependente da coluna e sua homologação em staging ficam pendentes até esse gate; não publicar código que consulte a coluna num banco que ainda não a possui.
- Sem backfill, carga histórica, importação, alteração NoLoss/Apps Script, env ou escrita remota nesta inspeção. Preservar as duas stories anteriores com alterações locais. Marketing/UTMs privados no NoLoss continuam fora do CRM; produção permanece fora desta autorização.

## Acceptance Criteria

1. **Editar dados** aparece no topo ao lado de Fonte/situação, com destaque e rótulo acessível. Usuário somente leitura não ganha ação de edição. Confirmação explícita inicia a edição; cancelar a confirmação mantém leitura e não dispara escrita/consulta.
2. Após confirmar, todos os campos de **cadastro completo, contatos, QSA e RADAR/fiscal** podem ser editados, incluindo grupos/listas, conforme o DTO e as permissões vigentes. **Contratos, pagamentos e equipe ficam excluídos**, sem controles de edição nem alteração indireta. Identificadores técnicos, proveniência e auditoria permanecem metadados protegidos. Atributos básicos usam `Cliente`; extras usam `Cliente.perfilCadastralJson` conforme schema/DTO explícitos, inclusive quando CNPJ for ausente.
3. **Salvar** e **Cancelar** ficam visíveis no topo durante edição; estado de carregamento/erro/salvamento é claro. Alterar campos mantém um rascunho local; nenhum autosave ou atualização indireta de registros consolidados ocorre antes de Salvar.
4. Lupa do CNPJ requer documento preenchido e válido, sessão e permissão de edição do card. Consultar clients existentes no servidor; segredos e respostas brutas sensíveis não vão ao navegador. Resultados disponíveis preenchem somente a prévia, preservando edições locais deliberadas; campos ausentes, falhas parciais, timeout ou 404 não apagam valores válidos nem inventam QSA/Radar/capital.
5. Resposta assíncrona da consulta corresponde ao CNPJ/card ainda ativos; mudança de CNPJ, cancelamento, descarte, troca de card ou consulta mais recente invalida a resposta anterior. Consulta isolada não persiste cadastro, QSA, Radar, cache de negócio ou auditoria de alteração; se helper atual escreve, separar consulta e persistência.
6. Salvamento valida payload/allowlist/tipos/documento/contatos/valores e aplica ACL no servidor antes de ler ou escrever dados restritos, revalidando o contexto na transação. Escopo inclui somente empresa vinculada e entidades autorizadas. Não vincular/mesclar silenciosamente outra empresa se o novo CNPJ já existe nem editar registros de outro card por ID adulterado.
7. Alterações canônicas/perfil, vínculos pertinentes e auditoria são gravados atomicamente na mesma transação. Usar snapshot/DTO e CAS em `Cliente.updatedAt` para detectar edição concorrente; autor/data do servidor. Conflito, falha de validação ou erro SQL preserva rascunho e não deixa persistência/auditoria parcial; comunicar conflito sem sobrescrever a mudança de outra pessoa.
8. Cada campo efetivamente alterado registra antes/depois, autor real da sessão e dia/hora, agrupado no mesmo lote de Salvar usando os históricos existentes. Mostrar valores legíveis no histórico do card, com formatação do projeto `pt-BR`/`America/Sao_Paulo`. Não criar linha por campo inalterado nem permitir que o payload forje autor/data. Mudanças compartilhadas de empresa preservam o vínculo correto e não exigem acesso a outros cards restritos.
9. Salvar com sucesso sai da edição e atualiza gaveta/card/histórico a partir do persistido. Duplo clique/repetição não duplica auditoria. Falha mantém edição e pendências; não fechar nem exibir sucesso antes de commit confirmado.
10. **Cancelar** restaura o snapshot salvo e descarta prévias de consulta, sem escrita/auditoria de alteração. Ao tentar fechar gaveta/card, clicar fora, usar Escape, trocar card ou navegar com pendências, usar o guard existente com escolhas de salvar, descartar ou continuar. Rascunho não pode sumir silenciosamente; falha ao salvar conserva a edição. Proteção de saída do navegador usa o mecanismo aplicável, sem prometer impedir encerramento forçado do processo.
11. A anotação técnica inteira de importação Instagram deixa de aparecer no histórico visível, inclusive entradas legadas identificáveis, sem apagar registros/banco. Não remover anotações humanas pelo simples texto parecido nem ocultar eventos de criação/assunção ou a nova auditoria. Dados comerciais necessários continuam acessíveis nos locais próprios, sem reexpor envelope/marketing.
12. Testes cobrem confirmação, ACL/IDs adulterados, rascunho, todos os grupos autorizados e exclusão de contratos/pagamentos/equipe, perfil extra sem CNPJ, lupa/validação e corrida, consulta sem escrita, cancelamento/fechamento com pendências, transação/rollback, conflito CAS, auditoria por campo/autor/horário, repetição e filtro estreito da anotação técnica. Gates de código: lint, typecheck, testes e build; registrar resultados reais e atualizar File List/checklist. Testes de schema usam ambiente isolado autorizado, sem contornar o gate do banco staging.
13. Entrega concreta deve apresentar schema/migração preparados, ambiente/banco staging, impacto, alternativa e rollback para revisão. **Aplicação da migração e homologação runtime staging permanecem bloqueadas até consentimento específico após relatório Vault/backup verificado**; não executar DDL/backfill como parte dos gates de código. Após autorização, aplicar pelo fluxo aprovado e homologar; produção exige autorização própria posterior.

## Tasks / Subtasks

- [x] Inspecionar gaveta, fontes consolidadas, anotação técnica, histórico existente e guard de pendências.
- [x] Registrar delimitação explícita: cadastro completo/contatos/QSA/RADAR-fiscal; excluir contratos/pagamentos/equipe.
- [x] Registrar arquitetura: básicos em Cliente, extras em perfilCadastralJson, DTO/snapshot forte e CAS updatedAt com auditoria transacional.
- [ ] Preparar código e artefato schema/migração sem aplicar DDL ou acessar coluna ausente no runtime staging.
- [ ] Implementar filtro de histórico, confirmação e editor com rascunho/Salvar/Cancelar no topo.
- [ ] Integrar lupa preview com clients existentes e controle de respostas antigas.
- [ ] Implementar salvamento transacional, detecção de conflito e auditoria existente legível.
- [ ] Integrar guard de pendências da gaveta a todos os caminhos de saída pertinentes.
- [ ] Executar testes/gates de código e obter QA com resultado concreto revisável; não executar migração staging implicitamente.
- [ ] Receber relatório Vault/backup verificado e consentimento específico para migração staging; aplicar/homologar somente depois do gate.
- [ ] Produção permanece pendente de autorização específica.

## File List

- `docs/stories/story-crm-edicao-dados-empresa-historico-20261022.md` — story inicial; atualizar com arquivos efetivamente implementados.

## CodeRabbit Integration

Tipo: UI + Business Logic + dados canônicos/auditoria. QA revisa ACL, fontes consolidadas, rascunho/consulta sem escrita, atomicidade, conflitos, guard de saída e filtro preciso do item técnico. Nenhum teste de código ou parecer QA foi produzido nesta inspeção documental.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 0.1 | Editor completo com consulta em prévia, salvamento auditado e retirada visual da anotação técnica Instagram | `@sm` |
| 2026-10-22 | 0.2 | Escopo explícito do usuário e arquitetura de perfil JSON; código/schema preparados, DDL/runtime staging pendentes de consentimento específico | `@sm` / `@architect` |
