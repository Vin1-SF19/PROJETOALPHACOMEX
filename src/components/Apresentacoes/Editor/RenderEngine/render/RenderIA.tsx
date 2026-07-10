import type { ChatIlustrativoComponente } from "@/lib/validations/slide-componentes";

export function RenderChatIlustrativo({ componente }: { componente: ChatIlustrativoComponente }) {
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-auto rounded-xl bg-slate-900/60 p-3">
      {componente.mensagens.map((msg, i) => (
        <div key={i} className={`flex ${msg.autor === "usuario" ? "justify-end" : "justify-start"}`}>
          <span
            className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs ${
              msg.autor === "usuario" ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-100"
            }`}
          >
            {msg.texto}
          </span>
        </div>
      ))}
    </div>
  );
}
