/**
 * Clona os DTOs JSON-safe do ChatBot Alpha sem exigir `structuredClone` do navegador.
 *
 * O provider mock e o estado do módulo trabalham apenas com dados serializáveis em
 * JSON (objetos, arrays, strings, números, booleanos e null). Tipos especiais como
 * Date, Map, Set, File ou referências cíclicas não fazem parte desse contrato.
 */
export function cloneChatbotData<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}
