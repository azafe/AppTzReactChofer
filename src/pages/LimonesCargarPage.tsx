import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  createLimonViaje,
  createLimonCarga,
  getUnidadesActivas,
  type LimonCombustibleOrigen,
} from "../services/limonesApi";
import { LimonesNav } from "../components/LimonesNav";
import { Card } from "../components/Card";
import { showToast } from "../components/Toast";
import { todayISO } from "../lib/format";

const inputCls =
  "h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60";
const labelCls = "mb-1 block text-xs text-[var(--muted)]";

export function LimonesCargarPage() {
  const { currentDriver } = useAuth();
  const queryClient = useQueryClient();

  const [fecha, setFecha] = useState(todayISO());
  const [camionVehicleId, setCamionVehicleId] = useState(currentDriver?.vehicleId ?? "");
  const [camionNombre, setCamionNombre] = useState(currentDriver?.vehicleLabel ?? "");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [kmSalida, setKmSalida] = useState("");
  const [kmLlegada, setKmLlegada] = useState("");
  const [litrosGasoil, setLitrosGasoil] = useState("");
  const [origenCombustible, setOrigenCombustible] = useState<LimonCombustibleOrigen>("BASE_TZ");
  const [observaciones, setObservaciones] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const unidadesQ = useQuery({
    queryKey: ["limones-unidades"],
    queryFn: getUnidadesActivas,
    staleTime: 120_000,
  });

  const unidades = unidadesQ.data?.unidades ?? [];

  const kmRecorridos =
    kmSalida && kmLlegada
      ? Math.max(0, Number(kmLlegada) - Number(kmSalida))
      : null;

  const mutation = useMutation({
    mutationFn: async () => {
      const errs: string[] = [];
      if (!fecha) errs.push("Ingresá la fecha.");
      if (!camionVehicleId) errs.push("Seleccioná un camión.");
      if (!origen.trim()) errs.push("Ingresá el origen.");
      if (!destino.trim()) errs.push("Ingresá el destino.");
      const kS = Number(kmSalida);
      const kL = Number(kmLlegada);
      if (!Number.isFinite(kS) || kmSalida === "") errs.push("Ingresá km de salida.");
      if (!Number.isFinite(kL) || kmLlegada === "") errs.push("Ingresá km de llegada.");
      if (Number.isFinite(kS) && Number.isFinite(kL) && kL < kS)
        errs.push("Km de llegada debe ser mayor o igual a km de salida.");
      const lts = litrosGasoil !== "" ? Number(litrosGasoil) : null;
      if (lts !== null && (!Number.isFinite(lts) || lts <= 0))
        errs.push("Los litros de gasoil deben ser un número mayor a 0.");
      if (errs.length > 0) {
        setErrors(errs);
        throw new Error(errs[0]);
      }
      setErrors([]);

      await createLimonViaje({
        fecha,
        choferId: currentDriver!.id,
        choferNombre: currentDriver!.name,
        camionId: camionVehicleId,
        camionNombre,
        origen: origen.trim(),
        destino: destino.trim(),
        kmSalida: kS,
        kmLlegada: kL,
        observaciones: observaciones.trim() || null,
      });

      if (lts !== null && lts > 0) {
        await createLimonCarga({
          fecha,
          camionId: camionVehicleId,
          camionNombre,
          litros: lts,
          tanqueInicial: null,
          kmOdometro: kL,
          origen: origenCombustible,
        });
      }
    },
    onSuccess: () => {
      showToast("Viaje registrado ✓");
      queryClient.invalidateQueries({ queryKey: ["limones-mis-viajes"] });
      setOrigen("");
      setDestino("");
      setKmSalida("");
      setKmLlegada("");
      setLitrosGasoil("");
      setOrigenCombustible("BASE_TZ");
      setObservaciones("");
      setErrors([]);
    },
    onError: (e: Error) => {
      if (errors.length === 0) setErrors([e.message]);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  function handleCamionChange(vehicleId: string) {
    setCamionVehicleId(vehicleId);
    const u = unidades.find((u) => u.vehicleId === vehicleId);
    setCamionNombre(u?.vehicleLabel ?? "");
  }

  return (
    <div className="flex flex-col gap-6">
      <LimonesNav />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card>
          <p className="mb-4 text-sm font-semibold text-[var(--text)]">Registrar viaje</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha</label>
              <input
                type="date"
                className={inputCls}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Camión</label>
              <select
                className={inputCls}
                value={camionVehicleId}
                onChange={(e) => handleCamionChange(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {unidades.map((u) => (
                  <option key={u.vehicleId} value={u.vehicleId}>
                    {u.vehicleLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Origen</label>
              <input
                type="text"
                className={inputCls}
                placeholder="Finca / depósito..."
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Destino</label>
              <input
                type="text"
                className={inputCls}
                placeholder="Empaque / planta..."
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Km Salida</label>
              <input
                type="number"
                min="0"
                step="1"
                className={inputCls}
                placeholder="0"
                value={kmSalida}
                onChange={(e) => setKmSalida(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Km Llegada</label>
              <input
                type="number"
                min="0"
                step="1"
                className={inputCls}
                placeholder="0"
                value={kmLlegada}
                onChange={(e) => setKmLlegada(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Km Recorridos</label>
              <div className="flex h-11 items-center rounded-2xl border border-white/8 bg-white/5 px-3 text-sm font-semibold text-[var(--text)]">
                {kmRecorridos != null && Number.isFinite(kmRecorridos)
                  ? `${kmRecorridos} km`
                  : "—"}
              </div>
            </div>
          </div>
        </Card>

        {/* Gasoil */}
        <Card>
          <p className="mb-3 text-sm font-semibold text-[var(--text)]">Gasoil cargado (opcional)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Litros cargados</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className={inputCls}
                placeholder="Ej: 150"
                value={litrosGasoil}
                onChange={(e) => setLitrosGasoil(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Origen del combustible</label>
              <select
                className={inputCls}
                value={origenCombustible}
                onChange={(e) => setOrigenCombustible(e.target.value as LimonCombustibleOrigen)}
              >
                <option value="BASE_TZ">Base TZ</option>
                <option value="EXTERNA">Estación de servicio</option>
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <label className={labelCls}>Observaciones (opcional)</label>
          <textarea
            className="w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60 resize-none"
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </Card>

        {errors.length > 0 && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-red-300">{e}</p>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="h-12 w-full rounded-2xl bg-tz-yellow font-bold text-tz-black disabled:opacity-40"
        >
          {mutation.isPending ? "Guardando..." : "Registrar viaje"}
        </button>
      </form>
    </div>
  );
}
