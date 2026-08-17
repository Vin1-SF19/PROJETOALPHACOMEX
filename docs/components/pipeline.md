# Pipeline — Alpha CRM

Documentação do sistema de cards de pipeline (KanbanCard, KanbanColumn e
cards de pipeline do Dashboard) após RM-2026-C4A90D.

## Arquivos

- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/DashboardClient.tsx`
- `src/components/ui/crm-pipeline-border.tsx`

## Sizing responsivo (novo)

| Propriedade | Classe | Aplica-se a |
|-------------|--------|-------------|
| Largura base | `w-full` | KanbanCard, KanbanColumn, Dashboard card |
| Largura md | `md:w-[340px]` | KanbanCard, KanbanColumn, Dashboard card |
| Largura lg | `lg:w-[380px]` | KanbanCard, KanbanColumn, Dashboard card |
| Largura xl | `xl:w-[420px]` | KanbanCard, KanbanColumn, Dashboard card |
| Largura máx | `max-w-full` | KanbanCard, KanbanColumn, Dashboard card |
| Altura mínima | `min-h-[200px]` | KanbanCard |
| Altura máxima | `max-h-[600px]` | KanbanCard |
| Scroll interno | `overflow-y-auto overflow-x-hidden` | KanbanCard |

## Sombra dupla de profundidade (novo)

```css
/* Repouso */
box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 12px 40px rgba(0,0,0,0.2);

/* Hover (elevação) */
box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 16px 48px rgba(0,0,0,0.25);
```

Transição: `transition-shadow duration-300 ease-out`.

## Borda animada

Cards de pipeline (KanbanCard e Dashboard) são envoltos com
`<CrmPipelineBorder>` — ver `docs/components/crm-pipeline-border.md`.

## Background espacial

O layout raiz do CRM (`CRMLayoutClient.tsx`) renderiza
`<CrmSpaceBackground>` como primeira camada — ver
`docs/components/crm-space-background.md`.

## Notas

- O card **não dimensiona pelos filhos**: `min-h-[200px]` garante altura
  mínima mesmo com pouco conteúdo; `max-h-[600px]` + `overflow-y-auto`
  impede crescimento ilimitado.
- Múltiplos pipelines lado a lado: `flex flex-wrap gap-6` no container.
- `CrmPipelineBorder` funciona com `overflow-hidden` (gradiente absoluto
  dentro do container).
