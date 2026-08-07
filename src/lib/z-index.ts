/**
 * Escala centralizada de z-index do Painel Alpha.
 *
 * Antes desta escala, valores de z-index eram hardcoded e inconsistentes pelo projeto
 * (ex: `z-40`, `z-50`, `z-[55]`, `z-[60]`, `z-[70]`, `z-[200]` em GlobalSidebar.tsx/
 * PainelLayoutClient.tsx/OnboardingModal.tsx). Esta constante NÃO renumera o que já existe
 * (mudar valores hardcoded do sidebar/onboarding está fora do escopo do Sistema de Notas e
 * arriscaria regressão visual em código não relacionado) — serve como a fonte única para
 * TODO componente novo do Sistema de Notas, e como referência para futuras migrações do
 * restante do painel para esta escala.
 *
 * Camadas conhecidas hoje que esta escala precisa conviver acima de:
 * - Sidebar mobile overlay/drawer: z-[60] / z-[70] (GlobalSidebar.tsx)
 * - Tooltip da sidebar: zIndex 200 (GlobalSidebar.tsx) — mais alto que qualquer camada abaixo,
 *   mas nota expandida/modal deve ficar acima mesmo assim quando aberta por cima dela.
 */
export const Z_INDEX = {
  /** Conteúdo principal da página (iframe de módulo, etc). */
  conteudoPrincipal: 0,
  /** Header/sidebar do painel. */
  headerSidebar: 50,
  /** Barra global inferior de notas (NotesGlobalTaskbar), sempre visível. */
  barraNotas: 100,
  /** Visualizador/editor de nota expandido acima da barra. */
  editorNotas: 110,
  /** Dropdowns e popovers (menu de contexto da aba, menu "ver todas as notas"). */
  dropdown: 150,
  /** Modais e diálogos (NoteShareDialog, NoteHistoryDialog, AlertDialog de confirmação). */
  modal: 250,
  /** Toasts (sonner, notificações de nota). */
  toast: 300,
  /** Alertas críticos — sempre no topo de tudo. */
  alertaCritico: 400,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;
