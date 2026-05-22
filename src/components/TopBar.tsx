import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePushNotifications } from "../hooks/usePushNotifications";

export function TopBar() {
  const { currentDriver, logout } = useAuth();
  const navigate = useNavigate();
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } =
    usePushNotifications();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/8 bg-[var(--ink-900)]/90 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="text-xl">🚛</span>
        <div>
          <p className="font-display text-sm font-semibold leading-none text-[var(--text)]">
            {currentDriver?.name ?? "Chofer"}
          </p>
          <p className="text-xs text-[var(--muted)]">Transporte Zafe</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isSupported && (
          <button
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={isLoading}
            title={isSubscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
            className="rounded-xl border px-2 py-1.5 text-sm transition-colors disabled:opacity-50
              border-white/10 text-[var(--muted)]
              data-[on=true]:border-tz-yellow/30 data-[on=true]:text-tz-yellow"
            data-on={String(isSubscribed)}
          >
            {isSubscribed ? "🔔" : "🔕"}
          </button>
        )}
        <button
          onClick={handleLogout}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-sm text-[var(--muted)] hover:border-tz-red/50 hover:text-tz-red transition-colors"
        >
          Salir
        </button>
      </div>
    </header>
  );
}
