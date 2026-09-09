import { useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  createZafraViaje,
  createLugar,
  createFrente,
  getLugares,
  getFrentes,
  getZafraConfig,
  getUnidadesActivas,
} from "../services/zafraApi";
import { ZafraNav } from "../components/ZafraNav";
import { Card } from "../components/Card";
import { Spinner } from "../components/Spinner";
import { showToast } from "../components/Toast";
import { CreatableCombobox } from "../components/CreatableCombobox";
import { moneyARS } from "../lib/format";
import { DEFAULT_CONFIG } from "../lib/zafraCalc";
import {
  inputCls,
  labelCls,
  ocrRing,
  primaryBtnCls,
  readonlyCls,
  textareaCls,
} from "../lib/formStyles";
import { useDocSlot } from "../hooks/useDocSlot";
import { buscarLugar } from "../lib/ocrMerge";
import {
  emptyValues,
  useZafraViajeForm,
  type OcrField,
} from "../hooks/useZafraViajeForm";

function OcrBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide bg-tz-yellow/20 text-tz-yellow">
      Auto
    </span>
  );
}

export function ZafraCargarPage() {
  const { currentDriver } = useAuth();
  const queryClient = useQueryClient();

  const [errors, setErrors] = useState<string[]>([]);
  const [mostrarVehiculo, setMostrarVehiculo] = useState(false);
  const [mostrarObs, setMostrarObs] = useState(false);

  const extractoCamRef = useRef<HTMLInputElement>(null);
  const extractoGalRef = useRef<HTMLInputElement>(null);
  const ordenCamRef = useRef<HTMLInputElement>(null);
  const ordenGalRef = useRef<HTMLInputElement>(null);

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
  // useMemo para que el ?? [] no devuelva un array nuevo en cada render y
  // dispare de más el cálculo de la sugerencia de lugar.
  const lugares = useMemo(() => lugaresQ.data?.lugares ?? [], [lugaresQ.data]);
  const frentes = useMemo(() => frentesQ.data?.frentes ?? [], [frentesQ.data]);

  const form = useZafraViajeForm({
    initial: emptyValues("PARTICULARES", currentDriver?.vehicleId ?? ""),
    config,
    lugares,
    frentes,
  });
  const { values, sources, set, montos } = form;

  const extracto = useDocSlot("extracto", form.applyOcr);
  const orden = useDocSlot("orden", form.applyOcr);

  const leyendo = extracto.slot.status === "reading" || orden.slot.status === "reading";
  const subiendo = extracto.slot.status === "uploading" || orden.slot.status === "uploading";

  // El camión propio del chofer, o el primero disponible si no tiene asignado.
  const camionId = values.camionVehicleId || unidades[0]?.vehicleId || "";
  const camionNombre =
    unidades.find((u) => u.vehicleId === camionId)?.vehicleLabel ??
    currentDriver?.vehicleLabel ??
    "";

  const mutation = useMutation({
    mutationFn: async () => {
      const errs = form.validate();
      if (errs.length) throw Object.assign(new Error("validation"), { validationErrors: errs });

      return createZafraViaje(
        form.buildCreateBody({
          driverId: currentDriver!.id,
          driverNombre: currentDriver!.name,
          camionId,
          camionNombre,
          fotos: {
            fotoRemitoUrl: extracto.slot.url,
            fotoGasoilUrl: orden.slot.url,
          },
        })
      );
    },
    onSuccess: () => {
      showToast("Viaje guardado correctamente", "success");
      form.reset(emptyValues(values.modalidad, values.camionVehicleId));
      extracto.clear();
      orden.clear();
      setMostrarObs(false);
      setErrors([]);
      queryClient.invalidateQueries({ queryKey: ["zafra"] });
    },
    onError: (err: unknown) => {
      const e = err as Error & { validationErrors?: string[] };
      if (e.validationErrors) setErrors(e.validationErrors);
      else showToast(e.message ?? "Error al guardar", "error");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);
    mutation.mutate();
  }

  function pick(slot: ReturnType<typeof useDocSlot>) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) slot.pick(file);
      // No se limpia el input hasta que la subida sale bien: si falla, el File
      // sigue en memoria y "Reintentar" no vuelve a abrir la cámara.
      e.target.value = "";
    };
  }

  // El remito trajo un origen que no se pudo resolver a un solo lugar: se lo
  // mostramos al chofer en vez de descartarlo en silencio.
  const sugerenciaLugar = useMemo(() => {
    if (!values.lugarTextoOcr || values.lugarId) return null;
    const r = buscarLugar(values.lugarTextoOcr, lugares);
    if (r.tipo === "unico") return null;
    return {
      texto: values.lugarTextoOcr,
      candidatos: r.candidatos,
      permitirCrear: r.permitirCrear,
    };
  }, [values.lugarTextoOcr, values.lugarId, lugares]);

  const crearLugarMut = useMutation({
    mutationFn: (nombre: string) => createLugar({ nombre }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["zafra-lugares"] });
      form.selectLugar(res.lugar.id, res.lugar.nombre, res.lugar.kmQuePagaIngenio ?? null);
      showToast("Lugar creado", "success");
    },
    onError: () => showToast("No se pudo crear el lugar", "error"),
  });

  const auto = (field: OcrField) =>
    sources[field] && sources[field] !== "manual" ? ocrRing : "";
  const badge = (field: OcrField) =>
    sources[field] && sources[field] !== "manual" ? <OcrBadge /> : null;

  return (
    <div className="flex flex-col gap-5">
      <ZafraNav />

      {/* iOS necesita inputs separados: con capture abre la cámara, sin capture el picker */}
      <input ref={extractoCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick(extracto)} />
      <input ref={extractoGalRef} type="file" accept="image/*" className="hidden" onChange={pick(extracto)} />
      <input ref={ordenCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick(orden)} />
      <input ref={ordenGalRef} type="file" accept="image/*" className="hidden" onChange={pick(orden)} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* ── Fotos ──────────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Documentos del viaje
          </p>
          <p className="mt-0.5 mb-3 text-xs text-[var(--muted)]">
            Sacá la foto y los datos se completan solos
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FotoSlot
              slot={extracto}
              titulo="Extracto de Pesaje"
              emoji="⚖️"
              obligatorio
              camRef={extractoCamRef}
              galRef={extractoGalRef}
            />
            <FotoSlot
              slot={orden}
              titulo="Orden de Carga"
              emoji="⛽"
              obligatorio={false}
              camRef={ordenCamRef}
              galRef={ordenGalRef}
            />
          </div>
        </div>

        {/* ── Estado de lectura ──────────────────────────────────────────── */}
        <div aria-live="polite">
          {leyendo && (
            <Card className="border-tz-yellow/30 bg-[rgba(240,199,95,0.06)]">
              <div className="flex items-center gap-3">
                <Spinner className="h-5 w-5" />
                <p className="text-base font-semibold text-tz-yellow">
                  Leyendo la información de la foto...
                </p>
              </div>
            </Card>
          )}
          {!leyendo && subiendo && (
            <Card>
              <div className="flex items-center gap-3">
                <Spinner className="h-5 w-5" />
                <p className="text-sm text-[var(--muted)]">Subiendo foto...</p>
              </div>
            </Card>
          )}

          {extracto.slot.status === "upload_error" && (
            <ErrorSubida titulo="extracto de pesaje" onRetry={extracto.retryUpload} />
          )}
          {orden.slot.status === "upload_error" && (
            <ErrorSubida titulo="orden de carga" onRetry={orden.retryUpload} />
          )}
          {extracto.slot.status === "ocr_failed" && (
            <ErrorLectura
              titulo="extracto de pesaje"
              onRetry={extracto.retryOcr}
              onDismiss={extracto.dismissOcrError}
            />
          )}
          {orden.slot.status === "ocr_failed" && (
            <ErrorLectura
              titulo="orden de carga"
              onRetry={orden.retryOcr}
              onDismiss={orden.dismissOcrError}
            />
          )}
        </div>

        {/* ── Datos a verificar ──────────────────────────────────────────── */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Verificá los datos
          </p>

          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>
                Fecha
                {badge("fecha")}
              </label>
              <input
                type="date"
                value={values.fecha}
                onChange={(e) => set("fecha", e.target.value)}
                className={`${inputCls} ${auto("fecha")}`}
              />
            </div>

            <div>
              <label className={labelCls}>
                Lugar (origen)
                {badge("lugar")}
              </label>
              <CreatableCombobox
                items={lugares.map((l) => ({ id: l.id, label: l.nombre }))}
                value={values.lugarId}
                isLoading={lugaresQ.isLoading}
                placeholder="Buscá el lugar de carga..."
                className={`${inputCls} ${auto("lugar")}`}
                onSelect={(id, label) => {
                  const lugar = lugares.find((l) => l.id === id);
                  form.selectLugar(id, label, lugar?.kmQuePagaIngenio ?? null);
                }}
                onCreate={async (text) => {
                  try {
                    const res = await createLugar({ nombre: text });
                    queryClient.invalidateQueries({ queryKey: ["zafra-lugares"] });
                    return { id: res.lugar.id, label: res.lugar.nombre };
                  } catch {
                    showToast("Error al crear el lugar", "error");
                    throw new Error("create failed");
                  }
                }}
              />

              {sugerenciaLugar && (
                <div className="mt-2 rounded-2xl border border-tz-yellow/30 bg-[rgba(240,199,95,0.06)] p-3">
                  <p className="text-xs text-[var(--muted)]">El remito dice:</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--text)] break-words">
                    “{sugerenciaLugar.texto}”
                  </p>

                  {sugerenciaLugar.candidatos.length > 0 && (
                    <>
                      <p className="mt-2 mb-1 text-xs text-[var(--muted)]">
                        ¿Cuál de estos es?
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {sugerenciaLugar.candidatos.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() =>
                              form.selectLugar(l.id, l.nombre, l.kmQuePagaIngenio ?? null)
                            }
                            className="flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-left text-xs text-[var(--text)] hover:bg-white/10 transition-all"
                          >
                            <span className="break-words">{l.nombre}</span>
                            <span className="shrink-0 text-[10px] text-[var(--muted)]">
                              {l.kmQuePagaIngenio != null ? `${l.kmQuePagaIngenio} km` : "sin km"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {sugerenciaLugar.permitirCrear && (
                    <>
                      <p className="mt-2 mb-1.5 text-xs text-[var(--muted)]">
                        {sugerenciaLugar.candidatos.length > 0
                          ? "¿O es una finca nueva?"
                          : "No está en la lista."}
                      </p>
                      <button
                        type="button"
                        disabled={crearLugarMut.isPending}
                        onClick={() => crearLugarMut.mutate(sugerenciaLugar.texto)}
                        className="h-9 w-full rounded-xl border border-tz-yellow/40 bg-tz-yellow/10 px-3 text-xs font-medium text-tz-yellow disabled:opacity-60"
                      >
                        {crearLugarMut.isPending ? "Creando..." : "+ Crear este lugar"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>
                Frente
                {badge("frente")}
              </label>
              <CreatableCombobox
                items={frentes.map((f) => ({ id: f.id, label: f.numero }))}
                value={values.frenteId}
                isLoading={frentesQ.isLoading}
                placeholder="Buscá el frente..."

                className={`${inputCls} ${auto("frente")}`}
                onSelect={(id, label) => form.selectFrente(id, label)}
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

            {values.modalidad === "PARTICULARES" && (
              <div>
                <label className={labelCls}>
                  Peso Neto (Kg) *
                  {badge("pesoNetoKg")}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={values.pesoNetoKg}
                  onChange={(e) => set("pesoNetoKg", e.target.value)}
                  placeholder="0"
                  className={`${inputCls} ${auto("pesoNetoKg")}`}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  N° Orden (extracto)
                  {badge("ordenRemitoNumero")}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={values.ordenRemitoNumero}
                  onChange={(e) => set("ordenRemitoNumero", e.target.value)}
                  placeholder="ej. 216266"
                  className={`${inputCls} ${auto("ordenRemitoNumero")}`}
                />
              </div>
              <div>
                <label className={labelCls}>
                  N° Orden de carga
                  {badge("ordenCargaNumero")}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={values.ordenCargaNumero}
                  onChange={(e) => set("ordenCargaNumero", e.target.value)}
                  placeholder="ej. 216266"
                  className={`${inputCls} ${auto("ordenCargaNumero")}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Gasoil (L)
                  {badge("gasoil")}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={values.gasoil}
                  onChange={(e) => set("gasoil", e.target.value)}
                  placeholder="0"
                  className={`${inputCls} ${auto("gasoil")}`}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Ingenio (destino)
                  {badge("ingenioNombre")}
                </label>
                <input
                  type="text"
                  value={values.ingenioNombre}
                  onChange={(e) => set("ingenioNombre", e.target.value)}
                  placeholder="Ej: Cruz Alta"
                  className={`${inputCls} ${auto("ingenioNombre")}`}
                />
              </div>
            </div>
          </div>

          {/* Vehículo: casi nunca cambia, va colapsado */}
          <div className="mt-4 border-t border-white/8 pt-3">
            {!mostrarVehiculo ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--muted)] capitalize truncate">
                  {values.modalidad.toLowerCase()} · {camionNombre || "—"} ·{" "}
                  {currentDriver?.name ?? ""}
                </p>
                <button
                  type="button"
                  onClick={() => setMostrarVehiculo(true)}
                  className="shrink-0 text-xs text-tz-yellow underline underline-offset-2"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Modalidad</label>
                  <select
                    value={values.modalidad}
                    onChange={(e) => set("modalidad", e.target.value)}
                    className={inputCls}
                  >
                    <option value="PARTICULARES">Particulares</option>
                    <option value="AMARILLOS">Amarillos</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Camión</label>
                  {unidades.length > 0 ? (
                    <select
                      value={camionId}
                      onChange={(e) => set("camionVehicleId", e.target.value)}
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
            )}
          </div>

          {/* Observaciones: se usan en 1 de cada 5 viajes */}
          <div className="mt-3">
            {!mostrarObs ? (
              <button
                type="button"
                onClick={() => setMostrarObs(true)}
                className="text-xs text-[var(--muted)] underline underline-offset-2"
              >
                + Agregar observación
              </button>
            ) : (
              <>
                <label className={labelCls}>Observaciones</label>
                <textarea
                  value={values.observaciones}
                  onChange={(e) => set("observaciones", e.target.value)}
                  rows={3}
                  placeholder="Opcional..."
                  className={textareaCls}
                />
              </>
            )}
          </div>
        </Card>

        {/* ── Comisión ───────────────────────────────────────────────────── */}
        <Card className="border-tz-yellow/20 bg-[rgba(240,199,95,0.04)]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-tz-yellow">
            Tu comisión estimada
          </p>
          {montos.comisionChofer != null ? (
            <p className="font-display text-3xl font-bold text-tz-yellow">
              {moneyARS(montos.comisionChofer)}
            </p>
          ) : (
            <>
              <p className="text-base font-semibold text-[var(--muted)]">
                Comisión a confirmar por oficina
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {montos.motivoSinMonto === "sin_km_lugar"
                  ? values.lugarNombre
                    ? `Faltan configurar los km de "${values.lugarNombre}".`
                    : "Elegí el lugar de origen para calcular la comisión."
                  : "Cargá el peso neto para calcular la comisión."}
              </p>
            </>
          )}
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

        {!extracto.slot.url && (
          <p className="text-center text-xs text-[var(--muted)]">
            Podés guardar sin la foto del extracto, pero conviene adjuntarla.
          </p>
        )}

        <button type="submit" disabled={mutation.isPending} className={primaryBtnCls}>
          {mutation.isPending ? "Guardando..." : "Guardar viaje"}
        </button>
      </form>
    </div>
  );
}

function FotoSlot({
  slot,
  titulo,
  emoji,
  obligatorio,
  camRef,
  galRef,
}: {
  slot: ReturnType<typeof useDocSlot>;
  titulo: string;
  emoji: string;
  obligatorio: boolean;
  camRef: React.RefObject<HTMLInputElement | null>;
  galRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { status, previewUrl } = slot.slot;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--text)]">
          {titulo}
          {obligatorio ? <span className="text-tz-yellow"> *</span> : (
            <span className="text-[var(--muted)]"> (opcional)</span>
          )}
        </p>
        {previewUrl && (
          <button
            type="button"
            onClick={slot.clear}
            className="text-xs text-[var(--muted)] hover:text-[var(--text)] leading-none px-1"
            aria-label={`Quitar ${titulo}`}
          >
            ✕
          </button>
        )}
      </div>

      <div className="relative">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={titulo}
            className="h-36 w-full rounded-2xl object-cover border border-white/15"
          />
        ) : (
          <div className="flex h-36 items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/3">
            <span className="text-3xl">{emoji}</span>
          </div>
        )}
        {slot.busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/60">
            <Spinner className="h-6 w-6" />
            <span className="text-[11px] font-medium text-tz-yellow">
              {status === "uploading" ? "Subiendo..." : "Leyendo..."}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={slot.busy}
          onClick={() => camRef.current?.click()}
          className="h-11 rounded-2xl border border-white/20 bg-white/5 text-xs font-medium text-[var(--text)] hover:bg-white/10 disabled:opacity-50 transition-all"
        >
          📷 Cámara
        </button>
        <button
          type="button"
          disabled={slot.busy}
          onClick={() => galRef.current?.click()}
          className="h-11 rounded-2xl border border-white/20 bg-white/5 text-xs font-medium text-[var(--text)] hover:bg-white/10 disabled:opacity-50 transition-all"
        >
          🖼️ Galería
        </button>
      </div>
    </div>
  );
}

// ─── Avisos ──────────────────────────────────────────────────────────────────

function ErrorSubida({ titulo, onRetry }: { titulo: string; onRetry: () => void }) {
  return (
    <Card className="border-tz-red/30 bg-tz-red/10">
      <p className="text-sm text-tz-red">No se pudo subir la foto del {titulo}.</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        No perdiste nada de lo que cargaste.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 h-9 rounded-xl border border-tz-red/40 bg-tz-red/10 px-4 text-xs font-medium text-tz-red"
      >
        Reintentar
      </button>
    </Card>
  );
}

function ErrorLectura({
  titulo,
  onRetry,
  onDismiss,
}: {
  titulo: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="border-tz-yellow/30 bg-[rgba(240,199,95,0.06)]">
      <p className="text-sm text-[var(--text)]">
        No se pudo leer el {titulo}. La foto se guardó igual.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="h-9 rounded-xl border border-tz-yellow/40 bg-tz-yellow/10 px-4 text-xs font-medium text-tz-yellow"
        >
          Reintentar lectura
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="h-9 rounded-xl border border-white/15 px-4 text-xs font-medium text-[var(--muted)]"
        >
          Completar a mano
        </button>
      </div>
    </Card>
  );
}
