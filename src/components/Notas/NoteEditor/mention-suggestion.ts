import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { BuscarTodosUsuarios } from "@/actions/RecursosHumanos";
import { MentionList, type MentionItem, type MentionListRef } from "./MentionList";

async function buscarUsuarios(query: string): Promise<MentionItem[]> {
  const res = await BuscarTodosUsuarios();
  if (!res.success) return [];

  return res.data
    .filter((u) => u.status === "ATIVO" && u.nome.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)
    .map((u) => ({ id: u.id, label: u.nome }));
}

/** Mesma técnica de popup manual (sem tippy.js) do slash-command.ts — ver decisions.md. */
export const mentionSuggestion: Omit<SuggestionOptions<MentionItem>, "editor"> = {
  char: "@",
  items: async ({ query }) => buscarUsuarios(query),
  render: () => {
    let component: ReactRenderer<MentionListRef>;
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
        component = new ReactRenderer(MentionList, { props, editor: props.editor });
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
