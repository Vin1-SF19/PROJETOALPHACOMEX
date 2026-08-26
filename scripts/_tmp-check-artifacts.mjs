import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql/web";

const tursoUrl = (process.env.TURSO_DATABASE_URL ?? "").replace(/^libsql:\/\//, "https://");
const adapter = new PrismaLibSql({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });
const db = new PrismaClient({ adapter });

const artifacts = await db.roadmapPromptArtifact.findMany({
  where: { objectiveId: "cmtab2s28000004ktxn23z0lf", documentationVersion: 2, status: "PUBLISHED" },
  select: { phaseNumber: true, title: true },
  orderBy: { phaseNumber: "asc" },
});
console.log(JSON.stringify(artifacts, null, 2));

await db.$disconnect();
