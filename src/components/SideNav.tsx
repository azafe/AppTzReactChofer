import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const items = [
  { to: "/", label: "Inicio", icon: "🏠" },
  { to: "/mis-viajes", label: "Mis Viajes", icon: "📋" },
  { to: "/cargar", label: "Cargar Viaje", icon: "➕" },
  { to: "/anticipos", label: "Anticipos", icon: "💰" },
  { to: "/mi-pago", label: "Mi Pago", icon: "📊" },
];

export function SideNav() {
  const { currentDriver, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/8 bg-[var(--ink-900)] px-4 py-6">
      <div className="mb-8 flex items-center gap-3">
        <span className="text-3xl">🚛</span>
        <div>
          <p className="font-display text-base font-bold text-[var(--text)]">
            Transporte Zafe
          </p>
          <p className="text-xs text-[var(--muted)]">Portal del Chofer</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-[var(--panel)] p-3">
        <p className="text-xs text-[var(--muted)]">Conectado como</p>
        <p className="font-semibold text-[var(--text)]">{currentDriver?.name}</p>
        {currentDriver?.vehicleLabel && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{currentDriver.vehicleLabel}</p>
        )}
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-tz-yellow text-tz-black"
                  : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-tz-red/10 hover:text-tz-red transition-colors"
      >
        <span>🚪</span>
        <span>Salir</span>
      </button>
    </aside>
  );
}
