/**
 * Compartilhada entre RoadmapWorkspaces.ts (checa worker de workspace externo)
 * e RoadmapAlpha.ts (cruza objetivo documentado com worker do workspace) —
 * evita duplicar a mesma checagem de PID vivo duas vezes dentro do namespace
 * roadmap-alpha. Existe uma 3ª cópia idêntica em
 * lib/roadmap-production/execution-lock.ts (domínio diferente — lock de
 * execução, não PID de worker de workspace) que permanece separada de
 * propósito, para não acoplar os dois namespaces por uma função de 8 linhas.
 */
export function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
