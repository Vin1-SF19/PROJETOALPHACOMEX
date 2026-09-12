import type { Metadata } from "next";

import { LoginScene } from "../components/login/LoginScene";

export const metadata: Metadata = {
  title: "Acesso | Painel Alpha",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <>
      <link rel="preload" as="image" href="/containernavio.png" />
      <link rel="preload" as="image" href="/NavioLogin.png" />
      <link rel="preload" as="image" href="/Corda Náutica com Laços Simétricos.png" />
      <link rel="preload" as="audio" href="/sounds/buzina.mp3" />
      <LoginScene />
    </>
  );
}
