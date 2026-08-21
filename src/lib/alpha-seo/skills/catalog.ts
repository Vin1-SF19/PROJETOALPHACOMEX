import { ALPHA_SEO_SKILL_ASSETS } from "./assets";

export const ALPHA_SEO_SKILLS = [
  {
    name: "competitive-landscape",
    description:
      "Mapeia líderes de SEO, conteúdo, palavras-chave, backlinks e lacunas estratégicas.",
  },
  {
    name: "competitor-analysis",
    description:
      "Analisa profundamente o footprint orgânico, conteúdo e backlinks de um concorrente.",
  },
  {
    name: "keyword-clustering",
    description:
      "Agrupa palavras-chave por intenção e as mapeia para páginas existentes ou propostas.",
  },
  {
    name: "keyword-research",
    description:
      "Descobre oportunidades, avalia métricas e SERPs e salva termos promissores.",
  },
  {
    name: "link-prospecting",
    description: "Encontra prospects de links, contatos e sinais de backlinks.",
  },
  {
    name: "local-seo",
    description:
      "Audita Google Business Profile, concorrentes locais e visibilidade no Maps.",
  },
  {
    name: "seo-audit",
    description:
      "Audita um site e entrega relatório simples centrado numa ação prioritária.",
  },
  {
    name: "seo-coach",
    description: "Explica workflows e recomenda próximos passos de SEO.",
  },
  {
    name: "seo-project-setup",
    description:
      "Configura contexto compartilhado, escopo, metas, concorrentes e páginas-chave.",
  },
] as const;
export function discoverAlphaSeoSkills(query = "") {
  const q = query.trim().toLowerCase();
  return ALPHA_SEO_SKILLS.filter(
    (s) => !q || `${s.name} ${s.description}`.toLowerCase().includes(q),
  ).map((skill) => ({
    ...skill,
    resourceNames: Object.keys(ALPHA_SEO_SKILL_ASSETS[skill.name].resources),
  }));
}

export type AlphaSeoSkillName = keyof typeof ALPHA_SEO_SKILL_ASSETS;

export function getAlphaSeoSkill(name: string) {
  if (!Object.prototype.hasOwnProperty.call(ALPHA_SEO_SKILL_ASSETS, name)) {
    throw new Error("ALPHA_SEO_SKILL_NOT_FOUND");
  }
  const skillName = name as AlphaSeoSkillName;
  const metadata = ALPHA_SEO_SKILLS.find((item) => item.name === skillName);
  if (!metadata) throw new Error("ALPHA_SEO_SKILL_NOT_FOUND");
  return { ...metadata, ...ALPHA_SEO_SKILL_ASSETS[skillName] };
}
