import { Cormorant_Garamond, Inter } from "next/font/google";
import { Suspense } from "react";
import type { Metadata } from "next";

import { LoadingState } from "@/components/ui/loading";

import "./login.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-login-sans",
});

export const metadata: Metadata = {
  title: "Connexion — SOFIGEPAM Connect",
  description:
    "Accédez à votre espace sécurisé AMANAH FIDUCIE : gestion fiduciaire, conformité charaïque et portails partenaires.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${sans.variable} login-root font-[family-name:var(--font-login-sans)]`}>
      <Suspense fallback={<LoadingState fullScreen label="Chargement…" />}>
        {children}
      </Suspense>
    </div>
  );
}
