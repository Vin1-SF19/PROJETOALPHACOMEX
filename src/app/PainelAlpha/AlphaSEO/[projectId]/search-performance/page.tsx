import { FeatureRoute } from "@/components/AlphaSEO/shared/FeatureRoute";
export default async function Page({params}:{params:Promise<{projectId:string}>}){return <FeatureRoute projectId={(await params).projectId} kind="gsc"/>}
