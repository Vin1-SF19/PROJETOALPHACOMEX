"use client";

import { UserIcon } from "lucide-react";

type UserProps = {
  user?: {
    nome?: string;
    usuario?: string;
    email?: string | null;
    role?: string;
  };
};

export default function HeaderUser({ user }: UserProps) {
    return (
    <div className="lg:flex lg:items-center lg:justify-between m-5 border border-blue-900/50 p-6 rounded-2xl bg-slate-900/30">
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-bold text-white sm:text-4xl tracking-tight">
          Gerenciamento de Usuários
        </h2>

        <div className="mt-2 flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <UserIcon className="text-white" size={20} />
          </div>

          <span className="text-blue-700 font-black text-lg">
            {user?.usuario}
          </span>
        </div>

      </div>

    </div>
  );
}
