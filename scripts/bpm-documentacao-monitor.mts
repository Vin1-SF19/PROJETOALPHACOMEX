import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { monitorarDocumentacaoEmAnalise } = await import("../src/lib/bpm/documentacao-analise-monitor");
const { default: db } = await import("../src/lib/prisma");

try { console.log(JSON.stringify(await monitorarDocumentacaoEmAnalise(), null, 2)); }
finally { await db.$disconnect(); }
