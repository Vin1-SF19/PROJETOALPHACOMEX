import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const baseUrl = process.env.BPM_NOVOS_LEADS_JOB_URL ?? "http://localhost:3000";
const segredo = process.env.CRON_SECRET;

if (!segredo) {
  console.error(JSON.stringify({ success: false, error: "CRON_SECRET não configurado." }));
  process.exitCode = 2;
} else {
  try {
    const resposta = await fetch(
      new URL("/api/bpm/jobs/automacao-novos-leads", baseUrl),
      { headers: { authorization: `Bearer ${segredo}` } },
    );
    const payload = await resposta.json();
    console.info(JSON.stringify(payload));
    if (!resposta.ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Falha ao chamar o job.",
    }));
    process.exitCode = 1;
  }
}

