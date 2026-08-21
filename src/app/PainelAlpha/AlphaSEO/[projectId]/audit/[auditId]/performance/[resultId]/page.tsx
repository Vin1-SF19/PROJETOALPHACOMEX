import { LighthouseDetail } from "@/components/AlphaSEO/shared/DetailViews";
export default async function Page({params}:{params:Promise<{projectId:string;auditId:string;resultId:string}>}){const p=await params;return <LighthouseDetail projectId={p.projectId} auditId={p.auditId} resultId={p.resultId}/>}
