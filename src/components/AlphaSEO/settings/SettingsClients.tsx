"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { AtualizarProjetoAlphaSeo } from "@/actions/AlphaSeoProjects";
import { SeoCard } from "../shared/PageHeader";

type Project = { id: string; name: string; domain: string | null; market: string; languageCode: string; locationCode: number };
export function GeneralSettings({ project }: { project: Project }) {
  const [message,setMessage]=useState(""); const [pending,start]=useTransition(); const router=useRouter();
  function save(data:FormData){start(async()=>{const result=await AtualizarProjetoAlphaSeo({projectId:project.id,name:data.get("name"),domain:data.get("domain")||null,market:data.get("market"),languageCode:data.get("languageCode"),locationCode:Number(data.get("locationCode"))});setMessage(result.success?"Projeto atualizado.":result.error ?? "Não foi possível atualizar.");if(result.success)router.refresh()})}
  return <SeoCard className="p-5"><form action={save} className="grid gap-4 md:grid-cols-2"><Field name="name" label="Nome" value={project.name}/><Field name="domain" label="Domínio" value={project.domain??""}/><Field name="market" label="Mercado" value={project.market}/><Field name="languageCode" label="Idioma" value={project.languageCode}/><Field name="locationCode" label="Location code" value={String(project.locationCode)}/><div className="flex items-end"><button disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-4 py-3 text-sm font-black text-slate-950"><Save size={16}/>{pending?"Salvando…":"Salvar alterações"}</button></div></form>{message&&<p role="status" className="mt-3 text-sm text-slate-300">{message}</p>}</SeoCard>
}
function Field({name,label,value}:{name:string;label:string;value:string}){return <label className="text-xs font-semibold text-slate-300">{label}<input name={name} defaultValue={value} required={name!=="domain"} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none focus:border-[rgb(var(--seo-accent))]"/></label>}
