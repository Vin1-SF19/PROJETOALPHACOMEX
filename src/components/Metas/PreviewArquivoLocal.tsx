"use client";

import { useEffect, useState } from "react";

interface PreviewArquivoLocalProps {
    arquivo: File;
}

export function PreviewArquivoLocal({ arquivo }: PreviewArquivoLocalProps) {
    const [urlLocal, setUrlLocal] = useState<string | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(arquivo);
        setUrlLocal(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [arquivo]);

    if (!urlLocal) return null;

    return (
        <iframe
            src={urlLocal}
            className="h-[220px] w-full rounded-2xl border border-white/5 bg-white"
            title="Prévia do arquivo selecionado"
        />
    );
}
