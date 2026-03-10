import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login, currentDriver } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (currentDriver) {
    navigate("/", { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const ok = login(username, pin);
    setLoading(false);
    if (ok) {
      navigate("/", { replace: true });
    } else {
      setError("Usuario o PIN incorrecto.");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-tz-yellow/15 text-5xl border border-tz-yellow/30">
              🚛
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold text-[var(--text)]">
            Transporte Zafe
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Portal del Chofer</p>
        </div>

        {/* Form card */}
        <div className="rounded-3xl border border-white/10 bg-[rgba(20,26,36,0.9)] p-6 shadow-card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Usuario
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej. jvergara"
                required
                className="h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                PIN
              </label>
              <input
                type="password"
                autoComplete="current-password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4 dígitos"
                required
                className="h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60 tracking-widest"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-tz-red/10 px-3 py-2 text-sm text-tz-red">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-tz-yellow font-semibold text-tz-black hover:brightness-105 disabled:opacity-60 disabled:pointer-events-none transition-all"
            >
              {loading ? "Verificando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          ¿Problemas para ingresar? Consultá al administrador.
        </p>
      </div>
    </div>
  );
}
