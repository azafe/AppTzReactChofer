import { useState, useMemo, useRef, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  createZafraViaje,
  getLugares,
  getFrentes,
  getZafraConfig,
  getUnidadesActivas,
  uploadZafraFoto,
  listMisViajes,
  type ZafraModalidad,
  type ZafraConfig,
} from "../services/zafraApi";
import { ZafraNav } from "../components/ZafraNav";
import { Card } from "../components/Card";
import { showToast } from "../components/Toast";
import { moneyARS, todayISO } from "../lib/format";

const DEFAULT_CONFIG: ZafraConfig = {
  particulares: {
    tarifaBase: 1850,
    tarifaPorKm: 92.5,
    tarifaPorKmReducida: 46.25,
    porcentajeComision: 0.15,
  },
  amarillos: {
    gananciaDiariaOwner: 133333.33,
    tarifaDiariaConductor: 56000,
    tarifaPorViajeConductor: 12000,
  },
  camionOverrides: {},
};

function asNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function resolveConfig(camionId: string, config: ZafraConfig) {
  const override = config.camionOverrides?.[camionId];
  if (!override) return config.particulares;
  return { ...config.particulares, ...override };
}

function calcParticulares(params: {
  kmIngenioFinca: number;
  pesoNetoKg: number;
  tarifaBase: number;
  tarifaPorKm: number;
  porcentajeComision: number;
}) {
  const { kmIngenioFinca, pesoNetoKg, tarifaBase, tarifaPorKm, porcentajeComision } = params;
  const valorUnitario = tarifaBase + tarifaPorKm * kmIngenioFinca;
  const valorTotal = valorUnitario * (pesoNetoKg / 1000);
  const comisionChofer = valorTotal * porcentajeComision;
  return { valorUnitario, valorTotal, comisionChofer };
}

const inputCls =
  "h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60";
const readonlyCls =
  "h-11 w-full cursor-not-allowed rounded-2xl border border-white/8 bg-white/5 px-3 flex items-center text-[var(--muted)] text-sm";
const labelCls = "mb-1 block text-xs text-[var(--muted)]";

export function ZafraCargarPage() {
  const { currentDriver } = useAuth();
  const queryClient = useQueryClient();

  const [modalidad, setModalidad] = useState<ZafraModalidad>("PARTICULARES");
  const [fecha, setFecha] = useState(todayISO());
  const [camionVehicleId, setCamionVehicleId] = useState(currentDriver?.vehicleId ?? "");
  const [lugarId, setLugarId] = useState("");
  const [frenteId, setFrenteId] = useState("");
  const [kmSalida, setKmSalida] = useState("");
  const [kmLlegada, setKmLlegada] = useState("");
  const [gasoil, setGasoil] = useState("");
  const [pesoNetoKg, setPesoNetoKg] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [fotoRemitoUrl, setFotoRemitoUrl] = useState<string | null>(null);
  const [fotoGasoilUrl, setFotoGasoilUrl] = useState<string | null>(null);
  const [uploadingRemito, setUploadingRemito] = useState(false);
  const [uploadingGasoil, setUploadingGasoil] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const remitoInputRef = useRef<HTMLInputElement>(null);
  const gasoilInputRef = useRef<HTMLInputElement>(null);

  const configQ = useQuery({
    queryKey: ["zafra-config"],
    queryFn: getZafraConfig,
    staleTime: 60_000,
  });
  const unidadesQ = useQuery({
    queryKey: ["zafra-unidades"],
    queryFn: getUnidadesActivas,
    staleTime: 120_000,
  });
  const lugaresQ = useQuery({
    queryKey: ["zafra-lugares"],
    queryFn: getLugares,
    staleTime: 60_000,
  });
  const frentesQ = useQuery({
    queryKey: ["zafra-frentes"],
    queryFn: getFrentes,
    staleTime: 60_000,
  });

  // Auto-fill kmSalida from last viaje of this camion
  const lastViajeQ = useQuery({
    queryKey: ["zafra-last-viaje", currentDriver?.vehicleId],
    queryFn: async () => {
      if (!currentDriver?.vehicleId) return null;
      const res = await listMisViajes({ choferId: currentDriver.id, limit: 200 });
      const viajes = res.viajes ?? [];
      if (!viajes.length) return null;
      viajes.sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
        return a.id < b.id ? 1 : -1;
      });
      return viajes[0];
    },
    enabled: !!currentDriver,
    staleTime: 30_000,
  });

  // Pre-fill kmSalida on first load
  useState(() => {
    const last = lastViajeQ.data;
    if (last && !kmSalida) setKmSalida(String(last.kmLlegada));
  });

  const config = configQ.data?.config ?? DEFAULT_CONFIG;
  const unidades = unidadesQ.data?.unidades ?? [];
  const resolvedConfig = resolveConfig(camionVehicleId, config);

  const kmSalidaN = asNum(kmSalida);
  const kmLlegadaN = asNum(kmLlegada);
  const kmRecorridos =
    Number.isFinite(kmLlegadaN) && Number.isFinite(kmSalidaN)
      ? Math.max(0, kmLlegadaN - kmSalidaN)
      : 0;
  const kmIngenioFinca = kmRecorridos / 2;

  const pesoN = asNum(pesoNetoKg);
  const calcs = useMemo(() => {
    if (modalidad !== "PARTICULARES" || !Number.isFinite(pesoN) || pesoN <= 0) return null;
    return calcParticulares({
      kmIngenioFinca,
      pesoNetoKg: pesoN,
      tarifaBase: resolvedConfig.tarifaBase,
      tarifaPorKm: resolvedConfig.tarifaPorKm,
      porcentajeComision: resolvedConfig.porcentajeComision,
    });
  }, [modalidad, kmIngenioFinca, pesoN, resolvedConfig]);

  const lugarNombre = (lugaresQ.data?.lugares ?? []).find((l) => l.id === lugarId)?.nombre ?? "";
  const frenteNumero = (frentesQ.data?.frentes ?? []).find((f) => f.id === frenteId)?.numero ?? "";

  const mutation = useMutation({
    mutationFn: async () => {
      const errs: string[] = [];
      if (!kmSalida) errs.push("KmSalida es obligatorio.");
      if (!kmLlegada) errs.push("KmLlegada es obligatorio.");
      const kmS = asNum(kmSalida);
      const kmL = asNum(kmLlegada);
      if (Number.isFinite(kmS) && Number.isFinite(kmL) && kmL <= kmS)
        errs.push("KmLlegada debe ser mayor que KmSalida.");
      if (modalidad === "PARTICULARES") {
        const p = asNum(pesoNetoKg);
        if (!Number.isFinite(p) || p <= 0) errs.push("PesoNetoKg debe ser mayor a 0 para Particulares.");
      }
      const gasoilN = asNum(gasoil);
      if (!Number.isFinite(gasoilN) || gasoilN < 0) errs.push("Gasoil debe ser >= 0.");
      if (errs.length) throw Object.assign(new Error("validation"), { validationErrors: errs });

      const camionNombre =
        unidades.find((u) => u.vehicleId === camionVehicleId)?.vehicleLabel ??
        currentDriver!.vehicleLabel ??
        "";

      const body = {
        modalidad,
        fecha,
        choferId: currentDriver!.id,
        choferNombre: currentDriver!.name,
        camionId: camionVehicleId || currentDriver!.vehicleId ?? "",
        camionNombre,
        lugarId: lugarId || null,
        lugarNombre: lugarNombre || null,
        frenteId: frenteId || null,
        frenteNumero: frenteNumero || null,
        kmSalida: kmS,
        kmLlegada: kmL,
        gasoil: gasoilN,
        pesoNetoKg: modalidad === "PARTICULARES" ? pesoN : null,
        observaciones: observaciones.trim() || null,
        fotoRemitoUrl: fotoRemitoUrl || null,
        fotoGasoilUrl: fotoGasoilUrl || null,
        ...(calcs
          ? {
              valorUnitarioARS: calcs.valorUnitario,
              valorTotalARS: calcs.valorTotal,
              comisionChofer: calcs.comisionChofer,
              tarifaBaseSnapshot: resolvedConfig.tarifaBase,
              tarifaPorKmSnapshot: resolvedConfig.tarifaPorKm,
              comisionPctSnapshot: resolvedConfig.porcentajeComision,
            }
          : {}),
      };

      return createZafraViaje(body);
    },
    onSuccess: (result) => {
      showToast("Viaje guardado correctamente", "success");
      // Advance kmSalida to the last kmLlegada
      setKmSalida(String(result.viaje.kmLlegada));
      setKmLlegada("");
      setGasoil("");
      setPesoNetoKg("");
      setObservaciones("");
      setFotoRemitoUrl(null);
      setFotoGasoilUrl(null);
      setErrors([]);
      queryClient.invalidateQueries({ queryKey: ["zafra"] });
      queryClient.invalidateQueries({ queryKey: ["zafra-last-viaje"] });
    },
    onError: (err: unknown) => {
      const e = err as Error & { validationErrors?: string[] };
      if (e.validationErrors) {
        setErrors(e.validationErrors);
      } else {
        showToast(e.message ?? "Error al guardar", "error");
      }
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);
    mutation.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <ZafraNav />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Datos base */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Datos del viaje
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Modalidad</label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as ZafraModalidad)}
                className={inputCls}
              >
                <option value="PARTICULARES">Particulares</option>
                <option value="AMARILLOS">Amarillos</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Chofer y camión */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Chofer</label>
              <div className={readonlyCls}>{currentDriver?.name ?? ""}</div>
            </div>
            <div>
              <label className={labelCls}>Camión</label>
              {unidades.length > 0 ? (
                <select
                  value={camionVehicleId}
                  onChange={(e) => setCamionVehicleId(e.target.value)}
                  className={inputCls}
                >
                  {unidades.map((u) => (
                    <option key={u.vehicleId} value={u.vehicleId}>
                      {u.vehicleLabel}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={readonlyCls}>{currentDriver?.vehicleLabel ?? "—"}</div>
              )}
            </div>
          </div>
        </Card>

        {/* Lugar y frente */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Lugar y frente
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Lugar</label>
              <select
                value={lugarId}
                onChange={(e) => setLugarId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Opcional —</option>
                {(lugaresQ.data?.lugares ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Frente</label>
              <select
                value={frenteId}
                onChange={(e) => setFrenteId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Opcional —</option>
                {(frentesQ.data?.frentes ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.numero}{f.nombre ? ` – ${f.nombre}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Odómetro y carga */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Odómetro y carga
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Km Salida *</label>
              <input
                type="number"
                value={kmSalida}
                onChange={(e) => setKmSalida(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Km Llegada *</label>
              <input
                type="number"
                value={kmLlegada}
                onChange={(e) => setKmLlegada(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Gasoil (L)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={gasoil}
                onChange={(e) => setGasoil(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
            {modalidad === "PARTICULARES" && (
              <div>
                <label className={labelCls}>Peso Neto (Kg) *</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pesoNetoKg}
                  onChange={(e) => setPesoNetoKg(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
            )}
          </div>
          {kmRecorridos > 0 && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Km recorridos: <span className="font-semibold text-[var(--text)]">{kmRecorridos}</span>
              {" "} · Km ingenio/finca: <span className="font-semibold text-[var(--text)]">{kmIngenioFinca}</span>
            </p>
          )}
        </Card>

        {/* Comisión en tiempo real — solo para PARTICULARES */}
        {modalidad === "PARTICULARES" && calcs && (
          <Card className="border-tz-yellow/20 bg-[rgba(240,199,95,0.04)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-tz-yellow">
              Tu comisión estimada
            </p>
            <p className="font-display text-3xl font-bold text-tz-yellow">
              {moneyARS(calcs.comisionChofer)}
            </p>
          </Card>
        )}

        {/* Documentación */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Documentación
          </p>
          <div className="flex flex-col gap-3">
            {/* Foto Remito */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm text-[var(--text)]">Foto de Remito <span className="text-xs text-[var(--muted)]">(opcional)</span></p>
              </div>
              <input
                ref={remitoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingRemito(true);
                  try {
                    const res = await uploadZafraFoto(file, "remito");
                    setFotoRemitoUrl(res.url);
                  } catch {
                    showToast("Error al subir foto de remito", "error");
                  } finally {
                    setUploadingRemito(false);
                    e.target.value = "";
                  }
                }}
              />
              {fotoRemitoUrl && (
                <img
                  src={fotoRemitoUrl}
                  alt="Remito"
                  className="h-10 w-10 rounded-lg object-cover border border-white/15"
                />
              )}
              <button
                type="button"
                disabled={uploadingRemito}
                onClick={() => remitoInputRef.current?.click()}
                className="h-9 rounded-xl border border-white/20 bg-white/5 px-3 text-xs font-medium text-[var(--text)] hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                {uploadingRemito ? "Subiendo..." : fotoRemitoUrl ? "Cambiar" : "📷 Subir"}
              </button>
            </div>

            {/* Foto Gasoil */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm text-[var(--text)]">Foto de Gasoil <span className="text-xs text-[var(--muted)]">(opcional)</span></p>
              </div>
              <input
                ref={gasoilInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingGasoil(true);
                  try {
                    const res = await uploadZafraFoto(file, "gasoil");
                    setFotoGasoilUrl(res.url);
                  } catch {
                    showToast("Error al subir foto de gasoil", "error");
                  } finally {
                    setUploadingGasoil(false);
                    e.target.value = "";
                  }
                }}
              />
              {fotoGasoilUrl && (
                <img
                  src={fotoGasoilUrl}
                  alt="Gasoil"
                  className="h-10 w-10 rounded-lg object-cover border border-white/15"
                />
              )}
              <button
                type="button"
                disabled={uploadingGasoil}
                onClick={() => gasoilInputRef.current?.click()}
                className="h-9 rounded-xl border border-white/20 bg-white/5 px-3 text-xs font-medium text-[var(--text)] hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                {uploadingGasoil ? "Subiendo..." : fotoGasoilUrl ? "Cambiar" : "📷 Subir"}
              </button>
            </div>
          </div>
        </Card>

        {/* Observaciones */}
        <Card>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Observaciones
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={3}
            placeholder="Opcional..."
            className="w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60 resize-none"
          />
        </Card>

        {errors.length > 0 && (
          <div className="rounded-2xl bg-tz-red/10 border border-tz-red/30 p-4">
            <ul className="flex flex-col gap-1">
              {errors.map((err, i) => (
                <li key={i} className="text-sm text-tz-red">
                  • {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="h-12 w-full rounded-xl bg-tz-yellow font-semibold text-tz-black hover:brightness-105 disabled:opacity-60 disabled:pointer-events-none transition-all"
        >
          {mutation.isPending ? "Guardando..." : "Guardar viaje"}
        </button>
      </form>
    </div>
  );
}
