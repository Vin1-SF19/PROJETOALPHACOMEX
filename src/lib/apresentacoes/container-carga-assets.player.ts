/**
 * Variante usada SOMENTE pelo bundle do player de exportação HTML (alias configurado em
 * scripts/build-apresentacoes-player.mjs) — nunca importada pelo app Next.js normal, que
 * continua usando `container-carga-assets.ts` (o `/A.PNG` real, servido pelo Next).
 * `__LOGO_A_DATA_URI__` é substituído em build-time pelo esbuild (`define`), a partir da
 * leitura de `public/A.PNG` feita uma única vez no script de build — não é uma chamada de
 * rede em runtime, e nenhum código Node.js (`fs`) entra neste arquivo/no bundle do browser.
 */
declare const __LOGO_A_DATA_URI__: string;

export const LOGO_A_URL = __LOGO_A_DATA_URI__;
