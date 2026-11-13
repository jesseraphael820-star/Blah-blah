import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { StudioProvider } from "@/store/studio";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: { default: "LOOKSMAXXING AI — Estúdio de simulação visual com IA", template: "%s · LOOKSMAXXING AI" },
  description:
    "Envie sua foto e visualize cortes de cabelo, cuidados com a pele, barba, iluminação e acessórios com IA, sempre com comparação antes e depois.",
  applicationName: "LOOKSMAXXING AI",
  robots: { index: true, follow: true },
  openGraph: {
    title: "LOOKSMAXXING AI",
    description: "Simulação visual de looksmaxxing com inteligência artificial.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  themeColor: "#06050a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="app-bg font-sans antialiased">
        <StudioProvider>
          {children}
          <Toaster />
        </StudioProvider>
      </body>
    </html>
  );
}
