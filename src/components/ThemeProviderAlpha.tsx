"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { getTema } from "@/lib/temas";

export function ThemeProviderAlpha({ children, configIncial }: { children: React.ReactNode; configIncial?: { tema?: string | null } }) {
  const { data: session } = useSession();

  useEffect(() => {
    
    const temaLocal = localStorage.getItem("alpha-theme-temp");
    const userObj = session?.user;
    const temaNome = temaLocal || userObj?.tema_interface || configIncial?.tema || "blue";
    
    const estilo = getTema(temaNome);
    const rgb = estilo.accent || "59, 130, 246";
    
    document.documentElement.style.setProperty("--alpha-primary", rgb);

    if (userObj?.tema_interface === temaLocal) {
      localStorage.removeItem("alpha-theme-temp");
    }
  }, [session, configIncial]);

  return <>{children}</>;
}
