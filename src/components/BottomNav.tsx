import { NavLink } from "react-router-dom";

const items = [
  { to: "/mis-viajes", label: "Viajes", icon: "📋" },
  { to: "/cargar", label: "Cargar", icon: "➕" },
  { to: "/anticipos", label: "Anticipos", icon: "💰" },
  { to: "/mi-pago", label: "Mi Pago", icon: "📊" },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/8 bg-[var(--ink-900)]/95 backdrop-blur-md lg:hidden">
      <div className="grid grid-cols-4">
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
