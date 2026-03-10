import { moneyARS } from "../lib/format";
import { calcTrip } from "../lib/picadoCalc";

export type TripRowData = {
  trip_number: string;
  distance_km: string;
};

interface TripFormRowProps {
  index: number;
  row: TripRowData;
  dieselPrice: number;
  onChange: (index: number, field: keyof TripRowData, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function TripFormRow({
  index,
  row,
  dieselPrice,
  onChange,
  onRemove,
  canRemove,
}: TripFormRowProps) {
  const km = parseFloat(row.distance_km);
  const calc = km > 0 && dieselPrice > 0 ? calcTrip(km, dieselPrice) : null;

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
      <input
        type="number"
        min="1"
        step="1"
        placeholder="N° viaje"
        value={row.trip_number}
        onChange={(e) => onChange(index, "trip_number", e.target.value)}
        className="h-11 rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60"
      />
      <div>
        <input
          type="number"
          min="0"
          step="0.1"
          placeholder="Km"
          value={row.distance_km}
          onChange={(e) => onChange(index, "distance_km", e.target.value)}
          className="h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60"
        />
        {calc && (
          <p className="mt-0.5 text-xs text-tz-yellow px-1">
            {moneyARS(calc.driverFee)}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-tz-red/10 hover:text-tz-red disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
