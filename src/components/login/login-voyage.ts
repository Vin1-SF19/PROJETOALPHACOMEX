// Visual coordinates only; authentication and routing remain in the provider.
export const ROPE_ASSET = "/Corda Náutica com Laços Simétricos.png";
export const DOCK_PROGRESS = 0.3;
export const ROUTE_HANDOFF_PROGRESS = 0.35;

export function getVoyageLayout(width: number, height: number) {
  const shipWidth = Math.min(width * 0.74, 1000);
  const shipHeight = shipWidth * 941 / 1672;
  const shipTop = height * 0.95 - shipHeight;
  const dockX = width * 0.5 - shipWidth * 0.57;
  const handoffX = dockX + width * 0.045;
  const sternOffset = shipWidth * 0.05;
  const ropeLength = handoffX + sternOffset;
  const containerWidth = Math.min(624, Math.max(304, width * 0.42));
  return {
    shipWidth,
    shipTop,
    dockX,
    handoffX,
    startX: -shipWidth - width * 0.06,
    exitX: width + ropeLength - sternOffset,
    ropeLength,
    sternOffset,
    ropeY: shipTop + shipHeight * 0.64,
    cargoY: shipTop + shipHeight * 0.5 - height * 0.56,
    cargoScale: Math.min(0.32, shipWidth * 0.16 / containerWidth),
  };
}

export function getPageTowFraction(progress: number) {
  return Math.max(0, Math.min(1, (progress - ROUTE_HANDOFF_PROGRESS) / (1 - ROUTE_HANDOFF_PROGRESS)));
}
