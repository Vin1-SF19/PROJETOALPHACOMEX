import { RankDetail } from "@/components/AlphaSEO/shared/DetailViews";
export default async function Page({params}:{params:Promise<{projectId:string;trackerId:string}>}){const p=await params;return <RankDetail projectId={p.projectId} trackerId={p.trackerId}/>}
