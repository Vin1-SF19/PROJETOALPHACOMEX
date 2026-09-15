"use client";

interface Suggestion {
  emoji: string;
  label: string;
  prompt: string;
  permission?: string | string[];
  kind?: "consultar" | "analisar" | "criar";
}

const SUGGESTIONS: Suggestion[] = [
  {
    emoji: "📊",
    label: "Gerar ficha de reunião",
    prompt: "Gere a ficha de reunião para o CNPJ ",
    permission: "analise", kind: "criar",
  },
  {
    emoji: "🔍",
    label: "Buscar empresa por CNPJ",
    prompt: "Consulte os dados da empresa com CNPJ ",
    permission: ["analise", "radar"], kind: "consultar",
  },
  {
    emoji: "📋",
    label: "Ver consultas recentes",
    prompt: "Mostre as últimas consultas de pré-análise realizadas.",
    permission: "analise", kind: "consultar",
  },
  {
    emoji: "👥",
    label: "Buscar cliente",
    prompt: "Busque as informações do cliente ",
    permission: "Cliente", kind: "consultar",
  },
];

export default function BibblePromptSuggestions({
  onSelect,
  activeAgentName,
  permissions = [],
  isAdmin = false,
}: {
  onSelect: (prompt: string) => void;
  activeAgentName?: string | null;
  permissions?: string[];
  isAdmin?: boolean;
}) {
  const suggestions = activeAgentName ? [
    { emoji: "🧠", label: `Conhecer ${activeAgentName}`, prompt: "Apresente suas especialidades e limites de forma objetiva." },
    { emoji: "📋", label: "Analisar um caso", prompt: "Analise este caso dentro da sua especialidade: " },
  ] : SUGGESTIONS.filter(item => !item.permission || isAdmin || (Array.isArray(item.permission) ? item.permission.some(permission => permissions.includes(permission)) : permissions.includes(item.permission)));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 w-full">
      {suggestions.map(s => (
        <button
          key={s.label}
          onClick={() => onSelect(s.prompt)}
          className="group flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150"
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(30, 64, 175, 0.18)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(99, 102, 241, 0.4)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(99,102,241,0.12)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "#1e293b";
            (e.currentTarget as HTMLElement).style.borderColor = "#334155";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <span className="text-base shrink-0">{s.emoji}</span>
          <span
            className="text-[12px] font-medium leading-tight"
            style={{ color: "#94a3b8" }}
          >
            {s.label}
          </span>
          {s.kind && <span className="ml-auto text-[9px] uppercase tracking-wide text-slate-500">{s.kind}</span>}
        </button>
      ))}
    </div>
  );
}
