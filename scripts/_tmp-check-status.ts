import db from '../src/lib/prisma';

(async () => {
  const obj = await db.roadmapObjective.findUnique({
    where: { code: 'RM-2026-C02779' },
    select: { id: true, status: true, sourceVersion: true },
  });
  console.log('objective:', JSON.stringify(obj, null, 2));

  const artifacts = await db.roadmapPromptArtifact.findMany({
    where: { objectiveId: obj!.id, documentationVersion: obj!.sourceVersion, status: 'PUBLISHED' },
    select: { phaseNumber: true },
    orderBy: { phaseNumber: 'desc' },
  });
  console.log('published artifacts (desc):', JSON.stringify(artifacts, null, 2));
  process.exit(0);
})();
