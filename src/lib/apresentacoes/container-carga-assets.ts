/**
 * URL do logo usado nas portas do Container Alpha (`ContainerCargaModel.tsx`). Extraído do
 * literal `/A.PNG` para permitir que o build do player de exportação HTML troque este módulo
 * por uma versão que embute o arquivo como `data:` URI em build-time (ver
 * `scripts/build-apresentacoes-player.mjs`, alias de `container-carga-assets` para
 * `container-carga-assets.player`) — Editor e Modo Apresentação continuam pedindo `/A.PNG`
 * do servidor Next normalmente, comportamento inalterado.
 */
export const LOGO_A_URL = "/A.PNG";
