import { AuditDetail } from "@/components/AlphaSEO/shared/DetailViews";
export default async function Page({params}:{params:Promise<{projectId:string;auditId:string}>}){const p=await params;return <AuditDetail projectId={p.projectId} auditId={p.auditId}/>}
