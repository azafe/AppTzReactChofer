import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  createLimonCarga,
  getUnidadesActivas,
  listMisCargas,
  patchCargaFoto,
  uploadLimonesFoto,
  type LimonCarga,
  type LimonCombustibleOrigen,
} from "../services/limonesApi";
import { LimonesNav } from "../components/LimonesNav";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { showToast } from "../components/Toast";
import { dateAR, monthRange, todayISO } from "../lib/format";

const inputCls =
  "h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60";
const labelCls = "mb-1 block text-xs text-[var(--muted)]";

// ─── Modal ────────────────────────────────────────────────────────────────────

function NuevaCargaModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { currentDriver } = useAuth();

  const [fecha, setFecha] = useState(todayISO());
  const [camionVehicleId, setCamionVehicleId] = useState(currentDriver?.vehicleId ?? "");
  const [camionNombre, setCamionNombre] = useState(currentDriver?.vehicleLabel ?? "");
  const [litros, setLitros] = useState("");
  const [kmOdometro, setKmOdometro] = useState("");
  const [origen, setOrigen] = useState<LimonCombustibleOrigen>("BASE_TZ");
  const [observaciones, setObservaciones] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const unidadesQ = useQuery({
    queryKey: ["limones-unidades"],
    queryFn: getUnidadesActivas,
    staleTime: 120_000,
  });
  const unidades = unidadesQ.data?.unidades ?? [];

  function handleCamionChange(vehicleId: string) {
    setCamionVehicleId(vehicleId);
    const u = unidades.find((u) => u.vehicleId === vehicleId);
    setCamionNombre(u?.vehicleLabel ?? "");
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const errs: string[] = [];
      if (!fecha) errs.push("Ingresá la fecha.");
      if (!camionVehicleId) errs.push("Seleccioná un camión.");
      const l = parseFloat(litros);
      if (!litros || !Number.isFinite(l) || l <= 0) errs.push("Ingresá los litros cargados.");
      const km = parseFloat(kmOdometro);
      if (!kmOdometro || !Number.isFinite(km) || km < 0) errs.push("Ingresá el km del odómetro.");
      if (errs.length > 0) { setErrors(errs); throw new Error(errs[0]); }
      setErrors([]);

      await createLimonCarga({
        fecha,
        choferId: currentDriver!.id,
        choferNombre: currentDriver!.name,
        camionId: camionVehicleId,
        camionNombre,
        litros: l,
        tanqueInicial: null,
        kmOdometro: km,
        origen,
        observaciones: observaciones.trim() || null,
        fotoRemitoUrl: fotoUrl || null,
      });
    },
    onSuccess: () => {
      showToast("Carga registrada ✓");
      onSaved();
      onClose();
    },
    onError: (e: Error) => {
      if (errors.length === 0) setErrors([e.message]);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center p-4">
      <div className="w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#0a0c0f] p-6 shadow-xl max-h-[90vh]">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-[var(--text)]">Nueva carga de combustible</p>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input
                type="date"
                className={inputCls}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Camión *</label>
              <select
                className={inputCls}
                value={camionVehicleId}
                onChange={(e) => handleCamionChange(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {unidades.map((u) => (
                  <option key={u.vehicleId} value={u.vehicleId}>{u.vehicleLabel}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Litros *</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className={inputCls}
                placeholder="Ej: 150"
                value={litros}
                onChange={(e) => setLitros(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Km odómetro *</label>
              <input
                type="number"
                min="0"
                step="1"
                className={inputCls}
                placeholder="Ej: 85000"
                value={kmOdometro}
                onChange={(e) => setKmOdometro(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Origen</label>
            <div className="flex gap-2">
              {(["BASE_TZ", "EXTERNA"] as LimonCombustibleOrigen[]).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setOrigen(op)}
                  className={`flex-1 h-11 rounded-2xl border text-sm font-semibold transition-colors ${
                    origen === op
                      ? "border-tz-yellow bg-tz-yellow/10 text-tz-yellow"
                      : "border-white/15 bg-[#0f1115] text-[var(--muted)]"
                  }`}
                >
                  {op === "BASE_TZ" ? "Base TZ" : "Externa"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Foto ticket (opcional)</label>
            <div className="flex items-center gap-3">
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const res = await uploadLimonesFoto(file, "limones-gasoil");
                    setFotoUrl(res.url);
                  } catch {
                    showToast("Error al subir la foto", "error");
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              {fotoUrl && (
                <img
                  src={fotoUrl}
                  alt="Ticket"
                  className="h-10 w-10 rounded-lg border border-white/15 object-cover"
                />
              )}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fotoInputRef.current?.click()}
                className="h-11 flex-1 rounded-2xl border border-white/15 bg-[#0f1115] text-sm text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {uploading ? "Subiendo..." : fotoUrl ? "Cambiar foto" : "Subir foto ticket"}
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Observaciones (opcional)</label>
            <textarea
              className="w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60 resize-none"
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

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
            {mutation.isPending ? "Guardando..." : "Registrar carga"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LimonesMisCargas() {
  const { currentDriver } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showModal, setShowModal] = useState(false);

  const { from, to } = monthRange(year, month);

  const cargasQ = useQuery({
    queryKey: ["limones-mis-cargas", currentDriver?.vehicleId, { from, to }],
    queryFn: () => listMisCargas({ camionId: currentDriver!.vehicleId!, from, to }),
    enabled: !!currentDriver?.vehicleId,
    staleTime: 60_000,
  });

  const cargas = cargasQ.data?.cargas ?? [];
  const totalLitros = cargas.reduce((s, c) => s + c.litros, 0);

  return (
    <div className="flex flex-col gap-6">
      <LimonesNav />

      <div className="flex items-center justify-between">
        <SectionTitle>Combustible</SectionTitle>
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => { setYear(y); setMonth(m); }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Cargas" value={cargas.length} />
        <StatCard label="Litros totales" value={totalLitros > 0 ? `${totalLitros.toFixed(0)} L` : "0 L"} />
      </div>

      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="h-12 w-full rounded-2xl bg-tz-yellow font-bold text-tz-black"
      >
        + Agregar carga
      </button>

      {cargasQ.isPending && <PageSpinner />}
      {cargasQ.isError && (
        <ErrorCard
          message="No se pudieron cargar las cargas"
          onRetry={() => cargasQ.refetch()}
        />
      )}
      {!cargasQ.isPending && cargas.length === 0 && (
        <EmptyState message="No tenés cargas este mes" />
      )}

      <div className="flex flex-col gap-3">
        {cargas.map((c) => (
          <CargaCard
            key={c.id}
            carga={c}
            onFotoUpdated={() =>
              queryClient.invalidateQueries({ queryKey: ["limones-mis-cargas"] })
            }
          />
        ))}
      </div>

      {showModal && (
        <NuevaCargaModal
          onClose={() => setShowModal(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["limones-mis-cargas"] })}
        />
      )}
    </div>
  );
}

// ─── Carga card ───────────────────────────────────────────────────────────────

function CargaCard({
  carga,
  onFotoUpdated,
}: {
  carga: LimonCarga;
  onFotoUpdated: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: (url: string | null) => patchCargaFoto(carga.id, url),
    onSuccess: () => {
      showToast("Foto guardada ✓");
      onFotoUpdated();
    },
    onError: () => showToast("Error al guardar la foto", "error"),
  });

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-[var(--text)]">{dateAR(carga.fecha)}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{carga.camionNombre}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
            <span>
              {carga.litros} L
              {carga.tanqueInicial != null && (
                <span className="ml-1 text-[var(--text)]">
                  (disponible: {(carga.litros + carga.tanqueInicial).toFixed(0)} L)
                </span>
              )}
            </span>
            <span>{carga.origen === "BASE_TZ" ? "Base TZ" : "Ext."}</span>
            <span>{carga.kmOdometro} km</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-xl font-bold text-tz-yellow">
            {carga.litros.toFixed(0)} L
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-white/5 pt-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
              const res = await uploadLimonesFoto(file, "limones-gasoil");
              mutation.mutate(res.url);
            } catch {
              showToast("Error al subir la foto", "error");
            } finally {
              setUploading(false);
              e.target.value = "";
            }
          }}
        />
        {carga.fotoRemitoUrl ? (
          <div className="flex items-center gap-3">
            <a href={carga.fotoRemitoUrl} target="_blank" rel="noreferrer">
              <img
                src={carga.fotoRemitoUrl}
                alt="Ticket gasoil"
                className="h-10 w-10 rounded-lg border border-white/15 object-cover"
              />
            </a>
            <button
              type="button"
              disabled={uploading || mutation.isPending}
              onClick={() => inputRef.current?.click()}
              className="text-xs text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"
            >
              Cambiar foto
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading || mutation.isPending}
            onClick={() => inputRef.current?.click()}
            className="h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] text-sm text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {uploading || mutation.isPending ? "Subiendo..." : "Subir foto ticket"}
          </button>
        )}
      </div>
    </Card>
  );
}
