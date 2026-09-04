export interface SnapshotRascunho {
  valor: string;
  revisao: number;
}

export interface RastreadorRascunho {
  alterar: (valor: string) => SnapshotRascunho;
  sincronizar: (valor: string) => void;
  capturar: () => SnapshotRascunho;
  corresponde: (snapshot: SnapshotRascunho) => boolean;
}

/** Mantém a identidade do rascunho durante saves assíncronos concorrentes. */
export function criarRastreadorRascunho(valorInicial: string): RastreadorRascunho {
  let atual: SnapshotRascunho = { valor: valorInicial, revisao: 0 };

  return {
    alterar(valor) {
      atual = { valor, revisao: atual.revisao + 1 };
      return { ...atual };
    },
    sincronizar(valor) {
      atual = { valor, revisao: atual.revisao };
    },
    capturar() {
      return { ...atual };
    },
    corresponde(snapshot) {
      return atual.revisao === snapshot.revisao && atual.valor === snapshot.valor;
    },
  };
}
