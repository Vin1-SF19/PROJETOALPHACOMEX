import { X, Building2, ShieldCheck, History, Landmark, MapPin, Receipt, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BotaoExportarExcel } from "./BotaoExportarExcel";
import type { RadarFiscalItem } from "./types";

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;
type Cnae = { code?: string; codigo?: string; text?: string; descricao?: string };
type HistoricoRegime = { Ano?: string | number; ano?: string | number; periodo?: string; regime?: string; Regime?: string };

function Badge({ label, color }: { label: string, color: string }) {
    return <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase ${color}`}>{label}</span>;
}

export default function ModalDetalhesCNPJ({ item, onClose }: { item: RadarFiscalItem, onClose: () => void }) {
    const mounted = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    if (!item || !mounted) return null;

    const parseData = (data: unknown) => {
        try {
            return typeof data === 'string' ? JSON.parse(data) : data;
        } catch {
            return [];
        }
    };

    const historico = parseData(item.historico_regime || item.historicoRegime || []);
    const cnaes = parseData(item.cnaes || item.cnaes_secundarios || []);

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div
                className="bg-[#0A0A0A] border border-white/10 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-[3rem] shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-md p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 z-10">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">
                                {item.razao_social || item.razaoSocial}
                            </h2>
                            <Badge
                                label={item.qualificacao || "NÃO INFORMADO"}
                                color={!item.qualificacao ? 'text-slate-400 border-slate-400/20 bg-slate-400/5' : item.qualificacao === 'PREMIUM' ? 'text-amber-400 border-amber-400/20 bg-amber-400/5' : 'text-emerald-400 border-emerald-400/20'}
                            />
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 tracking-[0.2em]">
                            {item.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-auto">
                        <BotaoExportarExcel item={item} />
                        <div className="w-px h-8 bg-white/10 mx-2 hidden md:block" />
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-white/5 rounded-full transition-colors border border-transparent hover:border-white/10"
                        >
                            <X size={24} className="cursor-pointer text-slate-500" />
                        </button>
                    </div>
                </div>


                <div className="p-8 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 space-y-4">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Building2 size={14} /> Cadastro</h3>
                            <div>
                                <span className="block text-[9px] text-slate-500 uppercase font-bold">Razão Social</span>
                                <p className="text-xs font-bold text-white uppercase">{item.razao_social || item.razaoSocial}</p>
                            </div>
                            <div>
                                <span className="block text-[9px] text-slate-500 uppercase font-bold">Nome Fantasia</span>
                                <p className="text-xs font-bold text-white uppercase">{item.nome_fantasia || item.nomeFantasia || 'NÃO INFORMADO'}</p>
                            </div>
                            <div>
                                <span className="block text-[9px] text-slate-500 uppercase font-bold">Data de Abertura</span>
                                <p className="text-xs font-bold text-white">{item.data_abertura || item.abertura}</p>
                            </div>
                        </div>

                        <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 space-y-4">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><MapPin size={14} /> Localização</h3>
                            <div>
                                <span className="block text-[9px] text-slate-500 uppercase font-bold">Cidade / UF</span>
                                <p className="text-xs font-bold text-white uppercase">{item.municipio} - {item.uf}</p>
                            </div>
                            <div>
                                <span className="block text-[9px] text-slate-500 uppercase font-bold">Situação</span>
                                <p className="text-xs font-bold text-emerald-400 uppercase">{item.situacao_cadastral || item.situacao}</p>
                            </div>
                        </div>

                        <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 space-y-4">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Landmark size={14} /> Capital Social
                            </h3>
                            <p className="text-2xl font-black text-white italic">
                                {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                }).format(Number(item.capital_social || item.capitalSocial || 0))}
                            </p>
                        </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-12">
                        <div className="space-y-6">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                <Receipt size={16} /> Status Tributário
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/5 rounded-2xl">
                                    <span className="text-[8px] font-black text-slate-500 uppercase">Regime Receita</span>
                                    <p className="text-[10px] font-bold text-white uppercase">{item.regime_receita || item.regimeReceita || 'N/A'}</p>
                                </div>
                                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                                    <span className="text-[8px] font-black text-amber-500/70 uppercase">Regime Empresa Aqui</span>
                                    <p className="text-[10px] font-bold text-amber-400 uppercase">{item.regime_ea || item.regimeEA || 'N/A'}</p>
                                </div>
                            </div>

                            <div className={`p-6 border rounded-[3rem] flex items-center justify-between transition-all ${item.regime_receita?.includes('SIMPLES') ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                                <div className="flex items-center gap-5">
                                    <div className={`p-4 rounded-2xl ${item.regime_receita?.includes('SIMPLES') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {item.regime_receita?.includes('SIMPLES') ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Situação Simples</span>
                                            <p className={`text-sm font-black uppercase ${item.regime_receita?.includes('SIMPLES') ? 'text-emerald-400' : 'text-red-500'}`}>
                                                {item.regime_receita?.includes('SIMPLES') ? 'Optante' : 'Não Optante'}
                                            </p>
                                        </div>

                                        <div>
                                            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Data de Opção</span>
                                            <p className="text-sm font-black text-white">{item.data_opcao_simples || item.dataOpcao || '---'}</p>
                                        </div>

                                        <div className="mt-2">
                                            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Exclusão</span>
                                            <p className="text-[10px] font-black text-white uppercase leading-none">
                                                {item.data_exclusao_simples || 'Nenhuma'}
                                            </p>
                                        </div>

                                        <div className="mt-2">
                                            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Dívida Ativa</span>
                                            <p className="text-[10px] font-black text-white">
                                                {Number(item.divida_tributaria) > 0
                                                    ? `R$ ${Number(item.divida_tributaria).toLocaleString('pt-BR')}`
                                                    : 'Sem Dividas'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[3rem] space-y-6">
                            <div className="space-y-4">
                                <div className="flex justify-between border-b border-white/5 pb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Anexo Identificado</span>
                                    <span className="text-[10px] font-black text-white">{item.perse_anexo || 'NENHUM'}</span>
                                </div>

                                <div className="flex flex-col gap-2 pt-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">CNAEs Identificados</span>
                                    <div className="flex flex-col gap-4 pt-2">
                                        {(() => {
                                            const dadosCnae = typeof item.cnaes === 'string' ? JSON.parse(item.cnaes) : item.cnaes;
                                            const listaCnaes = [...(dadosCnae?.principal || []), ...(dadosCnae?.secundarios || [])];

                                            const codigosAnexo1 = [
                                                "18.13-0-01", "43.30-4-02", "46.89-3-99", "52.11-7-99", "55.10-8-01", "55.10-8-02", "55.90-6-01", "55.90-6-02",
                                                "55.90-6-03", "55.90-6-99", "56.20-1-01", "56.20-1-02", "59.11-1-02", "59.14-6-00", "73.12-2-00", "73.19-0-01",
                                                "74.20-0-01", "74.20-0-04", "74.90-1-01", "74.90-1-04", "74.90-1-05", "77.21-7-00", "77.29-2-02", "77.33-1-00",
                                                "77.39-0-03", "77.39-0-99", "78.10-8-00", "80.11-1-01", "81.11-7-00", "82.30-0-01", "82.30-0-02", "85.92-9-01",
                                                "90.01-9-01", "90.01-9-02", "90.01-9-03", "90.01-9-04", "90.01-9-06", "90.01-9-99", "90.03-5-00", "93.11-5-00",
                                                "93.12-3-00", "93.19-1-01", "93.29-8-01"
                                            ];

                                            const codigosAnexo2 = [
                                                "03.11-6-04", "03.12-4-04", "11.12-7-00", "28.69-1-00", "33.17-1-01", "33.17-1-02", "47.63-6-05", "47.89-0-01",
                                                "49.23-0-02", "49.29-9-01", "49.29-9-02", "49.29-9-03", "49.29-9-04", "50.11-4-02", "50.12-2-02", "50.99-8-01",
                                                "50.30-1-01", "50.30-1-02", "50.30-1-03", "51.12-9-99", "52.31-1-01", "52.31-1-02", "56.11-2-01", "56.11-2-03",
                                                "56.11-2-04", "56.11-2-05", "70.20-4-00", "73.19-0-04", "74.90-1-02", "74.90-1-99", "77.11-0-00", "77.19-5-99",
                                                "79.11-2-00", "79.12-1-00", "79.90-2-00", "85.91-1-00", "85.92-9-99", "90.02-7-01", "91.02-3-01", "91.03-1-00",
                                                "93.19-1-99", "93.21-2-00", "93.29-8-04", "93.29-8-99", "94.93-6-00"
                                            ];

                                            const cnaesAnexo1 = listaCnaes.filter(c => codigosAnexo1.includes(c.code || c.codigo));
                                            const cnaesAnexo2 = listaCnaes.filter(c => codigosAnexo2.includes(c.code || c.codigo));

                                            // Filtra o que sobrou (não está no 1 nem no 2)
                                            const cnaesRestantes = listaCnaes.filter(c =>
                                                !codigosAnexo1.includes(c.code || c.codigo) &&
                                                !codigosAnexo2.includes(c.code || c.codigo)
                                            );

                                            const TagCnae = ({ cnae, color }: { cnae: Cnae, color: string }) => (
                                                <div className="group relative cursor-help">
                                                    <span className={`px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] font-mono ${color} hover:bg-white/10 transition-all`}>
                                                        {cnae.code || cnae.codigo}
                                                    </span>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black border border-white/10 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                                        <p className="text-[8px] leading-tight text-white uppercase font-bold text-center">
                                                            {cnae.text || cnae.descricao}
                                                        </p>
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-black"></div>
                                                    </div>
                                                </div>
                                            );

                                            return (
                                                <div className="space-y-6">
                                                    {cnaesAnexo1.length > 0 && (
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">CNAEs Anexo 1</span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {cnaesAnexo1.map((c, i) => <TagCnae key={i} cnae={c} color="text-amber-400" />)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {cnaesAnexo2.length > 0 && (
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">CNAEs Anexo 2</span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {cnaesAnexo2.map((c, i) => <TagCnae key={i} cnae={c} color="text-blue-400" />)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {cnaesRestantes.length > 0 && (
                                                        <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">Demais Atividades</span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {cnaesRestantes.map((c, i) => <TagCnae key={i} cnae={c} color="text-slate-500" />)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                </div>
                            </div>

                        </div>

                    </div>

                    {cnaes.length > 0 && (
                        <div className="space-y-6 border-t border-white/5 pt-12">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                <ShieldCheck size={16} /> Atividades Econômicas
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {cnaes.map((cnae: Cnae, idx: number) => (
                                    <div key={idx} className="bg-white/5 p-4 rounded-xl flex items-center gap-4 border border-white/5">
                                        <span className="text-emerald-400 font-mono text-[10px] shrink-0">{cnae.codigo || cnae.code}</span>
                                        <span className="text-white text-[10px] uppercase font-bold">{cnae.descricao || cnae.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {historico.length > 0 && (
                        <div className="space-y-6 border-t border-white/5 pt-12 pb-8">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                <History size={16} /> Evolução Tributária Anual
                            </h3>

                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                {[2018, 2019, 2020, 2021, 2022, 2023, 2024].map(ano => {
                                    const registro = historico.find((h: HistoricoRegime) =>
                                        String(h.Ano || h.ano || h.periodo).includes(String(ano))
                                    );

                                    return (
                                        <div key={ano} className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center group hover:border-white/20 transition-all">
                                            <span className="block text-[10px] font-black text-slate-600 mb-2">{ano}</span>
                                            <span className={`text-[9px] font-black uppercase leading-tight ${registro ? 'text-white' : 'text-slate-700'}`}>
                                                {registro?.Regime || registro?.regime || "SEM INFORMAÇÃO"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
