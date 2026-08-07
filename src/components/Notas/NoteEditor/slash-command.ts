import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { SlashCommandList, type SlashCommandItem, type SlashCommandListRef } from "./SlashCommandList";

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  { title: "Título", comando: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: "Lista", comando: (editor) => editor.chain().focus().toggleBulletList().run() },
  { title: "Lista numerada", comando: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { title: "Checklist", comando: (editor) => editor.chain().focus().toggleTaskList().run() },
  { title: "Tabela", comando: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: "Código", comando: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { title: "Citação", comando: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { title: "Divisor", comando: (editor) => editor.chain().focus().setHorizontalRule().run() },
  { title: "Data", comando: (editor) => editor.chain().focus().insertContent(new Date().toLocaleDateString("pt-BR")).run() },
  { title: "Hora", comando: (editor) => editor.chain().focus().insertContent(new Date().toLocaleTimeString("pt-BR")).run() },
];

function filtrarComandos(query: string): SlashCommandItem[] {
  return SLASH_COMMAND_ITEMS.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
}

/**
 * Posicionamento do popup via `position: fixed` + `getBoundingClientRect` nativo do próprio
 * DOM — sem lib de popup externa (tippy.js etc), seguindo a mesma diretriz já documentada em
 * `decisions.md` sobre evitar instalar bibliotecas que fazem algo que o projeto já resolve.
 */
const suggestionOptions: Omit<SuggestionOptions, "editor"> = {
  char: "/",
  items: ({ query }) => filtrarComandos(query),
  render: () => {
    let component: ReactRenderer<SlashCommandListRef>;
    let elementoPopup: HTMLDivElement | null = null;

    function posicionar(clientRect: (() => DOMRect | null) | null | undefined) {
      if (!elementoPopup || !clientRect) return;
      const rect = clientRect();
      if (!rect) return;
      elementoPopup.style.top = `${rect.bottom + 4}px`;
      elementoPopup.style.left = `${rect.left}px`;
    }

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, { props, editor: props.editor });

        elementoPopup = document.createElement("div");
        elementoPopup.style.position = "fixed";
        elementoPopup.style.zIndex = "9999";
        elementoPopup.appendChild(component.element);
        document.body.appendChild(elementoPopup);
        posicionar(props.clientRect);
      },
      onUpdate: (props) => {
        component.updateProps(props);
        posicionar(props.clientRect);
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          elementoPopup?.remove();
          elementoPopup = null;
          return true;
        }
        return component.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        elementoPopup?.remove();
        elementoPopup = null;
        component.destroy();
      },
    };
  },
};

export const SlashCommand = Extension.create({
  name: "slashCommand",
  addOptions() {
    return { suggestion: suggestionOptions };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          (props as SlashCommandItem).comando(editor);
        },
      }),
    ];
  },
});
