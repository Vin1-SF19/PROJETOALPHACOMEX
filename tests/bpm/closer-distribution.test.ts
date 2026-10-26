import { describe, expect, it } from "vitest";
import {
  escolherProximoCloser,
  gravarConfiguracaoDistribuicaoClosers,
  lerConfiguracaoDistribuicaoClosers,
  usuarioOnlinePeloHeartbeat,
  type ConfiguracaoDistribuicaoClosers,
} from "@/lib/bpm/closer-distribution";

const config = { ativa: true, usuariosIds: [10, 20, 30], ultimoUsuarioId: null };

describe("distribuição automática entre closers", () => {
  it("mantém rodízio equilibrado entre os selecionados elegíveis", () => {
    let atual: ConfiguracaoDistribuicaoClosers = config;
    const atribuicoes = Array.from({ length: 8 }, () => {
      const resultado = escolherProximoCloser({ config: atual, elegiveisIds: [10, 20, 30], onlineIds: [] });
      atual = resultado.proximoConfig;
      return resultado.responsavelId;
    });
    expect(atribuicoes).toEqual([10, 20, 30, 10, 20, 30, 10, 20]);
  });

  it("distribui somente entre online e mantém equilíbrio nesse subconjunto", () => {
    let atual: ConfiguracaoDistribuicaoClosers = config;
    const atribuicoes = Array.from({ length: 6 }, () => {
      const resultado = escolherProximoCloser({ config: atual, elegiveisIds: [10, 20, 30], onlineIds: [10, 30] });
      atual = resultado.proximoConfig;
      expect(resultado.onlineNaEscolha).toBe(true);
      return resultado.responsavelId;
    });
    expect(atribuicoes).toEqual([10, 30, 10, 30, 10, 30]);
  });

  it("usa todos os selecionados quando nenhum está online", () => {
    const resultado = escolherProximoCloser({ config, elegiveisIds: [10, 20, 30], onlineIds: [] });
    expect(resultado.responsavelId).toBe(10);
    expect(resultado.onlineNaEscolha).toBe(false);
  });

  it("ignora selecionados inativos ou inelegíveis", () => {
    const resultado = escolherProximoCloser({ config, elegiveisIds: [20], onlineIds: [10, 20] });
    expect(resultado.responsavelId).toBe(20);
  });

  it("considera online apenas heartbeat válido com até 60 segundos", () => {
    const agora = new Date("2026-10-26T12:00:00.000Z");
    expect(usuarioOnlinePeloHeartbeat("2026-10-26T11:59:00.000Z", agora)).toBe(true);
    expect(usuarioOnlinePeloHeartbeat("2026-10-26T11:58:59.999Z", agora)).toBe(false);
    expect(usuarioOnlinePeloHeartbeat("timestamp inválido", agora)).toBe(false);
    expect(usuarioOnlinePeloHeartbeat("2026-10-26T12:00:01.000Z", agora)).toBe(false);
  });

  it("preserva o restante da configuração de visibilidade do pipeline", () => {
    const raw = JSON.stringify({ setoresIds: [1], supervisores: [{ usuarioId: 9 }] });
    const salvo = gravarConfiguracaoDistribuicaoClosers(raw, config);
    expect(JSON.parse(salvo)).toMatchObject({ setoresIds: [1], supervisores: [{ usuarioId: 9 }] });
    expect(lerConfiguracaoDistribuicaoClosers(salvo)).toEqual(config);
  });
});
