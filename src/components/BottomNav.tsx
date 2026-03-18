import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type NavItem = {
  to: string;
  label: string;
  icon: string;
  activePrefix?: string;
};

const ALWAYS_VISIBLE: NavItem[] = [
  { to: "/anticipos", label: "Anticipos", icon: "💰" },
  { to: "/mi-pago", label: "Mi Pago", icon: "📊" },
];

const PICADO_ITEM: NavItem = {
  to: "/picado/nuevo",
  label: "Picado",
  icon: "📋",
  activePrefix: "/picado",
};

const ZAFRA_ITEM: NavItem = {
  to: "/zafra/nuevo",
  label: "Zafra",
  icon: "🚜",
  activePrefix: "/zafra",
};

export function BottomNav() {
  const { currentDriver } = useAuth();
  const location = useLocation();
  const modulos = currentDriver?.modulos ?? [];

  const items: NavItem[] = [
    ...(modulos.includes("PICADO") ? [PICADO_ITEM] : []),
    ...(modulos.includes("ZAFRA") ? [ZAFRA_ITEM] : []),
    ...ALWAYS_VISIBLE,
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/8 bg-[var(--ink-900)]/95 backdrop-blur-md lg:hidden">
      <div className="flex">
        {items.map((item) => {
          const isActive = item.activePrefix
            ? location.pathname.startsWith(item.activePrefix)
            : location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-tz-yellow/10 text-tz-yellow"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
