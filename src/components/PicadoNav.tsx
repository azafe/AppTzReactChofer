import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/picado/nuevo", label: "Nuevo Viaje" },
  { to: "/picado/mis-viajes", label: "Mis Viajes" },
];

export function PicadoNav() {
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
