import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { DriverAccount } from "../types/auth";
import { DRIVER_ACCOUNTS } from "../config/drivers";

type AuthContextValue = {
  currentDriver: DriverAccount | null;
  login: (username: string, pin: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "tz_chofer_driver_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentDriver, setCurrentDriver] = useState<DriverAccount | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return DRIVER_ACCOUNTS.find((d) => d.id === saved) ?? null;
  });

  useEffect(() => {
    if (currentDriver) {
      localStorage.setItem(STORAGE_KEY, currentDriver.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentDriver]);

  function login(username: string, pin: string): boolean {
    const driver = DRIVER_ACCOUNTS.find(
      (d) => d.username === username.trim().toLowerCase() && d.pin === pin.trim()
    );
    if (driver) {
      setCurrentDriver(driver);
      return true;
    }
    return false;
  }

  function logout() {
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
