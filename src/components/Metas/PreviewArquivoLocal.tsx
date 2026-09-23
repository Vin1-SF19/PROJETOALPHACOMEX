"use client";

import { useEffect, useRef } from "react";

interface PreviewArquivoLocalProps {
    arquivo: File;
}

export function PreviewArquivoLocal({ arquivo }: PreviewArquivoLocalProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const url = URL.createObjectURL(arquivo);
        if (iframeRef.current) iframeRef.current.src = url;

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [arquivo]);

    return (
        <iframe
            ref={iframeRef}
            className="h-[220px] w-full rounded-2xl border border-white/5 bg-white"
            title="Prévia do arquivo selecionado"
        />
    );
}
