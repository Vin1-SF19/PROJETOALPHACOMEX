"use client";

import React, { useState, useMemo } from 'react';
import { Search, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

import TrilhaCarrossel from './TrilhaCarrossel';
import ModuloModal from './ModuloModal';

interface Modulo {
    id: string;
    nome: string;
    imagemUrl: string;
    descricao?: string;
    aprendizado?: string;
    bloqueado: boolean;
    requerModuloId?: string | null;
    percentualMinimo?: number;
    isLiberado: boolean;
    nomeAnterior?: string;
    ordemNoCurso?: number;
    setor?: string;
}

interface Curso {
    id: string;
    nome: string;
    descricao?: string | null;
    capa?: string | null;
    ordem: number;
    setores: string[];
    modulos: Modulo[];
}

interface Props {
    session: {
        user?: {
            id?: string;
            role?: string;
            name?: string;
        };
    } | null;
    initialCursos: Curso[];
    initialVideos: {
        id: string;
        titulo: string;
        url: string;
        thumbUrl?: string | null;
        modulo?: { id: string; nome: string }[];
    }[];
}

export default function AlphaSkillsClient({ session, initialCursos, initialVideos }: Props) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedModulo, setSelectedModulo] = useState<Modulo | null>(null);
    const [setorFiltro, setSetorFiltro] = useState("Todos");

    const isAdmin = session?.user?.role === "Admin" || session?.user?.role === "CEO";

    const setoresDisponiveis = useMemo(() => {
        const set = new Set<string>();
        initialCursos.forEach(c => c.setores.forEach(s => set.add(s)));
        return Array.from(set).sort();
    }, [initialCursos]);

    const cursosFiltrados = useMemo(() => {
        let filtered = initialCursos;

        if (setorFiltro !== "Todos") {
            filtered = filtered.filter(c => c.setores.includes(setorFiltro));
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                c.nome.toLowerCase().includes(q) ||
                c.modulos.some(m => m.nome.toLowerCase().includes(q))
            );
        }

        return filtered.map(curso => ({
            ...curso,
            modulos: curso.modulos.map((mod, i) => ({
                ...mod,
                imagemUrl: mod.imagemUrl || curso.capa || '',
                nomeExibicao: `Módulo ${i + 1}: `
            }))
        }));
    }, [initialCursos, setorFiltro, searchTerm]);

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-orange-500/30 overflow-x-hidden">

            <div className="fixed inset-0 flex items-center justify-center z-0 pointer-events-none overflow-hidden">
                <div className="absolute w-[800px] h-[800px] bg-orange-600/5 rounded-full blur-[120px]" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.10, scale: 1 }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="w-[90%] max-w-[800px]"
                >
                    <Image
                        src="/Logotipo-1.png"
                        width={800}
                        height={800}
                        className="object-contain filter brightness-200"
                        alt="Alpha Logo Background"
                    />
                </motion.div>
            </div>

            <section className="relative h-[50vh] md:h-[65vh] flex items-center px-6 md:px-16 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent z-10" />
                <div className="absolute inset-0 opacity-30">
                    <Image
                        src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070"
                        fill
                        className="object-cover scale-110 blur-sm"
                        alt="Background"
                        unoptimized
                    />
                </div>

                <div className="relative z-20 max-w-3xl">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-[0.85] mb-6 italic">
                            Alpha<br /><span className="text-orange-500">Skills</span>
                        </h1>
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="text"
                                    placeholder="O que quer aprender?"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                />
                            </div>
                            {isAdmin && (
                                <Link href="/PainelAlpha/AlphaSkills/Gerenciamento">
                                    <button className="cursor-pointer bg-white text-black px-6 py-4 rounded-2xl hover:bg-orange-500 hover:text-white transition-all flex items-center gap-2 font-bold uppercase text-xs">
                                        <Settings size={18} /> Gerenciar
                                    </button>
                                </Link>
                            )}
                        </div>
                    </motion.div>
                </div>
            </section>

            {setoresDisponiveis.length > 0 && (
                <div className="px-6 md:px-16 mt-6 relative z-30">
                    <div className="inline-flex bg-[#1C1C1C] p-1.5 rounded-[1.5rem] border border-white/10 gap-1 flex-wrap">
                        <button
                            onClick={() => setSetorFiltro("Todos")}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                                setorFiltro === "Todos"
                                    ? "bg-orange-500 text-white"
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            Todos
                        </button>
                        {setoresDisponiveis.map(s => (
                            <button
                                key={s}
                                onClick={() => setSetorFiltro(s)}
                                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                                    setorFiltro === s
                                        ? "bg-orange-500 text-white"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="px-6 md:px-16 mt-8 pb-20 relative z-30 space-y-12 md:space-y-20">
                <AnimatePresence mode="wait">
                    {cursosFiltrados.map((curso, idx) => (
                        <motion.div
                            key={curso.id}
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, delay: idx * 0.05 }}
                        >
                            <TrilhaCarrossel
                                setor={{ nome: curso.nome, items: curso.modulos }}
                                onSelectModulo={setSelectedModulo}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>

                {cursosFiltrados.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center text-slate-500 py-20"
                    >
                        Nenhum curso encontrado.
                    </motion.div>
                )}
            </div>

            <AnimatePresence>
                {selectedModulo && (
                    <ModuloModal
                        modulo={selectedModulo}
                        videos={initialVideos}
                        onClose={() => setSelectedModulo(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
