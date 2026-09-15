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

export const CHAVE_FORMAS_PAGAMENTO_PERSONALIZADAS = "painelalpha:cs-nps:formas-pagamento-personalizadas:v1";
const CHAVE_FORMAS_PAGAMENTO_REMOVIDAS = `${CHAVE_FORMAS_PAGAMENTO_PERSONALIZADAS}:removidas`;

interface ArmazenamentoFormasPagamento {
    getItem(chave: string): string | null;
    setItem(chave: string, valor: string): void;
}

function armazenamentoPadrao(): ArmazenamentoFormasPagamento | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function ehFormaPagamentoPadrao(valor: string): boolean {
    return FORMAS_PAGAMENTO.some((forma) => forma === valor || FORMAS_LABEL[forma] === valor);
}

function normalizarLista(valores: readonly string[]): string[] {
    const unicos = new Map<string, string>();

    for (const valor of valores) {
        const normalizado = valor.trim();
        if (!normalizado || ehFormaPagamentoPadrao(normalizado)) continue;
        const chave = normalizado.toLocaleLowerCase("pt-BR");
        if (!unicos.has(chave)) unicos.set(chave, normalizado);
    }

    return [...unicos.values()];
}

function lerListaArmazenada(
    chave: string,
    armazenamento: ArmazenamentoFormasPagamento | null,
): string[] {
    try {
        const conteudo = armazenamento?.getItem(chave);
        const dados: unknown = conteudo ? JSON.parse(conteudo) : [];
        return Array.isArray(dados)
            ? dados.filter((item): item is string => typeof item === "string")
            : [];
    } catch {
        return [];
    }
}

export function listarFormasPagamentoPersonalizadas(
    valoresDosRegistros: readonly string[] = [],
    armazenamento: ArmazenamentoFormasPagamento | null = armazenamentoPadrao(),
): string[] {
    const valoresSalvos = lerListaArmazenada(CHAVE_FORMAS_PAGAMENTO_PERSONALIZADAS, armazenamento);
    const removidas = new Set(
        lerListaArmazenada(CHAVE_FORMAS_PAGAMENTO_REMOVIDAS, armazenamento)
            .map((valor) => valor.toLocaleLowerCase("pt-BR")),
    );

    return normalizarLista([...valoresSalvos, ...valoresDosRegistros]).filter(
        (valor) => !removidas.has(valor.toLocaleLowerCase("pt-BR")),
    );
}

export function salvarFormaPagamentoPersonalizada(
    valor: string,
    formasAtuais: readonly string[],
    armazenamento: ArmazenamentoFormasPagamento | null = armazenamentoPadrao(),
): { formas: string[]; valorCanonico: string } {
    const formas = normalizarLista([...formasAtuais, valor]);
    const chaveDoValor = valor.trim().toLocaleLowerCase("pt-BR");
    const valorCanonico = formas.find(
        (forma) => forma.toLocaleLowerCase("pt-BR") === chaveDoValor,
    ) ?? valor.trim();
    try {
        armazenamento?.setItem(CHAVE_FORMAS_PAGAMENTO_PERSONALIZADAS, JSON.stringify(formas));
        const removidas = lerListaArmazenada(CHAVE_FORMAS_PAGAMENTO_REMOVIDAS, armazenamento)
            .filter((forma) => forma.toLocaleLowerCase("pt-BR") !== chaveDoValor);
        armazenamento?.setItem(CHAVE_FORMAS_PAGAMENTO_REMOVIDAS, JSON.stringify(removidas));
    } catch {
        // A seleção ainda funciona mesmo com localStorage indisponível.
    }
    return { formas, valorCanonico };
}

export function removerFormaPagamentoPersonalizada(
    valor: string,
    formasAtuais: readonly string[],
    armazenamento: ArmazenamentoFormasPagamento | null = armazenamentoPadrao(),
): string[] {
    const chaveRemovida = valor.trim().toLocaleLowerCase("pt-BR");
    const formas = normalizarLista(formasAtuais).filter(
        (forma) => forma.toLocaleLowerCase("pt-BR") !== chaveRemovida,
    );
    try {
        armazenamento?.setItem(CHAVE_FORMAS_PAGAMENTO_PERSONALIZADAS, JSON.stringify(formas));
        const removidas = normalizarLista([
            ...lerListaArmazenada(CHAVE_FORMAS_PAGAMENTO_REMOVIDAS, armazenamento),
            valor,
        ]);
        armazenamento?.setItem(CHAVE_FORMAS_PAGAMENTO_REMOVIDAS, JSON.stringify(removidas));
    } catch {
        // Remoção do catálogo em memória continua válida nesta sessão.
    }
    return formas;
}

/** Formata um valor de forma de pagamento salvo (enum conhecido ou texto livre digitado pelo comercial em "outro") para exibição. */
export function formatarFormaPagamento(valor: string | null | undefined): string {
    if (!valor) return "---";
    return FORMAS_LABEL[valor] ?? valor;
}
