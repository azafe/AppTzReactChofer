import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/zafra/mis-viajes", label: "Mis Viajes" },
  { to: "/zafra/nuevo", label: "Nuevo Viaje" },
];

export function ZafraNav() {
  return (
    <div className="flex gap-2 rounded-2xl border border-white/8 bg-white/3 p-1">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex-1 rounded-xl py-2 text-center text-sm font-semibold transition-colors ${
              isActive
                ? "bg-tz-yellow text-tz-black"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
