// CLI de diagnóstico do Calendário Alpha — CLI First (Constituição AIOX).
// Nunca imprime valor de segredo, só presença/formato.
// Uso: node --no-warnings scripts/calendar-alpha-doctor.mjs
import { config } from "dotenv";

// Mesma ordem de precedência do Next.js: .env primeiro, .env.local por cima (override).
config({ path: ".env" });
config({ path: ".env.local", override: true });

const VARIAVEIS_OBRIGATORIAS = [
  "GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY",
];

function verificarEmailServiceAccount() {
  const valor = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL;
  if (!valor) return { ok: false, motivo: "ausente" };
  if (!/^[^@]+@[^@]+\.iam\.gserviceaccount\.com$/.test(valor)) {
    return { ok: false, motivo: "não parece um e-mail de Service Account (esperado *.iam.gserviceaccount.com)" };
  }
  return { ok: true };
}

function verificarChavePrivada() {
  const valor = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!valor) return { ok: false, motivo: "ausente" };
  const decodificada = valor.replace(/\\n/g, "\n");
  if (!decodificada.includes("BEGIN PRIVATE KEY")) {
    return { ok: false, motivo: "não parece uma chave PEM válida (falta 'BEGIN PRIVATE KEY')" };
  }
  return { ok: true };
}

function main() {
  console.log("Calendário Alpha — doctor (Domain-Wide Delegation)\n");

  let algumaFalha = false;

  for (const nomeVar of VARIAVEIS_OBRIGATORIAS) {
    const presente = Boolean(process.env[nomeVar]);
    console.log(`  [${presente ? "OK" : "FALTA"}] ${nomeVar}`);
    if (!presente) algumaFalha = true;
  }

  const email = verificarEmailServiceAccount();
  console.log(`  [${email.ok ? "OK" : "FALTA"}] GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL formato${email.ok ? "" : ` — ${email.motivo}`}`);
  if (!email.ok) algumaFalha = true;

  const chave = verificarChavePrivada();
  console.log(`  [${chave.ok ? "OK" : "FALTA"}] GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY formato${chave.ok ? "" : ` — ${chave.motivo}`}`);
  if (!chave.ok) algumaFalha = true;

  console.log("");
  if (algumaFalha) {
    console.log("Diagnóstico: configuração incompleta. Corrija os itens marcados FALTA acima.");
    console.log("Lembrete: além das env vars, o Client ID desta Service Account precisa estar autorizado");
    console.log("no Admin Console do Google Workspace (Security > API Controls > Domain-wide Delegation),");
    console.log("com os escopos de src/lib/google-calendar/scopes.ts — sem isso, a chamada real falha mesmo com env OK.");
    process.exitCode = 1;
  } else {
    console.log("Diagnóstico: configuração de ambiente OK (nenhum valor de segredo foi impresso).");
    console.log("Confirme também no Admin Console do Workspace que o Client ID da Service Account está autorizado.");
  }
}

main();
