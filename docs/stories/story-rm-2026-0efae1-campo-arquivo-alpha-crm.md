# Story RM-2026-0EFAE1 — Persistência do campo Arquivo no Alpha CRM

## Status

**Draft** — fase 2: especificação executável preparada; validação PO e liberação para implementação pendentes. Não há aprovação registrada.

Template: `.aiox-core/product/templates/story-tmpl.yaml`. O template enumera Draft/Approved/InProgress/Review/Done, enquanto `.aiox-core/development/tasks/validate-next-story.md`, etapa 12, exige validação PO com GO para Draft → Ready. Aplicar o procedimento de validação antes de iniciar código; não inferir aprovação a partir do PASS do Scout. A referência `.claude/rules/story-lifecycle.md` não existe neste checkout.

## Executor Assignment

executor: Nova (frontend, atribuído pela fase)
quality_gate: Forge (técnico), Probe (integração), Anubis (upload/acesso), Lens (após Forge)
quality_gate_tools: npm run lint; npm run typecheck; npm test; npm run build; testes de interação e autorização

## Story

**Como** usuário autorizado de um card do Alpha CRM,
**quero** enviar um arquivo no formulário da etapa e recuperar sua referência persistida,
**para** identificar e abrir o anexo após fechar, reabrir e recarregar o card.

Fonte: objetivo RM-2026-0EFAE1 e dois blueprints Scout fornecidos à fase 2. A perda relatada ainda não foi reproduzida; falha de storage/rede/configuração não é causa comprovada.

## Acceptance Criteria

1. Arquivo aceito pela validação existente conclui upload e registro associado ao card/campo correto; sucesso só é apresentado após confirmação da action.
2. O ID confirmado permanece em BpmCardCampoValor e corresponde ao BpmCardAnexo. Reabrir o card e recarregar a página preserva o vínculo.
3. O formulário mostra nome e link protegido do anexo confirmado, também listado na aba Anexos; abrir o link permite visualizar o conteúdo ou salvá-lo pelo navegador conforme o tipo suportado.
4. Upload e registro entram na fila antes do primeiro trabalho assíncrono. Fechamento/avanço aguardam a operação; falha não produz falso sucesso nem permite avanço indevido. Preservar o fluxo existente de confirmação de saída.
5. Confirmar o arquivo reconcilia somente sua revisão/campo. Edições concorrentes de outros campos, realtime e pendências recentes permanecem preservadas; evitar save redundante sobrescrevendo a referência.
6. Falhas de upload, registro ou recarga apresentam erro claro, distinguindo arquivo salvo de confirmação visual indisponível. É possível tentar novamente com o mesmo arquivo; falha na substituição mantém a referência anterior confirmada.
7. Preservar disabled/readOnly, autenticação, autorização por card e validações atuais de MIME/tamanho/recibo. Sem credenciais de storage no cliente. Acesso sem sessão/sem permissão não entrega o conteúdo.
8. Não regredir CPF, CNPJ, seleção, percentual, demais tipos nem upload independente da aba Anexos. Sem schema, migration, nova API, mudança de auth ou mutação em massa.

## Tasks / Subtasks

- [x] Localizar story e evitar duplicata: nenhuma específica encontrada; adotar o nome solicitado pela fase (os Scouts sugeriam dois nomes).
- [x] Incorporar blueprint Scout e conferir no código upload, transação, fila e link protegido.
- [x] Registrar consumidor, caminho real, autoajustes, critérios, dependências, testes e file list.
- [ ] PO executar validate-next-story e registrar GO/NO-GO e transição real; só então liberar implementação.
- [ ] Antes do restante da correção, integrar operação completa à fila existente e mostrar nome/link no formulário (AC 3–5); preservar trabalho local dos objetivos anteriores.
- [ ] Em CampoBpmInput, expor acompanhamento da operação, confirmação persistida distinta de onChange comum, feedback e repetição do mesmo arquivo (AC 1, 3, 6, 7).
- [ ] Em PainelCamposEtapaAtual, registrar a operação antes do await, reconciliar somente a revisão confirmada e recarregar anexos sem apagar rascunhos (AC 2, 4, 5).
- [ ] Validar persistência conjunta e rejeições com mocks, reutilizando a action/rota atuais, sem alterá-las (AC 1, 2, 7).
- [ ] Executar testes abaixo, atualizar checklist/file list com evidências reais e registrar limitações (AC 1–8).
- [ ] Forge: lint, typecheck e build completos; npm test completo; resultados registrados sem confundir testes direcionados com aprovação global.
- [ ] Probe: presença, trigger, rota protegida, permissões, persistência, estados de UI, storage e regressões.
- [ ] Anubis: auditar integração de upload/acesso; Lens somente após Forge; Sage: cobertura dos cenários.
- [ ] Scribe/Kowalski: atualizar memória pertinente e journal; nenhuma publicação automática.

## Dev Notes

### Evidências Scout conferidas

| Evidência | Fonte real | Implicação |
| --- | --- | --- |
| Upload via FormData, RegistrarAnexoBpm e onChange(id), estado local enviandoArquivo | src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx:140 | Não participa da fila; exibe somente “Arquivo vinculado” |
| Salvar campos usa registerSave, consulta ObterCardBpm e rastreadores de revisão | src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx:157 | Reutilizar proteção concorrente; não limpar todo o formulário |
| Transação cria anexo e faz upsert do valor; recibo e vínculo de campo validados | src/actions/bpm/Anexos.ts:22 | Mecanismo de persistência já existe; nenhuma nova tabela necessária |
| Link por nome na aba Anexos | src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx:203 | Reutilizar referência interna protegida |
| GET exige sessão e visualizar; retorna conteúdo privado sem cache | src/app/api/bpm/anexos/[anexoId]/route.ts | Reutilizar sem expor URL privada/token |

Reutilizáveis: CardSaveContext.tsx, `src/lib/bpm/rascunho-versionado.ts`, ObterCardBpm, RegistrarAnexoBpm, `/api/bpm/upload`, `/api/bpm/anexos/[anexoId]`. Consulte também `.bibble/memory/components.md` (CardSaveContext/CardFullViewModal) e known-errors.md (revisões de rascunho) antes de implementar. Não é necessário alterar o contrato compartilhado segundo o Scout; reavaliar apenas se a evidência exigir.

### Dependências e limites

Objetivo 7 de 10 da mesclagem. Preservar base de navegação RM-2026-B5C986; remoções RM-2026-51AE7B/2C769C/64D3A8; contraste RM-2026-389729; readOnly e edição CNPJ RM-2026-6F4E3F; fila/revisões CPF RM-2026-09A642. Revalidar compatibilidade ao receber cada alteração; não assumir gates aprovados. RM-2026-2BED08 e RM-2026-E4F8AF dependem da estabilidade resultante.

Working tree contém mudanças preexistentes em componentes e contexto compartilhados. Aplicar patches mínimos sobre o conteúdo atual, sem reset/checkout/commit/push. Sem alteração de banco nesta story. Se surgir necessidade indispensável de schema/migration/mutação em massa, interromper a operação e criar fase Vault kind APPROVAL com plano exato, backup completo verificado ≤48h e aprovação humana específica. Nenhuma aprovação histórica autoriza esse novo escopo.

### Entregabilidade e autoajustes

Artefato desta fase: esta story, consumida pelo PO e executor via docs/stories/. Artefato funcional do objetivo: anexo persistido e consultável pelo usuário autorizado do card.

DELIVERY_READY: infraestrutura existente conferida no código: menu Alpha CRM (src/lib/modulos-registry.ts:67) → Pipelines (CRMLayoutClient.tsx:24) → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → aba Anexos → /api/bpm/anexos/[anexoId]. Homologação autenticada ainda pendente; este sinal não afirma que a correção funcional esteja pronta.

Autoajuste documental aplicado: story ausente criada com critérios e testes. Não é necessário criar visualizador, rota, menu ou exportação para consumir o anexo já registrado.

AUTO_ADJUSTMENT_REQUIRED: Campo Arquivo ainda não mostra nome/link e upload não participa da fila de salvamento; suporte mínimo obrigatório antes de concluir a implementação funcional.
AUTO_ADJUSTMENT_ACCEPTANCE: Upload em andamento bloqueia fechamento/avanço prematuro; confirmação limpa somente sua pendência; reabrir/recarregar mantém nome e link protegido, sem perder outro campo editado.

Nesta fase de preparação, o suporte funcional fica explicitamente nas primeiras tarefas da implementação, condicionado à liberação real da story, sem inventar aprovação para antecipar código.

## Testing

| Cenário | Resultado verificável | Cobertura planejada |
| --- | --- | --- |
| Arquivo válido → upload → registro → reabrir → recarregar | ID e nome persistem no mesmo card/campo, link retorna bytes corretos | React real + action com mocks + homologação autenticada |
| Fechar ou avançar durante upload/registro | Flush aguarda; não fecha/avança antes da confirmação | React + card-save-flow |
| Outro campo editado durante upload e evento realtime | Rascunho e pendência alheios permanecem | React com promises controladas |
| Falhas de upload/registro/recarga | Erro específico; sem falso sucesso; repetição do mesmo arquivo funciona | React com mocks de fetch/actions |
| Substituir anexo com sucesso/falha | Novo ID confirmado ou referência anterior preservada | React + action |
| Registro falha dentro da transação | Sem persistência parcial de anexo/valor | Action com transação simulada |
| Recibo expirado/inválido, card/campo incompatível, MIME/tamanho inválidos | Rejeição pelas guardas existentes | Action/upload com mocks |
| Sem sessão, sem permissão, arquivo ausente | Download 401/403/404, sem bytes privados indevidos | Rota com dependências simuladas |
| disabled/readOnly; demais tipos; aba Anexos | Sem envio indevido nem regressão do fluxo existente | React/regressão |

Criar testes sugeridos pelo Scout renderizando CampoBpmInput real com happy-dom (padrão tests/bpm/cpf-pendencias-react.test.ts), isolando storage e banco. Reexecutar tests/bpm/anexos-idempotencia.test.ts, anexos-storage.test.ts, card-save-flow.test.ts, edicao-campos-card.test.ts e testes de CPF. Homologação em Revisão de Radar deve registrar ambiente, perfil, card de teste e resultado sem dados sensíveis; não foi executada nesta fase.

## CodeRabbit Integration

Habilitado em `.aiox-core/core-config.yaml:207`. Revisão de código pendente da fase de implementação; sem veredito nesta preparação. Risco principal: confirmação de referência e concorrência. Verificar ausência de findings críticos antes do gate final, respeitando a ordem Forge → Lens.

## Dev Agent Record

Fase 2, Nova, 2026-09-22. Delegação de criação ao agente SM tentada; ferramenta retornou “no thread with id”, sem agente iniciado. Documento mínimo criado conforme instrução explícita da fase. Não atribuir aprovação a SM/PO nem declarar Ready. Nenhum componente criado/alterado; causa em produção não reproduzida.

### File List — alterações desta fase

- docs/stories/story-rm-2026-0efae1-campo-arquivo-alpha-crm.md (criado)
- .bibble/memory/journal.md (registro acrescentado)
- docs/qa/rm-2026-0efae1/ (logs dos gates desta fase)

### File List — planejada para implementação, ainda não alterada por esta fase

- src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx
- tests/bpm/arquivo-persistencia-react.test.ts
- tests/bpm/arquivo-persistencia-actions.test.ts
- tests/bpm/anexos-download.test.ts
- .bibble/memory/components.md (somente ao mudar o contrato dos componentes)

## QA Results

Inspeção documental e integração no código realizadas; validação PO, homologação e aprovação técnica não concedidas. Resultados de comandos serão registrados abaixo após execução.

## Change Log

| Data | Versão | Alteração | Autor |
| --- | --- | --- | --- |
| 2026-09-22 | 0.1 | Draft com blueprint Scout, aceite, autoajustes e plano de testes; sem liberação PO | Nova |
