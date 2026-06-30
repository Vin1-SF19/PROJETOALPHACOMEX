import { NextRequest, NextResponse } from "next/server";
import {
  listConnectorIndexingStatus,
  listCredentials,
  listDocumentSets,
  createConnector,
  createCredential,
  linkConnectorCredential,
  runConnectorOnce,
  setGoogleServiceAccountKey,
  createGoogleServiceAccountCredential,
  OnyxError,
  type CreateConnectorInput,
  type CreateCredentialInput,
  type GoogleSource,
} from "@/lib/onyx/client";
import { authorizeConnectors } from "@/lib/onyx/connectors-guard";

export const dynamic = "force-dynamic";

function fail(err: unknown) {
  const status = err instanceof OnyxError ? err.status : 500;
  return NextResponse.json({ error: (err as Error).message }, { status });
}

// GET /api/onyx/connectors
// Carrega tudo que a tela precisa: estado de indexação (agrupado por fonte),
// credenciais e document sets.
export async function GET() {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  try {
    const [groups, credentials, documentSets] = await Promise.all([
      listConnectorIndexingStatus(),
      listCredentials(),
      listDocumentSets(),
    ]);
    return NextResponse.json({ groups, credentials, documentSets });
  } catch (err) {
    return fail(err);
  }
}

interface CreateBody {
  /** Nome de exibição da fonte (CC-pair). */
  name: string;
  source: string; // "file" | "web" | "qnap_qts" | ...
  input_type: string; // "load_state" | "poll" | ...
  connector_specific_config: Record<string, unknown>;
  /** Credencial: usa uma existente (id) ou cria uma nova com credential_json. */
  credential_id?: number;
  credential_json?: Record<string, unknown>;
  refresh_freq?: number | null;
  prune_freq?: number | null;
  /** Dispara indexação imediatamente após criar. */
  run_now?: boolean;
}

/** Fontes Google que usam o fluxo de conta de serviço dedicado. */
const GOOGLE_SOURCE_MAP: Record<string, GoogleSource> = {
  gmail: "gmail",
  google_drive: "google-drive",
};

// POST /api/onyx/connectors — cria uma fonte completa:
// credencial → connector → vínculo (CC-pair) → run-once opcional.
export async function POST(req: NextRequest) {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.name || !body.source || !body.input_type || !body.connector_specific_config) {
    return NextResponse.json(
      { error: "name, source, input_type e connector_specific_config são obrigatórios." },
      { status: 400 },
    );
  }

  try {
    // 1) Credencial: reusa a informada, usa o fluxo Google dedicado, ou cria genérica.
    let credentialId = body.credential_id;
    const googleSource = GOOGLE_SOURCE_MAP[body.source];

    if (credentialId == null && googleSource) {
      // Gmail / Google Drive: NÃO usam /manage/credential. São 2 passos próprios:
      // (a) guarda o JSON da conta de serviço; (b) cria a credencial com o admin.
      const cj = body.credential_json ?? {};
      const rawKey = cj.google_service_account_key_json;
      const primaryAdmin = cj.google_primary_admin;

      if (typeof rawKey !== "string" || !rawKey.trim()) {
        return NextResponse.json({ error: "Envie o arquivo .json da conta de serviço." }, { status: 400 });
      }
      if (typeof primaryAdmin !== "string" || !primaryAdmin.trim()) {
        return NextResponse.json({ error: "Informe o e-mail do administrador do Workspace." }, { status: 400 });
      }

      let serviceAccountKey: Record<string, unknown>;
      try {
        serviceAccountKey = JSON.parse(rawKey);
      } catch {
        return NextResponse.json({ error: "O arquivo .json da conta de serviço é inválido." }, { status: 400 });
      }
      if (serviceAccountKey.type !== "service_account") {
        return NextResponse.json(
          { error: "O JSON enviado não é de uma conta de serviço (campo type deve ser 'service_account')." },
          { status: 400 },
        );
      }

      await setGoogleServiceAccountKey(googleSource, serviceAccountKey);
      credentialId = await createGoogleServiceAccountCredential(googleSource, primaryAdmin.trim());
    } else if (credentialId == null) {
      const credInput: CreateCredentialInput = {
        name: body.name,
        source: body.source,
        credential_json: body.credential_json ?? {},
      };
      const cred = await createCredential(credInput);
      credentialId = cred.id;
    }

    // 2) Connector (definição da fonte).
    const connInput: CreateConnectorInput = {
      name: body.name,
      source: body.source,
      input_type: body.input_type,
      connector_specific_config: body.connector_specific_config,
      refresh_freq: body.refresh_freq ?? null,
      prune_freq: body.prune_freq ?? null,
    };
    const connector = await createConnector(connInput);

    // 3) Vínculo connector + credential = CC-pair.
    await linkConnectorCredential(connector.id, credentialId, body.name);

    // 4) Indexa agora, se pedido.
    if (body.run_now) {
      await runConnectorOnce(connector.id, [credentialId], true);
    }

    return NextResponse.json({ success: true, connectorId: connector.id, credentialId });
  } catch (err) {
    return fail(err);
  }
}
