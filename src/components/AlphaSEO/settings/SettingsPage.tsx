import Link from "next/link";
import { Plug, Settings2, ShieldCheck, TextCursorInput } from "lucide-react";
import db from "@/lib/prisma";
import { ObterStatusAcessoSamAlphaSeo, ObterStatusChaveSeoAlphaSeo } from "@/actions/AlphaSeoSettings";
import { getProjectMemory } from "@/lib/alpha-seo/project-memory/service";
import { PageHeader, SeoCard } from "../shared/PageHeader";
import { GeneralSettings } from "./SettingsClients";
import { GoogleIntegrations } from "./GoogleIntegrations";
import { McpManager } from "./McpManager";
import { MembersManager } from "./MembersManager";
import { MemoryWorkspace } from "./MemoryWorkspace";

const TABS=[["","Geral"],["context","Contexto"],["integrations","Integrações"],["mcp","MCP"]] as const;
export async function SettingsPage({projectId,tab}:{projectId:string;tab:"general"|"context"|"integrations"|"mcp"}){
 const [project,members,invitations,gsc,ga4,seoStatus,samStatus]=await Promise.all([
  db.alphaSeoProject.findUnique({where:{id:projectId},select:{id:true,name:true,domain:true,market:true,languageCode:true,locationCode:true}}),
  db.alphaSeoProjectMember.findMany({where:{projectId,active:true},select:{id:true,userId:true,role:true,user:{select:{nome:true,email:true}}},orderBy:[{role:"asc"},{createdAt:"asc"}],take:200}),
  db.alphaSeoProjectInvitation.findMany({where:{projectId,status:"PENDING"},select:{id:true,email:true,role:true,expiresAt:true},orderBy:{createdAt:"desc"},take:100}),
  db.alphaSeoGscConnection.findUnique({where:{projectId},select:{siteUrl:true}}),
  db.alphaSeoGa4Connection.findUnique({where:{projectId},select:{propertyDisplayName:true}}),
  ObterStatusChaveSeoAlphaSeo(),
  ObterStatusAcessoSamAlphaSeo({projectId}),
 ]);if(!project)return null;
 const providerStatus={dataForSeo:seoStatus.success&&seoStatus.data.configured,sam:samStatus.success&&samStatus.data.enabled};
 return <><PageHeader eyebrow="Configurações" title={tab==="general"?"Projeto":tab==="context"?"Memória do projeto":tab==="integrations"?"Integrações":"MCP e API keys"} description="Preferências e conexões ficam isoladas por projeto e protegidas no servidor." icon={tab==="integrations"?Plug:tab==="mcp"?ShieldCheck:tab==="context"?TextCursorInput:Settings2}/><SeoCard className="mb-5 flex gap-1 overflow-x-auto p-1.5">{TABS.map(([segment,label])=><Link key={label} href={`/PainelAlpha/AlphaSEO/${projectId}/settings${segment?`/${segment}`:""}`} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold ${((tab==="general"&&!segment)||tab===segment)?"bg-white/10 text-white":"text-slate-500 hover:text-slate-200"}`}>{label}</Link>)}</SeoCard>{tab==="general"?<div className="space-y-4"><GeneralSettings project={project}/><MembersManager projectId={projectId} initialMembers={members} initialInvitations={invitations}/></div>:tab==="context"?<Context projectId={projectId}/>:tab==="integrations"?<GoogleIntegrations projectId={projectId} selectedGsc={gsc?.siteUrl??null} selectedGa4={ga4?.propertyDisplayName??null} providerStatus={providerStatus}/>:<McpManager projectId={projectId}/>}</>
}
async function Context({projectId}:{projectId:string}){const memory=await getProjectMemory(projectId);const sections=memory.sections.length?memory.sections:[{key:"site_scope",title:"Escopo do negócio",content:""},{key:"goals",title:"Objetivos atuais",content:""},{key:"positioning",title:"Posicionamento",content:""},{key:"brand_voice",title:"Preferências de escrita",content:""}];return <MemoryWorkspace projectId={projectId} sections={sections} competitors={memory.competitors} keyPages={memory.keyPages} researchLog={memory.researchLog}/>}
