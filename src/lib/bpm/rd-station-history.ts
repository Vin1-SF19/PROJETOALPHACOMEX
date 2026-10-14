import { createHash } from "node:crypto";

type RecordLike = Record<string, unknown>;

function asRecord(value: unknown): RecordLike {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordLike : {};
}

function serialize(value: unknown) { return JSON.stringify(value ?? null); }
function digest(value: string) { return createHash("sha256").update(value).digest("hex").slice(0, 24); }

export interface EventoHistoricoRd {
  sourceKey: string;
  sourceEventId: string | null;
  eventType: string;
  occurredAt: string | null;
  raw: RecordLike;
  projection: RecordLike;
}

export function corrigirProjecaoHistoricoRd(original: Record<string, unknown>, changes: { title: string; content: string; date: string }): Record<string, unknown> {
  return { ...original, ...changes };
}

/** Projeta atividades e movimentos RD sem descartar o payload original ou inventar datas. */
export function projetarEventosHistoricoRd(
  detailInput: unknown,
  activitiesInput: unknown[],
  stageNames: Map<string, string>,
): EventoHistoricoRd[] {
  const detail = asRecord(detailInput);
  const histories = Array.isArray(detail.deal_stage_histories) ? detail.deal_stage_histories : [];
  const events: EventoHistoricoRd[] = histories.map((value, index) => {
    const history = asRecord(value);
    const stageId = String(history.deal_stage_id ?? history.stage_id ?? "");
    const sourceId = history.id ?? history._id;
    const stageName = stageNames.get(stageId) ?? null;
    return {
      sourceKey: sourceId ? `stage:${String(sourceId)}` : `stage:${digest(serialize(history))}:${index}`,
      sourceEventId: sourceId == null ? null : String(sourceId),
      eventType: "DEAL_STAGE_HISTORY",
      occurredAt: typeof history.start_date === "string" ? history.start_date : null,
      raw: history,
      projection: { title: stageName ?? "Mudança de etapa RD", content: null, date: history.start_date ?? null, sourceStageId: stageId, sourceStageName: stageName, startDate: history.start_date ?? null, endDate: history.end_date ?? null },
    };
  });
  for (const [index, value] of activitiesInput.entries()) {
    const activity = asRecord(value);
    const sourceId = activity.id ?? activity._id;
    const occurredAt = activity.date ?? activity.created_at ?? activity.updated_at ?? activity.done_at;
    const rawType = activity.type ?? activity.activity_type ?? (typeof activity.text === "string" ? "NOTE" : "UNKNOWN");
    events.push({
      sourceKey: sourceId ? `activity:${String(sourceId)}` : `activity:${digest(serialize(activity))}:${index}`,
      sourceEventId: sourceId == null ? null : String(sourceId),
      eventType: `ACTIVITY_${String(rawType).toUpperCase().slice(0, 100)}`,
      occurredAt: typeof occurredAt === "string" ? occurredAt : null,
      raw: activity,
      projection: {
        title: activity.subject ?? activity.title ?? null,
        content: activity.text ?? activity.content ?? activity.description ?? null,
        date: occurredAt ?? null,
        type: rawType === "NOTE" ? "ANOTACAO" : rawType,
      },
    });
  }
  return events.sort((a, b) => String(a.occurredAt ?? "\uffff").localeCompare(String(b.occurredAt ?? "\uffff")) || a.sourceKey.localeCompare(b.sourceKey));
}
