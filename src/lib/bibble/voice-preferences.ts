export interface BibbleVoicePreferences {
  replyToAudio: boolean;
  showButton: boolean;
  autoPlayAll: boolean;
}

export const DEFAULT_BIBBLE_VOICE_PREFERENCES: BibbleVoicePreferences = {
  replyToAudio: true,
  showButton: true,
  autoPlayAll: false,
};

export function bibbleVoicePreferencesKey(userId: number): string {
  return `bibble-voice-preferences:${userId}`;
}

export function readBibbleVoicePreferences(
  storage: Pick<Storage, "getItem">,
  userId: number,
): BibbleVoicePreferences {
  try {
    const raw = storage.getItem(bibbleVoicePreferencesKey(userId));
    if (!raw) return { ...DEFAULT_BIBBLE_VOICE_PREFERENCES };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { ...DEFAULT_BIBBLE_VOICE_PREFERENCES };
    const candidate = value as Partial<BibbleVoicePreferences>;
    return {
      replyToAudio: typeof candidate.replyToAudio === "boolean" ? candidate.replyToAudio : true,
      showButton: typeof candidate.showButton === "boolean" ? candidate.showButton : true,
      autoPlayAll: typeof candidate.autoPlayAll === "boolean" ? candidate.autoPlayAll : false,
    };
  } catch {
    return { ...DEFAULT_BIBBLE_VOICE_PREFERENCES };
  }
}

export function shouldAutoPlayBibbleVoice(
  inputWasAudio: boolean,
  preferences: BibbleVoicePreferences,
): boolean {
  return preferences.autoPlayAll || (inputWasAudio && preferences.replyToAudio);
}
