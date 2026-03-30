import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { listMisViajesLimones } from "../services/limonesApi";
import { LimonesNav } from "../components/LimonesNav";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { dateAR, monthRange } from "../lib/format";

export function LimonesMisViajesPage() {
  const { currentDriver } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { from, to } = monthRange(year, month);

  const viajesQ = useQuery({
    queryKey: ["limones-mis-viajes", currentDriver?.driverId, { from, to }],
    queryFn: () =>
      listMisViajesLimones({ choferId: currentDriver!.driverId, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const viajes = viajesQ.data?.viajes ?? [];
  const totalKm = viajes.reduce((s, v) => s + v.kmRecorridos, 0);

  return (
    <div className="flex flex-col gap-6">
      <LimonesNav />

      <div className="flex items-center justify-between">
        <SectionTitle>Mis Viajes (Limones)</SectionTitle>
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Viajes" value={viajes.length} />
        <StatCard label="Km productivos" value={totalKm > 0 ? `${totalKm} km` : "0 km"} />
      </div>

      {viajesQ.isPending && <PageSpinner />}
      {viajesQ.isError && (
        <ErrorCard
          message="No se pudieron cargar los viajes"
          onRetry={() => viajesQ.refetch()}
        />
      )}
      {!viajesQ.isPending && viajes.length === 0 && (
        <EmptyState message="No tenés viajes este mes" />
      )}

      <div className="flex flex-col gap-3">
        {viajes.map((v) => (
          <Card key={v.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-[var(--text)]">{dateAR(v.fecha)}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{v.camionNombre}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                  <span>{v.origen} → {v.destino}</span>
                  <span>
                    Km: {v.kmSalida} → {v.kmLlegada}
                    <span className="ml-1 text-[var(--text)]">({v.kmRecorridos} km)</span>
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-xl font-bold text-tz-yellow">
                  {v.kmRecorridos} km
                </p>
              </div>
            </div>
            {v.observaciones && (
              <p className="mt-2 border-t border-white/5 pt-2 text-xs text-[var(--muted)]">
                {v.observaciones}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
