import {
  buildAdaptiveStylePrompt,
  classifyBehavioralStyle,
  normalizeAdaptivePreferences,
  type AdaptiveTonePreferences,
  type BehavioralProfile,
  type BehavioralSample,
} from "@/lib/bibble/adaptive-style";
import { loadBehavioralHistory } from "@/lib/bibble/behavioral-memory";

type AdaptiveStyleDependencies = {
  loadHistory: (userId: number) => Promise<BehavioralSample[]>;
  classify: (history: BehavioralSample[], currentMessage: string) => BehavioralProfile;
};

export async function deriveAdaptiveStyleForTurn(
  userId: number,
  message: string,
  inputPreferences: AdaptiveTonePreferences | undefined,
  dependencies: AdaptiveStyleDependencies = {
    loadHistory: loadBehavioralHistory,
    classify: classifyBehavioralStyle,
  },
): Promise<{
  adaptiveStyle: string | null;
  telemetry: { ms: number; sampleCount: number; applied: boolean };
}> {
  const startedAt = Date.now();
  const preferences = normalizeAdaptivePreferences(inputPreferences);
  try {
    const history = await dependencies.loadHistory(userId);
    const profile = dependencies.classify(history, message);
    return {
      adaptiveStyle: buildAdaptiveStylePrompt(profile, preferences, message),
      telemetry: {
        ms: Date.now() - startedAt,
        sampleCount: profile.sampleSize,
        applied: preferences.adaptiveTone,
      },
    };
  } catch {
    return {
      adaptiveStyle: null,
      telemetry: { ms: Date.now() - startedAt, sampleCount: 0, applied: false },
    };
  }
}
