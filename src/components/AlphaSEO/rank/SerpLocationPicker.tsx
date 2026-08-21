"use client";

import { useState, useTransition } from "react";
import { DatabaseZap, MapPin, Search } from "lucide-react";
import { BuscarLocalizacoesSerpAlphaSeo, PreaquecerLocalizacoesSerpAlphaSeo } from "@/actions/AlphaSeoSettings";

interface Location { locationCode: number; displayLabel: string; locationType: string }
function parse(value: unknown): Location[] { if (!Array.isArray(value)) return []; return value.flatMap((item) => item && typeof item === "object" && "locationCode" in item && "displayLabel" in item && typeof item.locationCode === "number" && typeof item.displayLabel === "string" ? [{ locationCode: item.locationCode, displayLabel: item.displayLabel, locationType: "locationType" in item && typeof item.locationType === "string" ? item.locationType : "" }] : []); }

export function SerpLocationPicker({ projectId, initialCode }: { projectId: string; initialCode: number }) {
  const [code, setCode] = useState(initialCode);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("BR");
  const [selected, setSelected] = useState(`Código ${initialCode}`);
  const [rows, setRows] = useState<Location[]>([]);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function search() { if (!query.trim()) return; start(async () => { const result = await BuscarLocalizacoesSerpAlphaSeo({ projectId, query, countryCode: country }); if (!result.success) return setMessage(result.error); const parsed = parse(result.data); setRows(parsed); setMessage(parsed.length ? "Selecione uma localização." : "Nenhuma localização encontrada neste país."); }); }
  function prewarm() { start(async () => { const result = await PreaquecerLocalizacoesSerpAlphaSeo({ projectId, countryCode: country }); if (!result.success) return setMessage(result.error); const value = result.data as { count?: number; cached?: boolean }; setMessage(`${value.cached ? "Cache" : "Catálogo"} de ${country} pronto${typeof value.count === "number" ? ` (${value.count} localidades)` : ""}.`); }); }
  return <div className="relative rounded-xl border border-white/10 bg-slate-950 p-2"><input type="hidden" name="locationCode" value={code}/><div className="flex min-h-11 items-center gap-2"><MapPin size={14} className="shrink-0 text-[rgb(var(--seo-accent))]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={selected} className="min-w-0 flex-1 bg-transparent px-1 text-xs outline-none"/><input aria-label="País" value={country} onChange={(event) => setCountry(event.target.value.toUpperCase().slice(0,2))} className="w-10 bg-transparent text-xs uppercase outline-none"/><button type="button" onClick={prewarm} disabled={pending || country.length !== 2} className="grid size-11 shrink-0 place-items-center rounded-lg border border-white/10" aria-label="Preparar localidades do país"><DatabaseZap size={13}/></button><button type="button" onClick={search} disabled={pending || !query.trim()} className="grid size-11 shrink-0 place-items-center rounded-lg border border-white/10" aria-label="Buscar localização"><Search size={13}/></button></div>{rows.length > 0 && <div className="mt-2 max-h-44 space-y-1 overflow-y-auto border-t border-white/5 pt-2">{rows.map((row) => <button key={row.locationCode} type="button" onClick={() => { setCode(row.locationCode); setSelected(row.displayLabel); setQuery(""); setRows([]); setMessage(`Localização: ${row.displayLabel}`); }} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-xs text-slate-300 hover:bg-white/[.06]"><span>{row.displayLabel}</span><small className="text-slate-600">{row.locationType}</small></button>)}</div>}{message && <p role="status" className="px-2 py-1 text-[10px] text-slate-500">{message}</p>}</div>;
}
