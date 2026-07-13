/**
 * Mesmas formas de pagamento usadas no Painel de Metas (`ModalGerenciamentoLeads.tsx`),
 * replicadas aqui (não importadas do módulo comercial, para não acoplar CS&NPS ao
 * Metas) — usadas tanto no cadastro manual (`modal.tsx`) quanto na exibição dos
 * cards de "Serviços Contratados" (`modalDados.tsx`).
 */
export const FORMAS_PAGAMENTO = ["ENTRADA_EXITO", "PARCELADO_CC", "INTEGRAL_PIX"] as const;

export const FORMAS_LABEL: Record<string, string> = {
    ENTRADA_EXITO: "50% Entrada / 50% Êxito (Pix)",
    PARCELADO_CC: "Parcelamento Cartão de Crédito - até 12x com juros",
    INTEGRAL_PIX: "Integral na contratação - 10% OFF (Pix)",
};

/** Formata um valor de forma de pagamento salvo (enum conhecido ou texto livre digitado pelo comercial em "outro") para exibição. */
export function formatarFormaPagamento(valor: string | null | undefined): string {
    if (!valor) return "---";
    return FORMAS_LABEL[valor] ?? valor;
}
