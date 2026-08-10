import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { StatusConexao } from "@/components/StatusConexao";
import { ThemeProviderAlpha } from "@/components/ThemeProviderAlpha";
import { auth } from "../../auth";
import BroadcastBanner from "@/components/BroadcastBanner";
import { NotificacaoFlutuante } from "@/components/NotificacaoFlutuante";
import { Heartbeat } from "@/components/Heartbeat";
import { ThemeSyncer } from "@/components/ThemeSyncer";
import { PusherGlobal } from "@/components/PusherGlobal.tsx";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Painel Alpha | Sistema de Gestão",
  description: "Plataforma avançada de monitoramento e suporte Alpha",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  
  const rgbPadrao = "59, 130, 246"; 

  return (
    <html 
      lang="pt-br" 
      className="dark"
      style={{ "--alpha-primary": rgbPadrao } as React.CSSProperties}
    >
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-alpha/30`}>
        <SessionProvider session={session}>
          <ThemeSyncer />
          <Toaster theme="dark" position="top-right" richColors />
          <StatusConexao />

          <ThemeProviderAlpha>
            <BroadcastBanner />
            <NotificacaoFlutuante/>
            <Heartbeat /> 
            <PusherGlobal/>
            {children}
          </ThemeProviderAlpha>
        </SessionProvider>
      </body>
    </html>
  );
}
