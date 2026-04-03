import { useMemo, useState, useRef, useEffect, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  createLimonViaje,
  getUnidadesActivas,
  listFincasActivas,
  uploadLimonesFoto,
} from "../services/limonesApi";
import { calcularViaje } from "../utils/limones-calculos";
import { LimonesNav } from "../components/LimonesNav";
import { Card } from "../components/Card";
import { showToast } from "../components/Toast";
import { moneyARS, todayISO } from "../lib/format";

const inputCls =
  "h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60";
const labelCls = "mb-1 block text-xs text-[var(--muted)]";

export function LimonesCargarPage() {
  const { currentDriver } = useAuth();
  const queryClient = useQueryClient();

  const [fecha, setFecha] = useState(todayISO());
  const [fincaId, setFincaId] = useState("");
  const [fincaQuery, setFincaQuery] = useState("");
  const [fincaOpen, setFincaOpen] = useState(false);
  const fincaRef = useRef<HTMLDivElement>(null);
  const [pesoRealKg, setPesoRealKg] = useState("");
  const [camionVehicleId, setCamionVehicleId] = useState(currentDriver?.vehicleId ?? "");
  const [camionNombre, setCamionNombre] = useState(currentDriver?.vehicleLabel ?? "");
  const [observaciones, setObservaciones] = useState("");
  const [fotoRemitoUrl, setFotoRemitoUrl] = useState<string | null>(null);
  const [uploadingRemito, setUploadingRemito] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const remitoInputRef = useRef<HTMLInputElement>(null);

  const unidadesQ = useQuery({
    queryKey: ["limones-unidades"],
    queryFn: getUnidadesActivas,
    staleTime: 120_000,
  });
  const fincasQ = useQuery({
    queryKey: ["limones-fincas-activas"],
    queryFn: listFincasActivas,
    staleTime: 120_000,
  });

  const unidades = unidadesQ.data?.unidades ?? [];
  const fincas = (fincasQ.data?.fincas ?? []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre));

  const selectedFinca = fincas.find((f) => f.id === fincaId) ?? null;
  const selectedCamion = unidades.find((u) => u.vehicleId === camionVehicleId) ?? null;

  const fincasFiltradas = fincaQuery.trim()
    ? fincas.filter((f) => f.nombre.toLowerCase().includes(fincaQuery.toLowerCase()))
    : fincas;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (fincaRef.current && !fincaRef.current.contains(e.target as Node)) {
        setFincaOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const preview = useMemo(() => {
    if (!selectedFinca) return null;
    const peso = parseFloat(pesoRealKg);
    if (!Number.isFinite(peso) || peso <= 0) return null;
    const calc = calcularViaje({
      peso_real_kg: peso,
      finca: selectedFinca,
      consumo_teorico_l100km: selectedCamion?.consumo_teorico_l100km ?? null,
    });
    return calc;
  }, [selectedFinca, pesoRealKg, selectedCamion]);

  const mutation = useMutation({
    mutationFn: async () => {
      const errs: string[] = [];
      if (!fecha) errs.push("Ingresá la fecha.");
      if (!fincaId) errs.push("Seleccioná una finca.");
      const peso = parseFloat(pesoRealKg);
      if (pesoRealKg === "" || !Number.isFinite(peso) || peso <= 0)
        errs.push("Ingresá el peso real en kg.");
      if (!camionVehicleId) errs.push("Seleccioná un camión.");
      if (errs.length > 0) {
        setErrors(errs);
        throw new Error(errs[0]);
      }
      setErrors([]);

      const finca = fincas.find((f) => f.id === fincaId)!;
      const calc = calcularViaje({
        peso_real_kg: peso,
        finca,
        consumo_teorico_l100km: selectedCamion?.consumo_teorico_l100km ?? null,
      });

      await createLimonViaje({
        fecha,
        choferId: currentDriver!.id,
        choferNombre: currentDriver!.name,
        camionId: camionVehicleId,
        camionNombre,
        origen: finca.nombre,
        destino: "Empaque",
        observaciones: observaciones.trim() || null,
        fotoRemitoUrl: fotoRemitoUrl || null,
        finca_id: finca.id,
        peso_real_kg: peso,
        toneladas: calc.toneladas,
        tarifa_aplicada: finca.precio_bins,
        ingreso_bruto: calc.ingreso_bruto,
        corte_chofer: calc.corte_chofer,
      });
    },
    onSuccess: () => {
      showToast("Viaje registrado ✓");
      queryClient.invalidateQueries({ queryKey: ["limones-mis-viajes"] });
      setFincaId("");
      setFincaQuery("");
      setFincaOpen(false);
      setPesoRealKg("");
      setObservaciones("");
      setFotoRemitoUrl(null);
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
        {/* Datos del viaje */}
        <Card>
          <p className="mb-4 text-sm font-semibold text-[var(--text)]">Registrar viaje</p>

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
                  <option key={u.vehicleId} value={u.vehicleId}>
                    {u.vehicleLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3" ref={fincaRef}>
            <label className={labelCls}>Finca *</label>
            <div className="relative">
              <input
                type="text"
                className={inputCls}
                placeholder="Buscá una finca..."
                value={fincaOpen ? fincaQuery : (selectedFinca ? `${selectedFinca.nombre} (${selectedFinca.km_distancia} km)` : "")}
                onFocus={() => {
                  setFincaOpen(true);
                  setFincaQuery("");
                }}
                onChange={(e) => {
                  setFincaQuery(e.target.value);
                  setFincaOpen(true);
                }}
              />
              {fincaOpen && fincasFiltradas.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-white/15 bg-[#0f1115] py-1 shadow-xl">
                  {fincasFiltradas.map((f) => (
                    <li
                      key={f.id}
                      className={`cursor-pointer px-3 py-2 text-sm hover:bg-white/10 ${f.id === fincaId ? "text-tz-yellow" : "text-[var(--text)]"}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFincaId(f.id);
                        setFincaQuery("");
                        setFincaOpen(false);
                      }}
                    >
                      {f.nombre} <span className="text-[var(--muted)]">({f.km_distancia} km)</span>
                    </li>
                  ))}
                </ul>
              )}
              {fincaOpen && fincasFiltradas.length === 0 && fincaQuery && (
                <div className="absolute z-20 mt-1 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 py-3 text-sm text-[var(--muted)] shadow-xl">
                  Sin resultados
                </div>
              )}
            </div>
          </div>

          <div className="mt-3">
            <label className={labelCls}>Peso real (kg) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              placeholder="Ej: 20000"
              value={pesoRealKg}
              onChange={(e) => setPesoRealKg(e.target.value)}
            />
          </div>

        </Card>

        {/* Preview */}
        {preview && (
          <Card>
            <p className="mb-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Resumen</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">Toneladas</span>
                <span className="font-semibold text-[var(--text)]">{preview.toneladas.toFixed(2)} ton</span>
              </div>
              <div className="flex justify-between text-sm border-t border-white/8 pt-2">
                <span className="text-[var(--muted)]">Tu pago</span>
                <span className="font-bold text-tz-yellow text-base">{moneyARS(Math.round(preview.corte_chofer))}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Foto */}
        <Card>
          <label className={labelCls}>Foto remito (opcional)</label>
          <div className="flex items-center gap-3">
            <input
              ref={remitoInputRef}
              type="file"
              accept="image/*"
              
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingRemito(true);
                try {
                  const res = await uploadLimonesFoto(file, "limones-remito");
                  setFotoRemitoUrl(res.url);
                } catch {
                  showToast("Error al subir la foto", "error");
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
                className="h-10 w-10 rounded-lg border border-white/15 object-cover"
              />
            )}
            <button
              type="button"
              disabled={uploadingRemito}
              onClick={() => remitoInputRef.current?.click()}
              className="h-11 flex-1 rounded-2xl border border-white/15 bg-[#0f1115] text-sm text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"
            >
              {uploadingRemito ? "Subiendo..." : fotoRemitoUrl ? "Cambiar foto" : "Subir foto remito"}
            </button>
          </div>
        </Card>

        {/* Observaciones */}
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
