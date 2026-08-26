-- Roadmap Objective: adiciona developmentAssignee (aditivo, ADD COLUMN com
-- default). Substitui a preferência antiga por objetivo que vivia em
-- objective-development-providers.json (motor removido) e remove a opção
-- "ollama"/"qwen" do domínio de valores possíveis (não há mais motor local).
ALTER TABLE "RoadmapObjective" ADD COLUMN "developmentAssignee" TEXT NOT NULL DEFAULT 'claude';
