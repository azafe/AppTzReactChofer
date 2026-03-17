import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type NavItem = { to: string; label: string; icon: string };

const ALWAYS_VISIBLE: NavItem[] = [
  { to: "/anticipos", label: "Anticipos", icon: "💰" },
  { to: "/mi-pago", label: "Mi Pago", icon: "📊" },
];

const PICADO_ITEMS: NavItem[] = [
  { to: "/mis-viajes", label: "Viajes", icon: "📋" },
  { to: "/cargar", label: "Cargar", icon: "➕" },
];

const ZAFRA_ITEMS: NavItem[] = [
  { to: "/zafra/mis-viajes", label: "Zafra", icon: "🚜" },
];

export function BottomNav() {
  const { currentDriver } = useAuth();
  const modulos = currentDriver?.modulos ?? [];

  const items: NavItem[] = [
    ...(modulos.includes("PICADO") ? PICADO_ITEMS : []),
    ...(modulos.includes("ZAFRA") ? ZAFRA_ITEMS : []),
    ...ALWAYS_VISIBLE,
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/8 bg-[var(--ink-900)]/95 backdrop-blur-md lg:hidden">
      <div className={`grid grid-cols-${items.length}`}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-tz-yellow/10 text-tz-yellow"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
