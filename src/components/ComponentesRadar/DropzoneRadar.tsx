"use client";
import { useState, useCallback } from "react";
import { UploadCloud, FileSpreadsheet, AlertCircle, X } from "lucide-react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";
import type { TemaAlpha } from "@/lib/temas";

interface DropzoneProps {
  onFileLoaded: (dados: Record<string, unknown>[]) => void;
  visual: TemaAlpha;
}

export default function DropzoneRadar({ onFileLoaded, visual }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcessFile = useCallback((file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls") && !file.name.endsWith(".csv")) {
      setError("Formato inválido. Use .xlsx, .xls ou .csv");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

        if (jsonData.length === 0) {
          setError("A planilha está vazia.");
          return;
        }

        onFileLoaded(jsonData);
      } catch (err) {
        setError("Erro ao ler o arquivo. Verifique se não está corrompido.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [onFileLoaded]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragActive(false);
          const file = e.dataTransfer.files[0];
          if (file) handleProcessFile(file);
        }}
        className={`relative group cursor-pointer border-2 border-dashed rounded-[3rem] p-12 transition-all duration-500 overflow-hidden
          ${isDragActive ? `${visual.border} bg-white/10` : "border-white/5 bg-white/5 hover:border-white/20"}`}
      >
        {/* Glow animado no fundo */}
        <div className={`absolute -bottom-24 -left-24 w-64 h-64 ${visual.glow} blur-[100px] rounded-full opacity-20 group-hover:opacity-40 transition-opacity`} />

        <input
          type="file"
          id="dropzone-file"
          className="hidden"
          accept=".xlsx, .xls, .csv"
          onChange={(e) => e.target.files?.[0] && handleProcessFile(e.target.files[0])}
        />

        <label htmlFor="dropzone-file" className="relative z-10 flex flex-col items-center cursor-pointer">
          <div className={`p-6 rounded-[2rem] ${visual.bg} ${visual.shadow} mb-6 group-hover:scale-110 transition-transform duration-500`}>
            <UploadCloud className="text-white w-10 h-10" />
          </div>

          <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">
            Importação <span className={visual.text}>Alpha em Lote</span>
          </h3>
          
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mb-8">
            Arraste sua planilha ou clique para explorar
          </p>

          <div className="flex gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/5 rounded-xl">
              <FileSpreadsheet size={14} className="text-emerald-500" />
              <span className="text-[9px] font-bold text-slate-400 uppercase italic">Suporta XLSX / CSV</span>
            </div>
          </div>
        </label>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-3 text-rose-400"
            >
              <div className="flex items-center gap-3">
                <AlertCircle size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="p-1 hover:bg-white/10 rounded-lg">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
