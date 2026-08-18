const ENABLED_VALUE = "true";
type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export const ROADMAP_PRODUCTION_RUNTIME_DISABLED =
  "ROADMAP_PRODUCTION_RUNTIME_DISABLED";

export function isRoadmapProductionRuntimeEnabled(
  env: RuntimeEnvironment = process.env,
): boolean {
  return env.ROADMAP_PRODUCTION_ENABLED?.trim().toLowerCase() === ENABLED_VALUE;
}

export function canUseRoadmapProduction(
  hasProductionPermission: boolean,
  env: RuntimeEnvironment = process.env,
): boolean {
  return (
    hasProductionPermission && isRoadmapProductionRuntimeEnabled(env)
  );
}

export function assertRoadmapProductionRuntimeEnabled(
  env: RuntimeEnvironment = process.env,
): void {
  if (!isRoadmapProductionRuntimeEnabled(env)) {
    throw new Error(ROADMAP_PRODUCTION_RUNTIME_DISABLED);
  }
}
