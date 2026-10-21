import { config } from "dotenv";
import { createHash } from "node:crypto";
import { isSameRole } from "../src/lib/roles";
import { SETOR_LIDER_OPERACIONAL } from "../src/lib/setores-catalogo";

// Cadastro pontual solicitado; nunca executado no build, em leituras ou no deploy.
const modo = process.argv[2];
const argumento = (nome: string) => process.argv.find((arg) => arg.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const ambiente = argumento("ambiente");
const arquivo = argumento("env");
if (!["preview", "aplicar"].includes(modo) || !["staging", "producao"].includes(ambiente ?? "") || !arquivo) {
  throw new Error("Use preview|aplicar --ambiente=staging|producao --env=arquivo explícito.");
}
const carregado = config({ path: arquivo, override: true, quiet: true });
if (carregado.error || !carregado.parsed?.TURSO_DATABASE_URL || !carregado.parsed?.TURSO_AUTH_TOKEN) {
  throw new Error("Arquivo explícito não contém a configuração completa do banco.");
}
Object.assign(process.env, { NODE_ENV: "production" });
const { default: db } = await import("../src/lib/prisma");
const { cadastrarSetor } = await import("../src/lib/setores/cadastro");
const bancoHash = createHash("sha256").update(carregado.parsed.TURSO_DATABASE_URL).digest("hex");

async function consultar() {
  return (await db.setor.findMany({ select: { id: true, nome: true, ativo: true, protegido: true, isBase: true } }))
    .filter((setor) => isSameRole(setor.nome, SETOR_LIDER_OPERACIONAL));
}
try {
  const antes = await consultar();
  if (antes.length > 1) throw new Error("Catálogo ambíguo; nenhum registro será alterado.");
  if (modo === "preview" || antes.length === 1) {
    console.info(JSON.stringify({ ambiente, bancoHash, modo, criado: false, setores: antes }));
  } else {
    if (argumento("banco-hash") !== bancoHash) throw new Error("Informe o banco-hash conferido no preview antes do cadastro.");
    const resultado = await cadastrarSetor(SETOR_LIDER_OPERACIONAL);
    const depois = await consultar();
    if (!resultado.success || depois.length !== 1 || !depois[0].ativo) {
      throw new Error("Cadastro não confirmado; consulte o catálogo antes de tentar novamente.");
    }
    console.info(JSON.stringify({ ambiente, bancoHash, modo, criado: true, setores: depois }));
  }
} finally {
  await db.$disconnect();
}
