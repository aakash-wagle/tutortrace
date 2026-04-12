import { useEffect } from "react";
import { useRoutes } from "react-router-dom";
import Providers from "@/components/Providers";
import { routes } from "@/router";

export default function App() {
  const element = useRoutes(routes);

  // Register "Add to Home Screen" prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      // Store the event so it can be triggered later from Settings
      (window as unknown as Record<string, unknown>).__deferredInstallPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return <Providers>{element}</Providers>;
}
