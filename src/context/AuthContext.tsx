import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DriverAccount, LoginResult } from "../types/auth";
import { apiGet } from "../lib/http";

type AuthContextValue = {
  currentDriver: DriverAccount | null;
  /** Motivo por el que se cerró la sesión sola (chofer inactivo o dado de baja). */
  sessionMessage: string | null;
  login: (username: string, pin: string) => Promise<LoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "tz_chofer_session";
const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
const BAD_CREDENTIALS = "Usuario o PIN incorrecto.";

// Cada cuánto se revalida el estado del chofer contra el backend.
const REVALIDATE_MS = 5 * 60 * 1000;
// Piso entre revalidaciones, para no disparar una por cada foco de ventana.
const REVALIDATE_THROTTLE_MS = 15 * 1000;

type ApiChofer = {
  id: string;
  driverId?: string;
  driver_id?: string;
  nombre?: string;
  nombreCompleto?: string;
  username?: string;
  vehicleLabel?: string | null;
  vehicleId?: string | null;
  modulos?: string[];
};

type SessionResponse = {
  ok: boolean;
  valid: boolean;
  reason?: string;
  chofer?: ApiChofer;
};

function toDriverAccount(c: ApiChofer, fallbackUsername: string): DriverAccount {
  return {
    id: c.id,
    driverId: c.driverId ?? c.driver_id ?? "",
    name: c.nombre ?? c.nombreCompleto ?? "",
    username: c.username ?? fallbackUsername,
    vehicleLabel: c.vehicleLabel ?? undefined,
    vehicleId: c.vehicleId ?? undefined,
    modulos: Array.isArray(c.modulos) ? c.modulos : [],
  };
}

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
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const lastCheckRef = useRef(0);

  async function login(username: string, pin: string): Promise<LoginResult> {
    try {
      const res = await fetch(`${API_BASE}/choferes/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), pin: pin.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // 403 = chofer inactivo; el resto se muestra como credenciales inválidas
        if (res.status === 403 && data?.error) return { ok: false, error: String(data.error) };
        return { ok: false, error: BAD_CREDENTIALS };
      }

      if (!data?.ok || !data.chofer) return { ok: false, error: BAD_CREDENTIALS };

      const driver = toDriverAccount(data.chofer as ApiChofer, username.trim().toLowerCase());

      localStorage.setItem(STORAGE_KEY, JSON.stringify(driver));
      lastCheckRef.current = Date.now();
      setSessionMessage(null);
      setCurrentDriver(driver);
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo conectar con el servidor." };
    }
  }

  const logout = useCallback((message: string | null = null) => {
    localStorage.removeItem(STORAGE_KEY);
    setSessionMessage(message);
    setCurrentDriver(null);
  }, []);

  /**
   * Confirma contra el backend que el chofer sigue habilitado. Solo cierra la
   * sesión si el servidor responde que ya no es válida: un error de red deja la
   * sesión como está para no echar al chofer cuando se queda sin señal.
   */
  const revalidate = useCallback(async () => {
    const driver = currentDriver;
    if (!driver?.id) return;
    if (Date.now() - lastCheckRef.current < REVALIDATE_THROTTLE_MS) return;
    lastCheckRef.current = Date.now();

    try {
      const res = await apiGet<SessionResponse>(`/choferes/${driver.id}/session`);
      if (!res?.ok) return;

      if (!res.valid) {
        logout(res.reason ?? "Tu sesión fue cerrada por el administrador.");
        return;
      }

      // Sesión válida: aprovechamos para refrescar módulos/unidad asignada.
      if (res.chofer) {
        const fresh = toDriverAccount(res.chofer, driver.username);
        if (JSON.stringify(fresh) !== JSON.stringify(driver)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
          setCurrentDriver(fresh);
        }
      }
    } catch {
      // Sin conexión o error del servidor: se mantiene la sesión actual.
    }
  }, [currentDriver, logout]);

  useEffect(() => {
    if (!currentDriver) return;

    // La primera verificación se difiere para no encadenar renders al montar.
    const firstCheck = window.setTimeout(() => void revalidate(), 0);

    const onFocus = () => void revalidate();
    const onVisible = () => {
      if (document.visibilityState === "visible") void revalidate();
    };
    const timer = window.setInterval(() => void revalidate(), REVALIDATE_MS);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [currentDriver, revalidate]);

  return (
    <AuthContext.Provider value={{ currentDriver, sessionMessage, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
