import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createSheet, updateSheet, getSheets, addSheetTrips, replaceSheetTrips } from "../services/picadoApi";
import { TripFormRow, type TripRowData } from "../components/TripFormRow";
import { Card, SectionTitle } from "../components/Card";
import { showToast } from "../components/Toast";
import { moneyARS, todayISO, normalizeISODate } from "../lib/format";
import { calcPlanilla } from "../lib/picadoCalc";

function newRow(n: number): TripRowData {
  return { trip_number: String(n), distance_km: "" };
}

export function CargarViajePage() {
  const { currentDriver } = useAuth();
  const queryClient = useQueryClient();

  const [sheetDate, setSheetDate] = useState(todayISO());
  const [sheetNumber, setSheetNumber] = useState("");
  const [dieselPrice, setDieselPrice] = useState("");
  const [litersLoaded, setLitersLoaded] = useState("");
  const [observations, setObservations] = useState("");
  const [rows, setRows] = useState<TripRowData[]>([newRow(1)]);
  const [errors, setErrors] = useState<string[]>([]);

  const dp = parseFloat(dieselPrice) || 0;
  const validRows = rows.filter(
    (r) => r.trip_number.trim() !== "" && parseFloat(r.distance_km) > 0
  );
  const calc = validRows.length > 0 && dp > 0
    ? calcPlanilla(
        validRows.map((r) => ({
          trip_number: r.trip_number,
          distance_km: parseFloat(r.distance_km),
        })),
        dp
      )
    : null;

  function addRow() {
    const nextNum =
      rows.length > 0
        ? Math.max(...rows.map((r) => parseInt(r.trip_number) || 0)) + 1
        : 1;
    setRows((prev) => [...prev, newRow(nextNum)]);
  }

  function updateRow(index: number, field: keyof TripRowData, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (!sheetDate) errs.push("La fecha es obligatoria.");
    if (!dieselPrice || dp <= 0) errs.push("El precio del gasoil debe ser mayor a 0.");
    if (validRows.length === 0)
      errs.push("Debe haber al menos 1 viaje con número y km válidos.");
    const nums = validRows.map((r) => r.trip_number.trim());
    if (new Set(nums).size !== nums.length)
      errs.push("Los números de viaje deben ser únicos.");
    return errs;
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const errs = validate();
      if (errs.length > 0) throw Object.assign(new Error("validation"), { validationErrors: errs });

      const tripPayload = validRows.map((r) => {
        const km = parseFloat(r.distance_km);
        const tripCalc = calc!.trips.find((t) => t.trip_number === r.trip_number);
        return {
          trip_number: r.trip_number,
          distance_km: km,
          total_trip_amount: tripCalc?.totalTrip ?? 0,
          driver_amount: tripCalc?.driverFee ?? 0,
          diesel_theoretical_amount: tripCalc?.dieselTheoretical ?? 0,
        };
      });

      const sheetPayload = {
        sheet_date: normalizeISODate(sheetDate),
        sheet_number: sheetNumber || null,
        driver_id: currentDriver!.id,
        driver_name: currentDriver!.name,
        vehicle_id: currentDriver!.vehicleId ?? null,
        vehicle_label: currentDriver!.vehicleLabel ?? null,
        diesel_price_snapshot: dp,
        liters_loaded: litersLoaded ? parseFloat(litersLoaded) : null,
        observations: observations || null,
        trip_count: validRows.length,
        total_trip_amount: calc?.totalTripAmount ?? 0,
        driver_amount: calc?.totalDriverAmount ?? 0,
        diesel_theoretical_amount: calc?.totalDieselTheoretical ?? 0,
      };

      try {
        // Try create
        const sheet = await createSheet(sheetPayload);
        await replaceSheetTrips(sheet.id, tripPayload);
        return { mode: "created" };
      } catch (err: unknown) {
        const e = err as Error & { status?: number };
        // Conflict: merge into existing sheet
        if (e.status === 400 || e.status === 409) {
          const existing = await getSheets({
            driverId: currentDriver!.id,
            from: normalizeISODate(sheetDate),
            to: normalizeISODate(sheetDate),
            limit: 10,
          });
          const match = existing.data?.find(
            (s) =>
              normalizeISODate(s.sheet_date) === normalizeISODate(sheetDate) &&
              (s.vehicle_id === currentDriver!.vehicleId ||
                s.vehicle_label === currentDriver!.vehicleLabel)
          );
          if (match) {
            await updateSheet(match.id, {
              ...sheetPayload,
              trip_count: (match.trip_count ?? 0) + validRows.length,
              total_trip_amount: (match.total_trip_amount ?? 0) + (calc?.totalTripAmount ?? 0),
              driver_amount: (match.driver_amount ?? 0) + (calc?.totalDriverAmount ?? 0),
            });
            await addSheetTrips(match.id, tripPayload);
            return { mode: "merged" };
          }
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      if (result.mode === "merged") {
        showToast("Viajes agregados a la planilla existente", "info");
      } else {
        showToast("Planilla guardada correctamente", "success");
      }
      // Reset form
      setSheetDate(todayISO());
      setSheetNumber("");
      setDieselPrice("");
      setLitersLoaded("");
      setObservations("");
      setRows([newRow(1)]);
      setErrors([]);
      queryClient.invalidateQueries({ queryKey: ["picado"] });
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
      <SectionTitle>Cargar Viaje</SectionTitle>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Fecha y planilla */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Datos de la planilla
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Fecha *</label>
              <input
                type="date"
                value={sheetDate}
                onChange={(e) => setSheetDate(e.target.value)}
                required
                className="h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">N° Planilla</label>
              <input
                type="text"
                value={sheetNumber}
                onChange={(e) => setSheetNumber(e.target.value)}
                placeholder="Opcional"
                className="h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60"
              />
            </div>
          </div>

          {/* Driver / vehicle read-only */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Chofer</label>
              <input
                type="text"
                value={currentDriver?.name ?? ""}
                readOnly
                className="h-11 w-full cursor-not-allowed rounded-2xl border border-white/8 bg-white/5 px-3 text-[var(--muted)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Camión</label>
              <input
                type="text"
                value={currentDriver?.vehicleLabel ?? ""}
                readOnly
                className="h-11 w-full cursor-not-allowed rounded-2xl border border-white/8 bg-white/5 px-3 text-[var(--muted)]"
              />
            </div>
          </div>
        </Card>

        {/* Gasoil */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Gasoil
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">
                Precio c/IVA *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={dieselPrice}
                onChange={(e) => setDieselPrice(e.target.value)}
                placeholder="$ por litro"
                className="h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">
                Litros cargados
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={litersLoaded}
                onChange={(e) => setLitersLoaded(e.target.value)}
                placeholder="Opcional"
                className="h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60"
              />
            </div>
          </div>
        </Card>

        {/* Viajes */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Viajes
            </p>
            <button
              type="button"
              onClick={addRow}
              className="rounded-xl bg-tz-yellow/15 px-3 py-1 text-xs font-semibold text-tz-yellow hover:bg-tz-yellow/25 transition-colors"
            >
              + Agregar viaje
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1">
              <span className="text-xs text-[var(--muted)]">N° Viaje</span>
              <span className="text-xs text-[var(--muted)]">Distancia (km)</span>
              <span />
            </div>
            {rows.map((row, i) => (
              <TripFormRow
                key={i}
                index={i}
                row={row}
                dieselPrice={dp}
                onChange={updateRow}
                onRemove={removeRow}
                canRemove={rows.length > 1}
              />
            ))}
          </div>
        </Card>

        {/* Preview totales */}
        {calc && (
          <Card className="bg-[var(--accent-soft)] border-tz-yellow/20">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-tz-yellow">
              Resumen estimado
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--muted)]">
                    <th className="pb-2 font-medium">Viaje</th>
                    <th className="pb-2 font-medium">Km</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium text-right text-tz-yellow">Tu pago</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.trips.map((t) => (
                    <tr key={t.trip_number} className="border-t border-white/5">
                      <td className="py-1.5 font-medium text-[var(--text)]">#{t.trip_number}</td>
                      <td className="py-1.5 text-[var(--muted)]">{t.distance_km}</td>
                      <td className="py-1.5 text-right text-[var(--text)]">{moneyARS(t.totalTrip)}</td>
                      <td className="py-1.5 text-right font-semibold text-tz-yellow">{moneyARS(t.driverFee)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-tz-yellow/30">
                    <td colSpan={2} className="pt-2 text-xs font-semibold text-[var(--muted)]">
                      TOTAL ({calc.trips.length} viajes)
                    </td>
                    <td className="pt-2 text-right font-bold text-[var(--text)]">
                      {moneyARS(calc.totalTripAmount)}
                    </td>
                    <td className="pt-2 text-right font-bold text-tz-yellow">
                      {moneyARS(calc.totalDriverAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {/* Observaciones */}
        <Card>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Observaciones
          </label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
            placeholder="Opcional..."
            className="w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60 resize-none"
          />
        </Card>

        {/* Validation errors */}
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
          {mutation.isPending ? "Guardando..." : "Guardar planilla"}
        </button>
      </form>
    </div>
  );
}
