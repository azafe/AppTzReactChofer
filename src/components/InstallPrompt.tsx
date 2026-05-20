import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("pwa-install-dismissed") === "1"
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt || dismissed) return null;

  const install = async () => {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
  };

  const dismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 lg:bottom-6 lg:left-auto lg:right-6 lg:w-80">
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#1b2230] p-4 shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0c75f] text-sm font-black text-[#1b1404]">
          TZ
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Instalar app</p>
          <p className="mt-0.5 text-xs text-white/60">
            Agregala a tu pantalla de inicio y recibí notificaciones
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="rounded-lg bg-[#f0c75f] px-3 py-1.5 text-xs font-bold text-[#1b1404] transition hover:brightness-110"
            >
              Instalar
            </button>
            <button
              onClick={dismiss}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:text-white/90"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
