import type { Metadata } from "next";
import { StudioShell } from "@/components/studio/StudioShell";

export const metadata: Metadata = { title: "Estúdio", robots: { index: false } };

export default function StudioPage() {
  return <StudioShell />;
}
