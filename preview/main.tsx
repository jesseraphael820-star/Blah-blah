import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Home from "@/app/page";
import PrivacyPage from "@/app/privacidade/page";
import { StudioShell } from "@/components/studio/StudioShell";
import { Toaster } from "@/components/ui/Toaster";
import { StudioProvider } from "@/store/studio";
import { PRIVACY_HASH, STUDIO_HASHES } from "./shims/routes";

type Route = "home" | "studio" | "privacy";
const routeOf = (): Route => {
  const h = location.hash.slice(1);
  if (STUDIO_HASHES.includes(h)) return "studio";
  if (h === PRIVACY_HASH) return "privacy";
  return "home";
};

function App() {
  const [route, setRoute] = useState<Route>(routeOf);
  useEffect(() => {
    const on = () => {
      const next = routeOf();
      setRoute((prev) => {
        if (next !== prev) {
          // Ao trocar de página, vai para o topo ou para a âncora da home (#ferramentas etc.).
          requestAnimationFrame(() => {
            const el = document.getElementById(location.hash.slice(1));
            if (el && next === "home") el.scrollIntoView();
            else window.scrollTo(0, 0);
          });
        }
        return next;
      });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return (
    <StudioProvider>
      {route === "studio" ? <StudioShell /> : route === "privacy" ? <PrivacyPage /> : <Home />}
      <Toaster />
    </StudioProvider>
  );
}

document.body.classList.add("app-bg", "font-sans", "antialiased");
createRoot(document.getElementById("root")!).render(<App />);
