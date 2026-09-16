export type BibbleAudioState = "idle" | "loading" | "ready" | "playing" | "paused" | "error";

interface ManagedAudio {
  currentTime: number;
  pause(): void;
  play(): Promise<void>;
  onended: ((event: Event) => void) | null;
  onerror: ((event: Event | string) => void) | null;
}

type AudioFactory = (url: string) => ManagedAudio;
type StateListener = (state: BibbleAudioState) => void;

export interface BibbleAudioManager {
  play(ownerId: string, blob: Blob, listener: StateListener): Promise<boolean>;
  pause(ownerId: string): boolean;
  resume(ownerId: string): Promise<boolean>;
  stop(ownerId?: string): void;
}

export function createBibbleAudioManager(
  createAudio: AudioFactory,
  urls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">,
): BibbleAudioManager {
  let active: { ownerId: string; audio: ManagedAudio; url: string; listener: StateListener } | null = null;

  const clear = (state: BibbleAudioState, resetTime: boolean) => {
    if (!active) return;
    const current = active;
    current.audio.pause();
    if (resetTime) current.audio.currentTime = 0;
    current.audio.onended = null;
    current.audio.onerror = null;
    urls.revokeObjectURL(current.url);
    active = null;
    current.listener(state);
  };

  return {
    async play(ownerId, blob, listener) {
      if (active) clear("ready", true);
      const url = urls.createObjectURL(blob);
      const audio = createAudio(url);
      active = { ownerId, audio, url, listener };
      audio.onended = () => clear("ready", true);
      audio.onerror = () => clear("error", true);
      try {
        await audio.play();
        if (active?.ownerId === ownerId) listener("playing");
        return true;
      } catch {
        if (active?.ownerId === ownerId) listener("ready");
        return false;
      }
    },
    pause(ownerId) {
      if (active?.ownerId !== ownerId) return false;
      active.audio.pause();
      active.listener("paused");
      return true;
    },
    async resume(ownerId) {
      if (active?.ownerId !== ownerId) return false;
      try {
        await active.audio.play();
        if (active?.ownerId === ownerId) active.listener("playing");
        return true;
      } catch {
        if (active?.ownerId === ownerId) active.listener("ready");
        return false;
      }
    },
    stop(ownerId) {
      if (active && (!ownerId || active.ownerId === ownerId)) clear("idle", true);
    },
  };
}

export const bibbleAudioManager: BibbleAudioManager = createBibbleAudioManager(
  url => new Audio(url),
  URL,
);
