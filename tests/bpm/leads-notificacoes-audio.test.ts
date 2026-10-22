import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arquivoAudioLeadBpm, criarAudioNotificacoesLeadsBpm } from "@/lib/bpm/notificacoes-leads-audio";

class AudioFalso extends EventTarget {
  volume = 1;
  currentTime = 0;
  readonly play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  readonly pause = vi.fn();
  readonly load = vi.fn();
  readonly removeAttribute = vi.fn((nome: string) => { if (nome === "src") this.src = ""; });
  constructor(public src: string) { super(); }
}

describe("áudio das notificações de leads", () => {
  let audios: AudioFalso[];
  let criar: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    audios = [];
    criar = vi.fn(function (src: string) {
      const audio = new AudioFalso(src);
      audios.push(audio);
      return audio;
    });
    vi.stubGlobal("Audio", criar);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("seleciona somente a origem canônica e mantém outras origens silenciosas", () => {
    expect(arquivoAudioLeadBpm("INSTAGRAM")).toBe("/sounds/notificacao-lead-insta.mp3");
    expect(arquivoAudioLeadBpm("SITE")).toBe("/sounds/notificacao-lead-site.mp3");
    expect(arquivoAudioLeadBpm("OUTRA")).toBeNull();
    const player = criarAudioNotificacoesLeadsBpm();
    expect(criar).not.toHaveBeenCalled();
    player.tocar("OUTRA");
    expect(criar).not.toHaveBeenCalled();
    player.tocar("INSTAGRAM");
    expect(criar).toHaveBeenCalledExactlyOnceWith("/sounds/notificacao-lead-insta.mp3");
    expect(audios[0].volume).toBe(0.6);
    expect(audios[0].play).toHaveBeenCalledOnce();
    player.limpar();
  });

  it("substitui o áudio ativo e eventos antigos não encerram a reprodução nova", () => {
    const player = criarAudioNotificacoesLeadsBpm();
    player.tocar("INSTAGRAM");
    const antigo = audios[0]; antigo.currentTime = 1;
    player.tocar("SITE");
    expect(antigo.pause).toHaveBeenCalledOnce();
    expect(antigo.currentTime).toBe(0);
    expect(antigo.src).toBe("");
    expect(antigo.load).toHaveBeenCalledOnce();
    expect(audios[1].src).toBe("/sounds/notificacao-lead-site.mp3");
    antigo.dispatchEvent(new Event("error")); antigo.dispatchEvent(new Event("ended"));
    expect(audios[1].pause).not.toHaveBeenCalled();
    player.tocar("OUTRA");
    expect(audios).toHaveLength(2);
    expect(audios[1].pause).not.toHaveBeenCalled();
    player.limpar();
    expect(audios[1].pause).toHaveBeenCalledOnce();
  });

  it.each(["ended", "error"])("libera a mídia em %s e torna o cleanup idempotente", (evento) => {
    const player = criarAudioNotificacoesLeadsBpm();
    player.tocar("SITE"); const audio = audios[0];
    audio.dispatchEvent(new Event(evento)); player.parar(); player.limpar();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.removeAttribute).toHaveBeenCalledExactlyOnceWith("src");
    player.tocar("INSTAGRAM");
    expect(audios).toHaveLength(1);
  });

  it("trata ausência de Audio e construção que lança sem quebrar o chamador", () => {
    const player = criarAudioNotificacoesLeadsBpm();
    vi.stubGlobal("Audio", undefined);
    expect(() => player.tocar("SITE")).not.toThrow();
    vi.stubGlobal("Audio", vi.fn(function () { throw new Error("API indisponível"); }));
    expect(() => player.tocar("SITE")).not.toThrow();
    player.limpar();
  });

  it.each(["sincrona", "rejeitada"])("trata falha %s de play sem retry", async (falha) => {
    criar.mockImplementationOnce(function (src: string) {
      const audio = new AudioFalso(src); audios.push(audio);
      if (falha === "sincrona") audio.play.mockImplementationOnce(() => { throw new Error("bloqueado"); });
      else audio.play.mockRejectedValueOnce(new Error("NotAllowedError"));
      return audio;
    });
    const player = criarAudioNotificacoesLeadsBpm();
    expect(() => player.tocar("INSTAGRAM")).not.toThrow();
    await Promise.resolve();
    expect(audios[0].pause).toHaveBeenCalledOnce();
    expect(audios[0].src).toBe("");
    expect(audios[0].play).toHaveBeenCalledOnce();
    player.limpar();
  });

  it("rejeição tardia não afeta outra reprodução", async () => {
    let rejeitar!: (erro: Error) => void;
    criar.mockImplementationOnce(function (src: string) {
      const audio = new AudioFalso(src); audios.push(audio);
      audio.play.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejeitar = reject; }));
      return audio;
    });
    const player = criarAudioNotificacoesLeadsBpm();
    player.tocar("INSTAGRAM"); player.tocar("SITE");
    rejeitar(new Error("rejeição tardia")); await Promise.resolve();
    expect(audios[1].pause).not.toHaveBeenCalled();
    player.limpar();
    player.tocar("INSTAGRAM");
    expect(audios).toHaveLength(2);
    expect(audios.every((audio) => audio.play.mock.calls.length === 1)).toBe(true);
  });

  it("resolução tardia após cleanup não reinicia áudio nem permite novas reproduções", async () => {
    let resolver!: () => void;
    criar.mockImplementationOnce(function (src: string) {
      const audio = new AudioFalso(src); audios.push(audio);
      audio.play.mockReturnValueOnce(new Promise<void>((resolve) => { resolver = resolve; }));
      return audio;
    });
    const player = criarAudioNotificacoesLeadsBpm();
    player.tocar("INSTAGRAM"); player.limpar();
    resolver(); await Promise.resolve();
    player.tocar("SITE");
    expect(audios).toHaveLength(1);
    expect(audios[0].pause).toHaveBeenCalledOnce();
    expect(audios[0].src).toBe("");
    expect(audios[0].play).toHaveBeenCalledOnce();
  });
});
