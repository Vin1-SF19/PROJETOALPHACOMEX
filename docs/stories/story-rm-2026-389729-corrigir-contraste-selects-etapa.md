# RM-2026-389729 — Contraste dos selects do formulário de etapa

Status: Implementada; gates globais e validação visual pendentes

## Objetivo e contexto
Usuários autorizados do Alpha CRM precisam ler booleano, seleção simples e
multisseleção no formulário da etapa. Implementação baseada no blueprint Scout
recebido nas fases anteriores. Preservar as cores já adicionadas localmente aos
selects simples e completar multisseleção, resolvendo conflitos com classes do pai.

## Escopo e critérios de aceite
- [x] Controle, placeholder e opções com fundo escuro e texto claro.
- [x] Opções selecionadas do múltiplo visualmente distintas.
- [x] Preservar foco, teclado nativo, disabled/readOnly, ARIA, callbacks e JSON.
- [x] Preservar campos canônicos, CNPJ, arquivo e demais tipos.
- [x] Executar lint, typecheck, testes e build, registrando resultados reais.
- [ ] Validar visualmente no card real, com/sem foco, vazio, inválido e desabilitado.

## Entregabilidade e blueprint
Artefato: CampoBpmInput integrado ao formulário de etapa, consumido pelos usuários
autorizados em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card →
CardFullViewModal → PainelRegistrar → CardOpenFormSlot → PainelCamposEtapaAtual.
Configuração em `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`, aba Campos e
formulários. A prévia administrativa genérica não valida os selects reais.

Autoajuste exigido: criar esta story antes de implementar. Nenhuma nova rota,
API, auth ou mudança de banco necessária. Reutilizar `cn` de `@/lib/utils`.

## Riscos e validação
Opções nativas podem variar por navegador/SO. Validar seleção focada e sem foco,
teclado e legibilidade sem substituir a semântica nativa. Gates globais podem
reportar problemas do working tree preexistente; registrar sem ocultar falhas.

## Checklist
- [x] Blueprint recebido e componente/diff inspecionados.
- [x] Story mínima criada como autoajuste obrigatório.
- [x] Correção implementada.
- [x] Evidências e checklist atualizados.

## File list
- `docs/stories/story-rm-2026-389729-corrigir-contraste-selects-etapa.md`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `.bibble/memory/journal.md`

## Evidências
Implementadas classes de contraste via `cn`, removendo fundo/texto conflitantes
recebidos do painel. Opções múltiplas usam `checked:bg-cyan-900`, texto claro e
peso semibold; nenhum placeholder artificial, estado ou callback novo. As cores
preexistentes das opções simples foram preservadas. Critérios visuais marcados
acima representam implementação em código; aprovação visual permanece pendente.

DELIVERY_READY: integração confirmada no código pela rota de pipeline → card →
PainelRegistrar → CardOpenFormSlot → PainelCamposEtapaAtual → CampoBpmInput,
com `podeEditar` preservado. Sem validação autenticada em navegador nesta sessão.
Autoajuste aplicado: criação desta story antes da edição de produção.

Gates reais (2026-09-22):
- Typecheck: exit 0.
- Lint focado no componente: exit 0.
- Vitest focado: 5 arquivos, 63 testes aprovados (edição de campos,
  renderer, campos configuráveis, máscara CNPJ, configuração confiável).
- Composição `tailwind-merge`: cores conflitantes removidas, tamanho/foco mantidos.
- `git diff --check` focado: aprovado.
- Lint global: exit 1, 2.417 erros e 1.218 avisos; componente focado aprovado.
- `npm test`: exit 1 antes da suíte, EBUSY ao acessar diretório coverage.
- Build: 0.

Logs: `.roadmap-worker/rm-2026-389729-gates/`.
Resultado da fase: FAIL por gates globais; não houve alteração de banco,
API, auth ou Git mutável. Conferência visual autenticada e screenshot ficam
pendentes; não se afirma aprovação visual das opções nativas em todos os SOs.

