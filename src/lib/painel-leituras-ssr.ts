import "server-only";

export const PAINEL_SSR_READ_BUDGET_MS = 5_000;
// Four admitted render groups, not four SQL statements. Auth has its own pool.
// A group owns all three reads and optional onboarding until actual settlement.
export const PAINEL_SSR_PENDING_GROUP_LIMIT = 4;
let pendingGroups = 0;

type LeiturasPainel<Permissoes, Usuario, Links, Onboarding> = {
  permissoes: () => Promise<Permissoes>;
  usuario: () => Promise<Usuario | null>;
  links: () => Promise<Links>;
  usuarioPermitido: (usuario: Usuario) => boolean;
  onboarding: (usuario: Usuario) => Promise<Onboarding | null>;
};

type ResultadoLeiturasPainel<Permissoes, Usuario, Links, Onboarding> =
  | { estado: "INDISPONIVEL" }
  | { estado: "NEGADO" }
  | {
      estado: "PERMITIDO";
      permissoes: Permissoes;
      usuario: Usuario;
      links: Links;
      onboarding: Onboarding | null;
    };

/** Read-only SSR aggregation. No retry, positive cache or orphaned admission. */
export async function lerDadosLayoutPainel<Permissoes, Usuario, Links, Onboarding>(
  leituras: LeiturasPainel<Permissoes, Usuario, Links, Onboarding>,
): Promise<ResultadoLeiturasPainel<Permissoes, Usuario, Links, Onboarding>> {
  if (pendingGroups >= PAINEL_SSR_PENDING_GROUP_LIMIT) return { estado: "INDISPONIVEL" };
  pendingGroups++;
  const expiresAt = Date.now() + PAINEL_SSR_READ_BUDGET_MS;
  let closed = false;
  let readFailed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let decide: (result: ResultadoLeiturasPainel<Permissoes, Usuario, Links, Onboarding>) => void;
  const observation = new Promise<ResultadoLeiturasPainel<Permissoes, Usuario, Links, Onboarding>>((resolve) => {
    decide = (result) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      resolve(Date.now() >= expiresAt ? { estado: "INDISPONIVEL" } : result);
    };
    timer = setTimeout(() => decide({ estado: "INDISPONIVEL" }), PAINEL_SSR_READ_BUDGET_MS);
  });
  const start = <T>(read: () => Promise<T>) => Promise.resolve().then(read).catch((error: unknown) => {
    readFailed = true;
    throw error;
  });
  // Admission precedes callback invocation, including synchronous failures.
  const permissoes = start(leituras.permissoes);
  const usuario = start(leituras.usuario);
  const links = start(leituras.links);
  const onboarding = usuario.then((record) => {
    if (closed || Date.now() >= expiresAt) return null;
    if (!record || !leituras.usuarioPermitido(record)) {
      // A confirmed denial wins immediately; other reads still own this slot.
      decide({ estado: "NEGADO" });
      return null;
    }
    if (readFailed) return null;
    return leituras.onboarding(record);
  });

  // Promise.all would release capacity on the first rejection while other reads
  // keep waiting in the SDK. Observe every initiated read before releasing it.
  void Promise.allSettled([permissoes, usuario, links, onboarding]).then((results) => {
    if (closed) return;
    const [perms, record, visibleLinks, video] = results;
    if (perms.status === "fulfilled" && record.status === "fulfilled" && record.value &&
        visibleLinks.status === "fulfilled" && video.status === "fulfilled") {
      decide({ estado: "PERMITIDO", permissoes: perms.value, usuario: record.value, links: visibleLinks.value, onboarding: video.value });
    } else decide({ estado: "INDISPONIVEL" });
  }).finally(() => {
    pendingGroups--;
    clearTimeout(timer);
  });
  return observation;
}
