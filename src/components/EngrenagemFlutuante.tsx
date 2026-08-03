"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Megaphone, Activity, EyeOff, ChevronLeft, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getTema } from "@/lib/temas";
import { ModalBroadcast } from "./ModalBroadcast";
import { isAdminRole } from "@/lib/roles";

export function EngrenagemFlutuante() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [posicaoIncial, setPosicaoInicial] = useState({ x: 0, y: 0 });
  const constraintRef = useRef(null);

  useEffect(() => {
    setPosicaoInicial({ 
      x: window.innerWidth - 100, 
      y: window.innerHeight - 120 
    });
    setMontado(true);
  }, []);

  if (!isAdminRole(session?.user?.role) || !montado) return null;

  const style = getTema((session?.user as any)?.tema_interface || "blue");

  return (
    <>
      <div ref={constraintRef} className="fixed inset-0 pointer-events-none z-[9998]" />

      <motion.div
        drag
        dragConstraints={constraintRef}
        dragElastic={0.1}
        dragMomentum={false}
        initial={posicaoIncial}
        className="fixed z-[9999] pointer-events-auto"
      >
        <div className="relative flex items-center">
          <motion.button
            onClick={() => oculto ? setOculto(false) : setShowMenu(!showMenu)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`
              flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all duration-500 border
              ${oculto 
                ? `w-3 h-20 ${style.bg.replace('600', '500/20')} ${style.border.replace('20', '40')} rounded-l-2xl translate-x-6` 
                : `w-14 h-14 bg-slate-950/80 ${style.border.replace('20', '40')} rounded-[1.4rem]`
              }
            `}
          >
            {oculto ? (
              <div className="flex flex-col items-center gap-2">
                <div className={`w-1.5 h-1.5 ${style.bg} rounded-full animate-pulse`} />
                <ChevronLeft size={12} className={style.text} />
              </div>
            ) : (
              <Settings 
                size={26} 
                className={`${style.text} ${showMenu ? 'rotate-90' : 'animate-[spin_12s_linear_infinite]'} transition-transform duration-500`} 
              />
            )}
          </motion.button>

          <AnimatePresence>
            {showMenu && !oculto && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: -15, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                className="absolute right-full mr-4 w-60 bg-slate-950/95 border border-white/10 backdrop-blur-2xl p-3 rounded-[2.2rem] shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-1"
              >
                <div className="px-4 py-2 border-b border-white/5 mb-1">
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-500">Comando Admin</p>
                </div>

                <button 
                  onClick={() => { setIsBroadcastOpen(true); setShowMenu(false); }}
                  className="flex items-center gap-3 p-4 rounded-2xl hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all group"
                >
                  <Megaphone size={18} className={style.text} /> 
                  Broadcast
                </button>

                <button 
                  onClick={() => { router.push("/PainelAlpha/UsuariosOnline"); setShowMenu(false); }}
                  className="flex items-center gap-3 p-4 rounded-2xl hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all group"
                >
                  <Activity size={18} className="text-emerald-500" /> 
                  Agentes
                </button>

                <div className="h-px bg-white/5 my-1" />

                {/* 
                 <button 
                  onClick={() => { setOculto(true); setShowMenu(false); }}
                  className="flex items-center gap-3 p-4 rounded-2xl hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-amber-500 transition-all group"
                >
                  <EyeOff size={18} className="group-hover:animate-pulse" /> 
                  Ocultar
                </button>
                */}

                <button 
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-3 p-4 rounded-2xl hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-500 transition-all group"
                >
                  <X size={18} /> 
                  Fechar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <ModalBroadcast 
        isOpen={isBroadcastOpen} 
        onClose={() => setIsBroadcastOpen(false)} 
        style={style} 
      />
    </>
  );
}
