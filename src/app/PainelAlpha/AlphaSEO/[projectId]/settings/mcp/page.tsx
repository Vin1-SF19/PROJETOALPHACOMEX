import { SettingsPage } from "@/components/AlphaSEO/settings/SettingsPage";
export default async function Page({params}:{params:Promise<{projectId:string}>}){return <SettingsPage projectId={(await params).projectId} tab="mcp"/>}
