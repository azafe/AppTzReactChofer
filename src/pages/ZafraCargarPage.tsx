import { useState, useMemo, useRef, type FormEvent } from "react";
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
  uploadZafraFoto,
  ocrZafraDocumento,
  listMisViajes,
  type ZafraModalidad,
  type ZafraConfig,
  type ZafraOcrResult,
} from "../services/zafraApi";
import { ZafraNav } from "../components/ZafraNav";
import { Card } from "../components/Card";
import { showToast } from "../components/Toast";
import { CreatableCombobox } from "../components/CreatableCombobox";
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
  const { kmIngenioFinca, kmPagaIngenio, pesoNetoKg, tarifaBase, tarifaPorKm, porcentajeComision } = params;
  const kmParaFormula = kmPagaIngenio ?? kmIngenioFinca;
  const valorUnitario = tarifaBase + tarifaPorKm * kmParaFormula;
  const valorTotal = valorUnitario * (pesoNetoKg / 1000);
  const comisionChofer = valorTotal * porcentajeComision;
  return { valorUnitario, valorTotal, comisionChofer };
}

const inputCls =
  "h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60";
const readonlyCls =
  "h-11 w-full cursor-not-allowed rounded-2xl border border-white/8 bg-white/5 px-3 flex items-center text-[var(--muted)] text-sm";
const labelCls = "mb-1 block text-xs text-[var(--muted)]";

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

  const [step, setStep] = useState<"docs" | "form">("docs");
  const [modalidad, setModalidad] = useState<ZafraModalidad>("PARTICULARES");
  const [fecha, setFecha] = useState(todayISO());
  const [camionVehicleId, setCamionVehicleId] = useState(currentDriver?.vehicleId ?? "");
  const [lugarId, setLugarId] = useState("");
  const [lugarNombre, setLugarNombre] = useState("");
  const [lugarKmPagaIngenio, setLugarKmPagaIngenio] = useState<number | null>(null);
  const [frenteId, setFrenteId] = useState("");
  const [frenteNumero, setFrenteNumero] = useState("");
  const [kmSalida, setKmSalida] = useState("");
  const [kmLlegada, setKmLlegada] = useState("");
  const [gasoil, setGasoil] = useState("");
  const [pesoNetoKg, setPesoNetoKg] = useState("");
  const [ingenioNombre, setIngenioNombre] = useState("");
  const [ordenCargaNumero, setOrdenCargaNumero] = useState("");
  const [ordenRemitoNumero, setOrdenRemitoNumero] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [fotoRemitoUrl, setFotoRemitoUrl] = useState<string | null>(null);
  const [fotoGasoilUrl, setFotoGasoilUrl] = useState<string | null>(null);
  const [uploadingRemito, setUploadingRemito] = useState(false);
  const [uploadingGasoil, setUploadingGasoil] = useState(false);
  const [ocrLoadingRemito, setOcrLoadingRemito] = useState(false);
  const [ocrLoadingOrden, setOcrLoadingOrden] = useState(false);
  const [ocrFilledFields, setOcrFilledFields] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<string[]>([]);

  const remitoInputRef = useRef<HTMLInputElement>(null);
  const remitoGaleriaRef = useRef<HTMLInputElement>(null);
  const gasoilInputRef = useRef<HTMLInputElement>(null);
  const gasoilGaleriaRef = useRef<HTMLInputElement>(null);

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

  useState(() => {
    const last = lastViajeQ.data;
    if (last && !kmSalida) setKmSalida(String(last.kmLlegada));
  });

  const config = configQ.data?.config ?? DEFAULT_CONFIG;
  const unidades = unidadesQ.data?.unidades ?? [];
  const resolvedConfig = config.particulares;

  const selectedUnidad = unidades.find((u) => u.vehicleId === camionVehicleId);
  const requiereOdometro = selectedUnidad?.tieneOdometro !== false;

  const kmSalidaN = asNum(kmSalida);
  const kmLlegadaN = asNum(kmLlegada);
  const kmRecorridos =
    Number.isFinite(kmLlegadaN) && Number.isFinite(kmSalidaN)
      ? Math.max(0, kmLlegadaN - kmSalidaN)
      : 0;
  const kmIngenioFinca = kmRecorridos / 2;
  // Km efectivo para el cálculo: usa el del lugar si está configurado, sino km odómetro / 2
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

  function clearOcr(field: string) {
    setOcrFilledFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  function applyOcrResult(result: ZafraOcrResult, source: "remito" | "gasoil") {
    const newFilled = new Set<string>();

    if (source === "remito" && result.pesoNetoKg !== undefined) {
      setPesoNetoKg(String(result.pesoNetoKg));
      newFilled.add("pesoNetoKg");
    }
    if (source === "gasoil" && result.gasoilLts !== undefined) {
      setGasoil(String(result.gasoilLts));
      newFilled.add("gasoil");
    }

    if (result.frenteNumero) {
      const frentes = frentesQ.data?.frentes ?? [];
      const match = frentes.find(
        (f) => f.numero.toLowerCase() === result.frenteNumero!.toLowerCase()
      );
      if (match && !frenteId) {
        setFrenteId(match.id);
        setFrenteNumero(match.numero);
        newFilled.add("frenteNumero");
      }
    }

    if (result.lugarNombre) {
      const lugares = lugaresQ.data?.lugares ?? [];
      const ocrLower = result.lugarNombre.toLowerCase();
      const match = lugares.find((l) => {
        const nombreLower = l.nombre.toLowerCase();
        return nombreLower.includes(ocrLower) || ocrLower.includes(nombreLower);
      });
      if (match && !lugarId) {
        setLugarId(match.id);
        setLugarNombre(match.nombre);
        setLugarKmPagaIngenio(match.kmQuePagaIngenio ?? null);
        newFilled.add("lugarNombre");
      }
    }

    if (result.ingenioNombre && !ingenioNombre) {
      setIngenioNombre(result.ingenioNombre);
      newFilled.add("ingenioNombre");
    }

    if (source === "gasoil" && result.ordenCargaNumero) {
      setOrdenCargaNumero(String(result.ordenCargaNumero));
      newFilled.add("ordenCargaNumero");
    }
    if (source === "remito" && result.ordenRemitoNumero) {
      setOrdenRemitoNumero(String(result.ordenRemitoNumero));
      newFilled.add("ordenRemitoNumero");
    }

    if (result.fecha && fecha === todayISO()) {
      const year = parseInt(result.fecha.slice(0, 4), 10);
      if (year >= 2025 && year <= 2030) {
        setFecha(result.fecha);
        newFilled.add("fecha");
      }
    }

    setOcrFilledFields((prev) => new Set([...prev, ...newFilled]));
  }

  const ocrBusy = ocrLoadingRemito || ocrLoadingOrden;

  const mutation = useMutation({
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
        currentDriver!.vehicleLabel ??
        "";

      const body = {
        modalidad,
        fecha,
        choferId: currentDriver!.id,
        choferNombre: currentDriver!.name,
        camionId: camionVehicleId || (currentDriver!.vehicleId ?? ""),
        camionNombre,
        lugarId: lugarId || null,
        lugarNombre: lugarNombre || null,
        frenteId: frenteId || null,
        frenteNumero: frenteNumero || null,
        kmSalida: requiereOdometro && kmSalida ? asNum(kmSalida) : null,
        kmLlegada: requiereOdometro && kmLlegada ? asNum(kmLlegada) : null,
        gasoil: gasoilN,
        pesoNetoKg: modalidad === "PARTICULARES" ? pesoN : null,
        ingenioNombre: ingenioNombre || null,
        ordenCargaNumero: ordenCargaNumero.trim() || null,
        ordenRemitoNumero: ordenRemitoNumero.trim() || null,
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
              kmPagaIngenioSnapshot: lugarKmPagaIngenio ?? undefined,
            }
          : {}),
        ...(modalidad === "AMARILLOS"
          ? { comisionChofer: config.amarillos.tarifaPorViajeConductor }
          : {}),
      };

      return createZafraViaje(body);
    },
    onSuccess: (result) => {
      showToast("Viaje guardado correctamente", "success");
      setStep("docs");
      setKmSalida(result.viaje.kmLlegada != null ? String(result.viaje.kmLlegada) : "");
      setKmLlegada("");
      setGasoil("");
      setPesoNetoKg("");
      setIngenioNombre("");
      setOrdenCargaNumero("");
      setOrdenRemitoNumero("");
      setLugarKmPagaIngenio(null);
      setObservaciones("");
      setFotoRemitoUrl(null);
      setFotoGasoilUrl(null);
      setOcrFilledFields(new Set());
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

  // ── Photo upload handlers (shared between steps) ───────────────────────────

  async function handleRemitoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRemito(true);
    try {
      const res = await uploadZafraFoto(file, "remito");
      setFotoRemitoUrl(res.url);
      setOcrLoadingRemito(true);
      try {
        const ocr = await ocrZafraDocumento(res.url, "extracto_pesaje");
        if (ocr.ok && ocr.data) {
          applyOcrResult(ocr.data, "remito");
          showToast("Datos del extracto detectados", "success");
        }
      } catch {
        showToast("No se pudo leer el extracto automáticamente", "error");
      } finally {
        setOcrLoadingRemito(false);
      }
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
      setOcrLoadingOrden(true);
      try {
        const ocr = await ocrZafraDocumento(res.url, "orden_carga");
        if (ocr.ok && ocr.data) {
          applyOcrResult(ocr.data, "gasoil");
          showToast("Datos de la orden detectados", "success");
        }
      } catch {
        showToast("No se pudo leer la orden automáticamente", "error");
      } finally {
        setOcrLoadingOrden(false);
      }
    } catch {
      showToast("Error al subir foto de la orden", "error");
    } finally {
      setUploadingGasoil(false);
      e.target.value = "";
    }
  }

  const remitoUploader = (
    <>
      <input ref={remitoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleRemitoFile} />
      <input ref={remitoGaleriaRef} type="file" accept="image/*" className="hidden" onChange={handleRemitoFile} />
    </>
  );

  const gasoilUploader = (
    <>
      <input ref={gasoilInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleGasoilFile} />
      <input ref={gasoilGaleriaRef} type="file" accept="image/*" className="hidden" onChange={handleGasoilFile} />
    </>
  );

  // ── Step 1: Documentos ─────────────────────────────────────────────────────

  if (step === "docs") {
    return (
      <div className="flex flex-col gap-6">
        <ZafraNav />
        {remitoUploader}
        {gasoilUploader}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Documentos del viaje
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Sacá foto a los documentos para completar el formulario automáticamente
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Extracto de Pesaje */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-[var(--text)]">Extracto de Pesaje</p>
            {fotoRemitoUrl ? (
              <img
                src={fotoRemitoUrl}
                alt="Extracto de pesaje"
                className="h-44 w-full rounded-2xl object-cover border border-white/15"
              />
            ) : (
              <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/3">
                <span className="text-3xl">⚖️</span>
              </div>
            )}
            {(uploadingRemito || ocrLoadingRemito) ? (
              <div className="h-11 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-tz-yellow animate-pulse">
                {ocrLoadingRemito ? "Leyendo..." : "Subiendo..."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => remitoInputRef.current?.click()}
                  className="h-11 rounded-2xl border border-white/20 bg-white/5 text-xs font-medium text-[var(--text)] hover:bg-white/10 transition-all">
                  📷 Cámara
                </button>
                <button type="button" onClick={() => remitoGaleriaRef.current?.click()}
                  className="h-11 rounded-2xl border border-white/20 bg-white/5 text-xs font-medium text-[var(--text)] hover:bg-white/10 transition-all">
                  🖼️ Galería
                </button>
              </div>
            )}
          </div>

          {/* Orden de Carga */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-[var(--text)]">Orden de Carga</p>
            {fotoGasoilUrl ? (
              <img
                src={fotoGasoilUrl}
                alt="Orden de carga"
                className="h-44 w-full rounded-2xl object-cover border border-white/15"
              />
            ) : (
              <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/3">
                <span className="text-3xl">⛽</span>
              </div>
            )}
            {(uploadingGasoil || ocrLoadingOrden) ? (
              <div className="h-11 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-tz-yellow animate-pulse">
                {ocrLoadingOrden ? "Leyendo..." : "Subiendo..."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => gasoilInputRef.current?.click()}
                  className="h-11 rounded-2xl border border-white/20 bg-white/5 text-xs font-medium text-[var(--text)] hover:bg-white/10 transition-all">
                  📷 Cámara
                </button>
                <button type="button" onClick={() => gasoilGaleriaRef.current?.click()}
                  className="h-11 rounded-2xl border border-white/20 bg-white/5 text-xs font-medium text-[var(--text)] hover:bg-white/10 transition-all">
                  🖼️ Galería
                </button>
              </div>
            )}
          </div>
        </div>

        {ocrBusy && (
          <p className="text-center text-sm text-tz-yellow animate-pulse">
            Detectando datos del documento...
          </p>
        )}

        <button
          type="button"
          disabled={ocrBusy}
          onClick={() => setStep("form")}
          className="h-12 w-full rounded-xl bg-tz-yellow font-semibold text-tz-black hover:brightness-105 disabled:opacity-60 disabled:pointer-events-none transition-all"
        >
          {ocrBusy ? "Leyendo documentos..." : "Continuar →"}
        </button>

        {!fotoRemitoUrl && !fotoGasoilUrl && (
          <button
            type="button"
            onClick={() => setStep("form")}
            className="text-center text-xs text-[var(--muted)] underline underline-offset-2"
          >
            Continuar sin documentos
          </button>
        )}
      </div>
    );
  }

  // ── Step 2: Formulario ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <ZafraNav />
      {remitoUploader}
      {gasoilUploader}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Fotos compactas */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep("docs")}
            className="text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            ← Documentos
          </button>
          <div className="flex gap-2 ml-auto">
            {fotoRemitoUrl ? (
              <img src={fotoRemitoUrl} alt="Extracto" className="h-10 w-16 rounded-lg object-cover border border-white/15 cursor-pointer" onClick={() => remitoInputRef.current?.click()} />
            ) : (
              <button type="button" onClick={() => remitoInputRef.current?.click()} className="h-10 w-16 rounded-lg border border-dashed border-white/20 text-[10px] text-[var(--muted)] hover:bg-white/5 transition-all">
                Extracto
              </button>
            )}
            {fotoGasoilUrl ? (
              <img src={fotoGasoilUrl} alt="Orden" className="h-10 w-16 rounded-lg object-cover border border-white/15 cursor-pointer" onClick={() => gasoilInputRef.current?.click()} />
            ) : (
              <button type="button" onClick={() => gasoilInputRef.current?.click()} className="h-10 w-16 rounded-lg border border-dashed border-white/20 text-[10px] text-[var(--muted)] hover:bg-white/5 transition-all">
                Orden
              </button>
            )}
          </div>
        </div>

        {/* ── Vehículo ─────────────────────────────────────────────── */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Vehículo
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
                <div className={readonlyCls}>{currentDriver?.vehicleLabel ?? "—"}</div>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Chofer</label>
              <div className={readonlyCls}>{currentDriver?.name ?? ""}</div>
            </div>
            <div>
              <label className={labelCls}>
                Lugar (origen)
                {ocrFilledFields.has("lugarNombre") && <OcrBadge />}
              </label>
              <CreatableCombobox
                items={(lugaresQ.data?.lugares ?? []).map((l) => ({ id: l.id, label: l.nombre }))}
                value={lugarId}
                isLoading={lugaresQ.isLoading}
                className={`${inputCls} ${ocrFilledFields.has("lugarNombre") ? "ring-2 ring-tz-yellow/40 border-tz-yellow/30" : ""}`}
                onSelect={(id, label) => {
                  setLugarId(id);
                  setLugarNombre(label);
                  if (id) clearOcr("lugarNombre");
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
          </div>
        </Card>

        {/* ── Odómetro ─────────────────────────────────────────────── */}
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
              {" "} · Km ingenio/finca: <span className="font-semibold text-[var(--text)]">{kmIngenioFinca}</span>
              {lugarKmPagaIngenio != null && (
                <span className="ml-2 text-tz-yellow font-semibold">
                  · Km paga ingenio: {lugarKmPagaIngenio}
                </span>
              )}
            </p>
          )}
        </Card>

        {/* ── Extracto de Pesaje ───────────────────────────────────── */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            ⚖️ Extracto de Pesaje
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>
                Fecha
                {ocrFilledFields.has("fecha") && <OcrBadge />}
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => { setFecha(e.target.value); clearOcr("fecha"); }}
                className={`${inputCls} ${ocrFilledFields.has("fecha") ? "ring-2 ring-tz-yellow/40 border-tz-yellow/30" : ""}`}
              />
            </div>

            <div>
              <label className={labelCls}>
                Frente
                {ocrFilledFields.has("frenteNumero") && <OcrBadge />}
              </label>
              <CreatableCombobox
                items={(frentesQ.data?.frentes ?? []).map((f) => ({ id: f.id, label: f.numero }))}
                value={frenteId}
                isLoading={frentesQ.isLoading}
                className={`${inputCls} ${ocrFilledFields.has("frenteNumero") ? "ring-2 ring-tz-yellow/40 border-tz-yellow/30" : ""}`}
                onSelect={(id, label) => { setFrenteId(id); setFrenteNumero(label); if (id) clearOcr("frenteNumero"); }}
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

            {modalidad === "PARTICULARES" && (
              <div>
                <label className={labelCls}>
                  Peso Neto (Kg) *
                  {ocrFilledFields.has("pesoNetoKg") && <OcrBadge />}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pesoNetoKg}
                  onChange={(e) => { setPesoNetoKg(e.target.value); clearOcr("pesoNetoKg"); }}
                  placeholder="0"
                  className={`${inputCls} ${ocrFilledFields.has("pesoNetoKg") ? "ring-2 ring-tz-yellow/40 border-tz-yellow/30" : ""}`}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>
                N° Orden (del extracto)
                {ocrFilledFields.has("ordenRemitoNumero") && <OcrBadge />}
              </label>
              <input
                type="text"
                value={ordenRemitoNumero}
                onChange={(e) => { setOrdenRemitoNumero(e.target.value); clearOcr("ordenRemitoNumero"); }}
                placeholder="ej. 216266"
                className={`${inputCls} ${ocrFilledFields.has("ordenRemitoNumero") ? "ring-2 ring-tz-yellow/40 border-tz-yellow/30" : ""}`}
              />
            </div>
          </div>
        </Card>

        {/* ── Orden de Carga ────────────────────────────────────────── */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            ⛽ Orden de Carga
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>
                N° Orden (de la orden)
                {ocrFilledFields.has("ordenCargaNumero") && <OcrBadge />}
              </label>
              <input
                type="text"
                value={ordenCargaNumero}
                onChange={(e) => { setOrdenCargaNumero(e.target.value); clearOcr("ordenCargaNumero"); }}
                placeholder="ej. 216266"
                className={`${inputCls} ${ocrFilledFields.has("ordenCargaNumero") ? "ring-2 ring-tz-yellow/40 border-tz-yellow/30" : ""}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Gasoil (L)
                  {ocrFilledFields.has("gasoil") && <OcrBadge />}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={gasoil}
                  onChange={(e) => { setGasoil(e.target.value); clearOcr("gasoil"); }}
                  placeholder="0"
                  className={`${inputCls} ${ocrFilledFields.has("gasoil") ? "ring-2 ring-tz-yellow/40 border-tz-yellow/30" : ""}`}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Ingenio (destino)
                  {ocrFilledFields.has("ingenioNombre") && <OcrBadge />}
                </label>
                <input
                  type="text"
                  value={ingenioNombre}
                  onChange={(e) => { setIngenioNombre(e.target.value); clearOcr("ingenioNombre"); }}
                  placeholder="Ej: Cruz Alta"
                  className={`${inputCls} ${ocrFilledFields.has("ingenioNombre") ? "ring-2 ring-tz-yellow/40 border-tz-yellow/30" : ""}`}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* ── Comisión estimada ─────────────────────────────────────── */}
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

        {/* ── Observaciones ─────────────────────────────────────────── */}
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
