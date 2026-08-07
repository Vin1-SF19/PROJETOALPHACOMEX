/**
 * Ponto de entrada do bundle standalone do player de exportação HTML. Este arquivo (e tudo
 * que ele importa) NUNCA passa pelo pipeline do Next.js — é bundlado isoladamente por
 * `scripts/build-apresentacoes-player.mjs` (esbuild, formato IIFE) e o resultado é embutido
 * como `<script>` inline no `.html` exportado (ver `src/generated/apresentacoes-player-bundle.ts`).
 * Por isso: nunca importar `next/*` nem qualquer arquivo com `"use server"` a partir daqui —
 * o script de build falha automaticamente (guard no metafile) se isso acontecer.
 */
import { createRoot } from "react-dom/client";
import { PlayerStandalone } from "./PlayerStandalone";

const container = document.getElementById("root");
const dados = window.__ALPHA_APRESENTACAO_DADOS__;

if (container && dados) {
  createRoot(container).render(<PlayerStandalone dados={dados} />);
} else if (container) {
  container.innerHTML = '<div style="display:flex;height:100dvh;width:100dvw;align-items:center;justify-content:center;background:#000;color:#94a3b8;font:14px sans-serif">Dados da apresentação não encontrados.</div>';
}
