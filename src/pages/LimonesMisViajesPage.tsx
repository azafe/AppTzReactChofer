import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { listMisViajesLimones } from "../services/limonesApi";
import { LimonesNav } from "../components/LimonesNav";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { dateAR, moneyARS, monthRange } from "../lib/format";

export function LimonesMisViajesPage() {
  const { currentDriver } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { from, to } = monthRange(year, month);

  const viajesQ = useQuery({
    queryKey: ["limones-mis-viajes", currentDriver?.id, { from, to }],
    queryFn: () =>
      listMisViajesLimones({ choferId: currentDriver!.id, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const viajes = viajesQ.data?.viajes ?? [];
  const totalMiPago = viajes.reduce((s, v) => s + (v.corte_chofer ?? 0), 0);

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
        <StatCard label="Mi pago total" value={totalMiPago > 0 ? moneyARS(Math.round(totalMiPago)) : "—"} />
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
                  <span>Finca: {v.finca?.nombre ?? "—"}</span>
                  {v.toneladas != null && (
                    <span>{Number(v.toneladas).toFixed(2)} ton</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {v.corte_chofer != null ? (
                  <p className="font-display text-xl font-bold text-tz-yellow">
                    {moneyARS(Math.round(v.corte_chofer))}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--muted)]">{v.kmRecorridos} km</p>
                )}
                <p className="text-[10px] text-[var(--muted)]">
                  {v.corte_chofer != null ? "Mi pago" : ""}
                </p>
              </div>
            </div>
            {v.fotoRemitoUrl && (
              <div className="mt-2 border-t border-white/5 pt-2">
                <a href={v.fotoRemitoUrl} target="_blank" rel="noreferrer">
                  <img
                    src={v.fotoRemitoUrl}
                    alt="Remito"
                    className="h-10 w-10 rounded-lg border border-white/15 object-cover"
                  />
                </a>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
