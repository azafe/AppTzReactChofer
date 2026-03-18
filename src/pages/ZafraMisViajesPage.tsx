import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { listMisViajes } from "../services/zafraApi";
import { ZafraNav } from "../components/ZafraNav";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { moneyARS, dateAR, monthRange } from "../lib/format";

export function ZafraMisViajesPage() {
  const { currentDriver } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { from, to } = monthRange(year, month);

  const viajesQ = useQuery({
    queryKey: ["zafra", "mis-viajes", currentDriver?.id, { from, to }],
    queryFn: () =>
      listMisViajes({ choferId: currentDriver!.id, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const viajes = viajesQ.data?.viajes ?? [];

  const totalComision = viajes.reduce((s, v) => s + (v.comisionChofer ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <ZafraNav />

      <div className="flex items-center justify-between">
        <SectionTitle>Mis Viajes (Zafra)</SectionTitle>
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Viajes" value={viajes.length} />
        <StatCard label="Tu comisión" value={moneyARS(totalComision)} accent />
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
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {v.camionNombre || currentDriver?.vehicleLabel}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                  <span>
                    Km: {v.kmSalida} → {v.kmLlegada}
                    <span className="ml-1 text-[var(--text)]">({v.kmRecorridos} km)</span>
                  </span>
                  {v.pesoNetoKg != null && (
                    <span>Peso: {v.pesoNetoKg.toLocaleString("es-AR")} kg</span>
                  )}
                  {v.lugarNombre && <span>{v.lugarNombre}</span>}
                </div>
                <p className="mt-1 text-xs text-[var(--muted)] capitalize">
                  {v.modalidad.toLowerCase()}
                </p>
              </div>
              <div className="text-right shrink-0">
                {v.comisionChofer != null ? (
                  <>
                    <p className="font-display text-xl font-bold text-tz-yellow">
                      {moneyARS(v.comisionChofer)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {v.modalidad === "AMARILLOS" ? "pago viaje" : "comisión"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-[var(--muted)]">—</p>
                )}
              </div>
            </div>
            {v.observaciones && (
              <p className="mt-2 text-xs text-[var(--muted)] border-t border-white/5 pt-2">
                {v.observaciones}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
