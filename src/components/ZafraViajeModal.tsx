import { useState, useMemo, useRef, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  updateZafraViaje,
  deleteZafraViaje,
  getLugares,
  getFrentes,
  getZafraConfig,
  getUnidadesActivas,
  uploadZafraFoto,
  createLugar,
  createFrente,
  type ZafraViaje,
  type ZafraModalidad,
  type ZafraConfig,
} from "../services/zafraApi";
import { showToast } from "./Toast";
import { Card } from "./Card";
import { CreatableCombobox } from "./CreatableCombobox";
import { moneyARS, dateAR } from "../lib/format";

// ─── Helpers (same as ZafraCargarPage) ───────────────────────────────────────

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
};

function asNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function calcParticulares(params: {
  kmIngenioFinca: number;
  kmPagaIngenio?: number | null;
  pesoNetoKg: number;
  tarifaBase: number;
  tarifaPorKm: number;
  porcentajeComision: number;
}) {
  const { kmIngenioFinca, kmPagaIngenio, pesoNetoKg, tarifaBase, tarifaPorKm, porcentajeComision } =
    params;
  const kmParaFormula = kmPagaIngenio ?? kmIngenioFinca;
  const valorUnitario = tarifaBase + tarifaPorKm * kmParaFormula;
  const valorTotal = valorUnitario * (pesoNetoKg / 1000);
  const comisionChofer = valorTotal * porcentajeComision;
  return { valorUnitario, valorTotal, comisionChofer };
}

const inputCls =
  "h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60";
const labelCls = "mb-1 block text-xs text-[var(--muted)]";

// ─── Component ───────────────────────────────────────────────────────────────

type Mode = "view" | "edit" | "confirm-delete";

interface Props {
  viaje: ZafraViaje;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function ZafraViajeModal({ viaje, onClose, onUpdated, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("view");

  // ── Edit form state (initialized from viaje) ──────────────────────────────
  const [modalidad, setModalidad] = useState<ZafraModalidad>(viaje.modalidad);
  const [fecha, setFecha] = useState(viaje.fecha);
  const [camionVehicleId, setCamionVehicleId] = useState(viaje.camionId);
  const [lugarId, setLugarId] = useState(viaje.lugarId ?? "");
  const [lugarNombre, setLugarNombre] = useState(viaje.lugarNombre ?? "");
  const [lugarKmPagaIngenio, setLugarKmPagaIngenio] = useState<number | null>(
    viaje.kmPagaIngenioSnapshot ?? null
  );
  const [frenteId, setFrenteId] = useState(viaje.frenteId ?? "");
  const [frenteNumero, setFrenteNumero] = useState(viaje.frenteNumero ?? "");
  const [kmSalida, setKmSalida] = useState(viaje.kmSalida != null ? String(viaje.kmSalida) : "");
  const [kmLlegada, setKmLlegada] = useState(
    viaje.kmLlegada != null ? String(viaje.kmLlegada) : ""
  );
  const [gasoil, setGasoil] = useState(String(viaje.gasoil));
  const [pesoNetoKg, setPesoNetoKg] = useState(
    viaje.pesoNetoKg != null ? String(viaje.pesoNetoKg) : ""
  );
  const [observaciones, setObservaciones] = useState(viaje.observaciones ?? "");
  const [fotoRemitoUrl, setFotoRemitoUrl] = useState<string | null>(viaje.fotoRemitoUrl ?? null);
  const [fotoGasoilUrl, setFotoGasoilUrl] = useState<string | null>(viaje.fotoGasoilUrl ?? null);
  const [uploadingRemito, setUploadingRemito] = useState(false);
  const [uploadingGasoil, setUploadingGasoil] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const remitoInputRef = useRef<HTMLInputElement>(null);
  const remitoGaleriaRef = useRef<HTMLInputElement>(null);
  const gasoilInputRef = useRef<HTMLInputElement>(null);
  const gasoilGaleriaRef = useRef<HTMLInputElement>(null);

  // ── Data queries (same query keys as ZafraCargarPage — shares cache) ──────
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

  const config = configQ.data?.config ?? DEFAULT_CONFIG;
  const unidades = unidadesQ.data?.unidades ?? [];
  const resolvedConfig = config.particulares;

  const selectedUnidad = unidades.find((u) => u.vehicleId === camionVehicleId);
  const requiereOdometro = selectedUnidad?.tieneOdometro !== false;

  // ── Commission calculation ────────────────────────────────────────────────
  const kmSalidaN = asNum(kmSalida);
  const kmLlegadaN = asNum(kmLlegada);
  const kmRecorridos =
    Number.isFinite(kmLlegadaN) && Number.isFinite(kmSalidaN)
      ? Math.max(0, kmLlegadaN - kmSalidaN)
      : 0;
  const kmIngenioFinca = kmRecorridos / 2;
  const kmEfectivo = lugarKmPagaIngenio ?? kmIngenioFinca;
  const pesoN = asNum(pesoNetoKg);

  const calcs = useMemo(() => {
    if (modalidad !== "PARTICULARES" || !Number.isFinite(pesoN) || pesoN <= 0) return null;
    return calcParticulares({
      kmIngenioFinca: kmEfectivo,
      pesoNetoKg: pesoN,
      tarifaBase: resolvedConfig.tarifaBase,
      tarifaPorKm: resolvedConfig.tarifaPorKm,
      porcentajeComision: resolvedConfig.porcentajeComision,
    });
  }, [modalidad, kmEfectivo, pesoN, resolvedConfig]);

  // ── Photo upload handlers ─────────────────────────────────────────────────
  async function handleRemitoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRemito(true);
    try {
      const res = await uploadZafraFoto(file, "remito");
      setFotoRemitoUrl(res.url);
      showToast("Extracto actualizado", "success");
    } catch {
      showToast("Error al subir foto del extracto", "error");
    } finally {
      setUploadingRemito(false);
      e.target.value = "";
    }
  }

  async function handleGasoilFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingGasoil(true);
    try {
      const res = await uploadZafraFoto(file, "gasoil");
      setFotoGasoilUrl(res.url);
      showToast("Orden actualizada", "success");
    } catch {
      showToast("Error al subir foto de la orden", "error");
    } finally {
      setUploadingGasoil(false);
      e.target.value = "";
    }
  }

  // ── Edit mutation ─────────────────────────────────────────────────────────
  const editMutation = useMutation({
    mutationFn: async () => {
      const errs: string[] = [];
      if (requiereOdometro) {
        if (!kmSalida) errs.push("KmSalida es obligatorio.");
        if (!kmLlegada) errs.push("KmLlegada es obligatorio.");
        const kmS = asNum(kmSalida);
        const kmL = asNum(kmLlegada);
        if (Number.isFinite(kmS) && Number.isFinite(kmL) && kmL <= kmS)
          errs.push("KmLlegada debe ser mayor que KmSalida.");
      }
      if (modalidad === "PARTICULARES") {
        const p = asNum(pesoNetoKg);
        if (!Number.isFinite(p) || p <= 0) errs.push("PesoNetoKg debe ser mayor a 0 para Particulares.");
      }
      const gasoilN = asNum(gasoil);
      if (!Number.isFinite(gasoilN) || gasoilN < 0) errs.push("Gasoil debe ser >= 0.");
      if (errs.length) throw Object.assign(new Error("validation"), { validationErrors: errs });

      const camionNombre =
        unidades.find((u) => u.vehicleId === camionVehicleId)?.vehicleLabel ??
        viaje.camionNombre;

      const body = {
        modalidad,
        fecha,
        camionId: camionVehicleId,
        camionNombre,
        lugarId: lugarId || null,
        lugarNombre: lugarNombre || null,
        frenteId: frenteId || null,
        frenteNumero: frenteNumero || null,
        kmSalida: requiereOdometro && kmSalida ? asNum(kmSalida) : null,
        kmLlegada: requiereOdometro && kmLlegada ? asNum(kmLlegada) : null,
        gasoil: gasoilN,
        pesoNetoKg: modalidad === "PARTICULARES" ? pesoN : null,
        observaciones: observaciones.trim() || null,
        fotoRemitoUrl: fotoRemitoUrl || null,
        fotoGasoilUrl: fotoGasoilUrl || null,
        kmPagaIngenioSnapshot: lugarKmPagaIngenio ?? undefined,
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
        ...(modalidad === "AMARILLOS"
          ? { comisionChofer: config.amarillos.tarifaPorViajeConductor }
          : {}),
      };

      return updateZafraViaje(viaje.id, body);
    },
    onSuccess: () => {
      showToast("Viaje actualizado", "success");
      queryClient.invalidateQueries({ queryKey: ["zafra"] });
      onUpdated();
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

  // ── Delete mutation ───────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => deleteZafraViaje(viaje.id),
    onSuccess: () => {
      showToast("Viaje eliminado", "success");
      queryClient.invalidateQueries({ queryKey: ["zafra"] });
      onDeleted();
    },
    onError: (err: unknown) => {
      const e = err as Error;
      showToast(e.message ?? "Error al eliminar", "error");
      setMode("view");
    },
  });

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);
    editMutation.mutate();
  }

  // ── Derived display values for view mode ──────────────────────────────────
  const kmEfectivoView = viaje.kmPagaIngenioSnapshot ?? viaje.kmIngenioFinca;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center p-4">
      <div className="w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#0a0c0f] p-6 shadow-xl max-h-[90vh]">

        {/* Hidden file inputs */}
        <input ref={remitoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleRemitoFile} />
        <input ref={remitoGaleriaRef} type="file" accept="image/*" className="hidden" onChange={handleRemitoFile} />
        <input ref={gasoilInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleGasoilFile} />
        <input ref={gasoilGaleriaRef} type="file" accept="image/*" className="hidden" onChange={handleGasoilFile} />

        {/* ── VIEW MODE ─────────────────────────────────────────────────────── */}
        {mode === "view" && (
          <>
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <p className="font-semibold text-[var(--text)]">
                <span className="text-tz-yellow font-bold mr-1">Viaje</span>
                {dateAR(viaje.fecha)}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="text-[var(--muted)] hover:text-[var(--text)] transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Comisión destacada */}
            {viaje.comisionChofer != null && (
              <div className="mb-4 rounded-2xl border border-tz-yellow/20 bg-[rgba(240,199,95,0.04)] px-4 py-3">
                <p className="text-xs text-[var(--muted)] mb-0.5">Tu comisión</p>
                <p className="font-display text-3xl font-bold text-tz-yellow">
                  {moneyARS(viaje.comisionChofer)}
                </p>
                {viaje.modalidad === "AMARILLOS" && (
                  <p className="text-xs text-[var(--muted)] mt-0.5">pago por viaje</p>
                )}
              </div>
            )}

            {/* Detalles */}
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">Modalidad</p>
                  <p className="text-[var(--text)] capitalize">{viaje.modalidad.toLowerCase()}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Camión</p>
                  <p className="text-[var(--text)]">{viaje.camionNombre}</p>
                </div>
              </div>

              {(viaje.lugarNombre || viaje.frenteNumero) && (
                <div className="grid grid-cols-2 gap-3">
                  {viaje.lugarNombre && (
                    <div>
                      <p className="text-xs text-[var(--muted)]">Lugar</p>
                      <p className="text-[var(--text)]">{viaje.lugarNombre}</p>
                    </div>
                  )}
                  {viaje.frenteNumero && (
                    <div>
                      <p className="text-xs text-[var(--muted)]">Frente</p>
                      <p className="text-[var(--text)]">{viaje.frenteNumero}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">Odómetro</p>
                  <p className="text-[var(--text)]">
                    {viaje.kmSalida} → {viaje.kmLlegada}
                    {viaje.kmRecorridos != null && (
                      <span className="ml-1 text-xs text-[var(--muted)]">({viaje.kmRecorridos} km)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Km ingenio</p>
                  <p className="text-[var(--text)]">{kmEfectivoView} km</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">Gasoil</p>
                  <p className="text-[var(--text)]">{viaje.gasoil} L</p>
                </div>
                {viaje.pesoNetoKg != null && (
                  <div>
                    <p className="text-xs text-[var(--muted)]">Peso neto</p>
                    <p className="text-[var(--text)]">{viaje.pesoNetoKg.toLocaleString("es-AR")} kg</p>
                  </div>
                )}
              </div>

              {viaje.observaciones && (
                <div>
                  <p className="text-xs text-[var(--muted)]">Observaciones</p>
                  <p className="text-[var(--text)]">{viaje.observaciones}</p>
                </div>
              )}

              {/* Fotos */}
              {(viaje.fotoRemitoUrl || viaje.fotoGasoilUrl) && (
                <div>
                  <p className="text-xs text-[var(--muted)] mb-2">Documentos</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-[var(--muted)]">Extracto de Pesaje</p>
                      {viaje.fotoRemitoUrl ? (
                        <a href={viaje.fotoRemitoUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={viaje.fotoRemitoUrl}
                            alt="Extracto de pesaje"
                            className="h-28 w-full rounded-xl object-cover border border-white/15 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ) : (
                        <div className="h-28 rounded-xl border border-dashed border-white/15 flex items-center justify-center">
                          <p className="text-xs text-[var(--muted)]">Sin foto</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-[var(--muted)]">Orden de Carga</p>
                      {viaje.fotoGasoilUrl ? (
                        <a href={viaje.fotoGasoilUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={viaje.fotoGasoilUrl}
                            alt="Orden de carga"
                            className="h-28 w-full rounded-xl object-cover border border-white/15 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ) : (
                        <div className="h-28 rounded-xl border border-dashed border-white/15 flex items-center justify-center">
                          <p className="text-xs text-[var(--muted)]">Sin foto</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("confirm-delete")}
                className="h-11 rounded-2xl border border-tz-red/40 text-sm font-semibold text-tz-red hover:bg-tz-red/10 transition-colors"
              >
                Eliminar
              </button>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="h-11 rounded-2xl bg-tz-yellow text-sm font-bold text-tz-black hover:brightness-105 transition-all"
              >
                Editar
              </button>
            </div>
          </>
        )}

        {/* ── CONFIRM DELETE MODE ───────────────────────────────────────────── */}
        {mode === "confirm-delete" && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="font-semibold text-[var(--text)]">Eliminar viaje</p>
              <button
                type="button"
                onClick={onClose}
                className="text-[var(--muted)] hover:text-[var(--text)] transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-[var(--muted)] mb-2">
              ¿Eliminar el viaje del <span className="text-[var(--text)] font-medium">{dateAR(viaje.fecha)}</span>?
            </p>
            <p className="text-sm text-tz-red mb-6">Esta acción no se puede deshacer.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("view")}
                className="h-11 rounded-2xl border border-white/15 text-sm font-semibold text-[var(--text)] hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="h-11 rounded-2xl bg-tz-red text-sm font-bold text-white hover:brightness-105 disabled:opacity-60 disabled:pointer-events-none transition-all"
              >
                {deleteMutation.isPending ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </>
        )}

        {/* ── EDIT MODE ─────────────────────────────────────────────────────── */}
        {mode === "edit" && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="font-semibold text-[var(--text)]">Editar viaje</p>
              <button
                type="button"
                onClick={onClose}
                className="text-[var(--muted)] hover:text-[var(--text)] transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">

              {/* Fotos */}
              <Card>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Documentos
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Extracto de Pesaje */}
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-[var(--text)]">Extracto de Pesaje</p>
                    {fotoRemitoUrl ? (
                      <img
                        src={fotoRemitoUrl}
                        alt="Extracto de pesaje"
                        className="h-24 w-full rounded-xl object-cover border border-white/15"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-white/3">
                        <span className="text-2xl">⚖️</span>
                      </div>
                    )}
                    {uploadingRemito ? (
                      <div className="h-9 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs text-tz-yellow animate-pulse">
                        Subiendo...
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button type="button" onClick={() => remitoInputRef.current?.click()}
                          className="h-9 rounded-xl border border-white/20 bg-white/5 text-[10px] font-medium text-[var(--text)] hover:bg-white/10 transition-all">
                          📷
                        </button>
                        <button type="button" onClick={() => remitoGaleriaRef.current?.click()}
                          className="h-9 rounded-xl border border-white/20 bg-white/5 text-[10px] font-medium text-[var(--text)] hover:bg-white/10 transition-all">
                          🖼️
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Orden de Carga */}
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-[var(--text)]">Orden de Carga</p>
                    {fotoGasoilUrl ? (
                      <img
                        src={fotoGasoilUrl}
                        alt="Orden de carga"
                        className="h-24 w-full rounded-xl object-cover border border-white/15"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-white/3">
                        <span className="text-2xl">⛽</span>
                      </div>
                    )}
                    {uploadingGasoil ? (
                      <div className="h-9 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs text-tz-yellow animate-pulse">
                        Subiendo...
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button type="button" onClick={() => gasoilInputRef.current?.click()}
                          className="h-9 rounded-xl border border-white/20 bg-white/5 text-[10px] font-medium text-[var(--text)] hover:bg-white/10 transition-all">
                          📷
                        </button>
                        <button type="button" onClick={() => gasoilGaleriaRef.current?.click()}
                          className="h-9 rounded-xl border border-white/20 bg-white/5 text-[10px] font-medium text-[var(--text)] hover:bg-white/10 transition-all">
                          🖼️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Odómetro */}
              <Card>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Odómetro
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Km Salida {requiereOdometro ? "*" : "(opcional)"}</label>
                    <input
                      type="number"
                      value={kmSalida}
                      onChange={(e) => setKmSalida(e.target.value)}
                      placeholder="0"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Km Llegada {requiereOdometro ? "*" : "(opcional)"}</label>
                    <input
                      type="number"
                      value={kmLlegada}
                      onChange={(e) => setKmLlegada(e.target.value)}
                      placeholder="0"
                      className={inputCls}
                    />
                  </div>
                </div>
                {kmRecorridos > 0 && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Km recorridos: <span className="font-semibold text-[var(--text)]">{kmRecorridos}</span>
                    {" "}· Km ingenio/finca: <span className="font-semibold text-[var(--text)]">{kmIngenioFinca}</span>
                    {lugarKmPagaIngenio != null && (
                      <span className="ml-2 text-tz-yellow font-semibold">
                        · Km paga ingenio: {lugarKmPagaIngenio}
                      </span>
                    )}
                  </p>
                )}
              </Card>

              {/* Datos del viaje */}
              <Card>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Datos del viaje
                </p>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Fecha</label>
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className={inputCls}
                      />
                    </div>
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
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Lugar</label>
                      <CreatableCombobox
                        items={(lugaresQ.data?.lugares ?? []).map((l) => ({ id: l.id, label: l.nombre }))}
                        value={lugarId}
                        isLoading={lugaresQ.isLoading}
                        className={inputCls}
                        onSelect={(id, label) => {
                          setLugarId(id);
                          setLugarNombre(label);
                          const lugar = (lugaresQ.data?.lugares ?? []).find((l) => l.id === id);
                          setLugarKmPagaIngenio(lugar?.kmQuePagaIngenio ?? null);
                        }}
                        onCreate={async (text) => {
                          try {
                            const res = await createLugar({ nombre: text });
                            queryClient.invalidateQueries({ queryKey: ["zafra-lugares"] });
                            setLugarKmPagaIngenio(null);
                            return { id: res.lugar.id, label: res.lugar.nombre };
                          } catch {
                            showToast("Error al crear el lugar", "error");
                            throw new Error("create failed");
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Frente</label>
                      <CreatableCombobox
                        items={(frentesQ.data?.frentes ?? []).map((f) => ({ id: f.id, label: f.numero }))}
                        value={frenteId}
                        isLoading={frentesQ.isLoading}
                        className={inputCls}
                        onSelect={(id, label) => { setFrenteId(id); setFrenteNumero(label); }}
                        onCreate={async (text) => {
                          try {
                            const res = await createFrente({ numero: text });
                            queryClient.invalidateQueries({ queryKey: ["zafra-frentes"] });
                            return { id: res.frente.id, label: res.frente.numero };
                          } catch {
                            showToast("Error al crear el frente", "error");
                            throw new Error("create failed");
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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

                  <div>
                    <label className={labelCls}>Camión</label>
                    {unidades.length > 0 ? (
                      <select
                        value={camionVehicleId}
                        onChange={(e) => setCamionVehicleId(e.target.value)}
                        className={inputCls}
                      >
                        {unidades.map((u) => (
                          <option key={u.vehicleId} value={u.vehicleId}>{u.vehicleLabel}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="h-11 w-full cursor-not-allowed rounded-2xl border border-white/8 bg-white/5 px-3 flex items-center text-[var(--muted)] text-sm">
                        {viaje.camionNombre}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Comisión estimada */}
              {modalidad === "PARTICULARES" && calcs && (
                <Card className="border-tz-yellow/20 bg-[rgba(240,199,95,0.04)]">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-tz-yellow">
                    Tu comisión estimada
                  </p>
                  <p className="font-display text-3xl font-bold text-tz-yellow">
                    {moneyARS(calcs.comisionChofer)}
                  </p>
                </Card>
              )}

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
                      <li key={i} className="text-sm text-tz-red">• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("view")}
                  className="h-11 rounded-2xl border border-white/15 text-sm font-semibold text-[var(--text)] hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="h-11 rounded-2xl bg-tz-yellow text-sm font-bold text-tz-black hover:brightness-105 disabled:opacity-60 disabled:pointer-events-none transition-all"
                >
                  {editMutation.isPending ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
