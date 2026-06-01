"use client";

import { motion } from "framer-motion";

export default function ChecklistBackground({ accentRgb }: { accentRgb: string }) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">

      {/* Imagem de fundo */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/fundograde.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.18,
        }}
      />

      {/* Overlay escuro */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(2,6,23,0.72)" }}
      />

      {/* Aurora blob 1 — topo esquerdo */}
      <motion.div
        animate={{ x: [-40, 60, -40], y: [-20, 50, -20] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute"
        style={{
          width: "70vw",
          height: "70vh",
          top: "-15%",
          left: "-10%",
          background: `radial-gradient(circle, rgba(${accentRgb}, 0.1) 0%, transparent 70%)`,
          borderRadius: "50%",
        }}
      />

      {/* Aurora blob 2 — inferior direito */}
      <motion.div
        animate={{ x: [30, -60, 30], y: [30, -40, 30] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        className="absolute"
        style={{
          width: "55vw",
          height: "55vh",
          bottom: "-10%",
          right: "-8%",
          background: `radial-gradient(circle, rgba(${accentRgb}, 0.07) 0%, transparent 70%)`,
          borderRadius: "50%",
        }}
      />
    </div>
  );
}
