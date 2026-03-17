import { createContext, useContext, useState, type ReactNode } from "react";
import type { DriverAccount } from "../types/auth";

type AuthContextValue = {
  currentDriver: DriverAccount | null;
  login: (username: string, pin: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "tz_chofer_session";
const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

function loadSession(): DriverAccount | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved) as DriverAccount;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentDriver, setCurrentDriver] = useState<DriverAccount | null>(loadSession);

  async function login(username: string, pin: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/choferes/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), pin: pin.trim() }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (!data.ok || !data.chofer) return false;

      const c = data.chofer;
      const driver: DriverAccount = {
        id: c.id,
        driverId: c.driverId ?? c.driver_id ?? "",
        name: c.nombre ?? c.nombreCompleto ?? "",
        username: c.username ?? username.trim().toLowerCase(),
        vehicleLabel: c.vehicleLabel ?? undefined,
        vehicleId: c.vehicleId ?? undefined,
        modulos: Array.isArray(c.modulos) ? c.modulos : [],
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(driver));
      setCurrentDriver(driver);
      return true;
    } catch {
      return false;
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentDriver(null);
  }

  return (
    <AuthContext.Provider value={{ currentDriver, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
