import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getSheets, getAnticipos } from "../services/picadoApi";
import { listMisViajesLimones } from "../services/limonesApi";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard } from "../components/Spinner";
import { moneyARS, monthRange } from "../lib/format";

export function MiPagoPage() {
  const { currentDriver } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { from, to } = monthRange(year, month);
  const modulos = currentDriver?.modulos ?? [];

  const hasPicado = modulos.includes("PICADO");
  const hasLimones = modulos.includes("LIMONES");

  const sheetsQuery = useQuery({
    queryKey: ["picado", "sheets", currentDriver?.id, { from, to, limit: 200 }],
    queryFn: () => getSheets({ driverId: currentDriver!.id, from, to, limit: 200 }),
    enabled: !!currentDriver && hasPicado,
    staleTime: 60_000,
  });

  const anticiposQuery = useQuery({
    queryKey: ["anticipos", currentDriver?.id, { from, to }],
    queryFn: () => getAnticipos({ chofer: currentDriver!.name, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const limonesQ = useQuery({
    queryKey: ["limones-mis-viajes-pago", currentDriver?.id, { from, to }],
    queryFn: () => listMisViajesLimones({ choferId: currentDriver!.id, from, to }),
    enabled: !!currentDriver && hasLimones,
    staleTime: 60_000,
  });

  const sheets = sheetsQuery.data?.data ?? [];
  const anticipos = anticiposQuery.data ?? [];
  const limonesViajes = limonesQ.data?.viajes ?? [];

  const picadoIngresos = sheets.reduce((s, sh) => s + (sh.driver_amount ?? 0), 0);
  const picadoViajes = sheets.reduce((s, sh) => s + (sh.trip_count ?? 0), 0);

  const limonesIngresos = limonesViajes.reduce((s, v) => s + (v.corte_chofer ?? 0), 0);
  const limonesViajesCount = limonesViajes.length;

  const totalAnticipos = anticipos.reduce((s, a) => s + a.monto, 0);
  const totalIngresos = (hasPicado ? picadoIngresos : 0) + (hasLimones ? limonesIngresos : 0);
  const aCobrar = totalIngresos - totalAnticipos;

  const limonesPromPorViaje = limonesViajesCount > 0 ? limonesIngresos / limonesViajesCount : null;
  const picadoPromPorViaje = picadoViajes > 0 ? picadoIngresos / picadoViajes : null;

  const isPending =
    (hasPicado && sheetsQuery.isPending) ||
    anticiposQuery.isPending ||
    (hasLimones && limonesQ.isPending);

  const isError =
    (hasPicado && sheetsQuery.isError) ||
    anticiposQuery.isError ||
    (hasLimones && limonesQ.isError);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Mi Pago</SectionTitle>
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => { setYear(y); setMonth(m); }}
        />
      </div>

      {isPending && <PageSpinner />}
      {isError && (
        <ErrorCard
          message="No se pudo cargar la información de pago"
          onRetry={() => {
            if (hasPicado) sheetsQuery.refetch();
            anticiposQuery.refetch();
            if (hasLimones) limonesQ.refetch();
          }}
        />
      )}

      {!isPending && !isError && (
        <>
          {/* A cobrar */}
          <Card className="border-tz-yellow/30 bg-[var(--accent-soft)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-tz-yellow">
              A cobrar
            </p>
            <p className="mt-1 font-display text-4xl font-bold text-tz-yellow">
              {moneyARS(aCobrar)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Ingresos menos anticipos recibidos</p>
          </Card>

          {/* Desglose ingresos − anticipos */}
          <Card>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--muted)]">Ingresos</span>
                <span className="font-semibold text-tz-yellow">{moneyARS(totalIngresos)}</span>
              </div>
              <div className="border-t border-[var(--border)]" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--muted)]">− Anticipos</span>
                <span className="font-semibold">{moneyARS(totalAnticipos)}</span>
              </div>
            </div>
          </Card>

          {/* Módulos activos */}
          <div className="flex flex-col gap-4">
            {hasLimones && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Limones</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Viajes" value={limonesViajesCount} />
                  <StatCard label="Prom/viaje" value={limonesPromPorViaje != null ? moneyARS(limonesPromPorViaje) : "—"} accent />
                </div>
              </div>
            )}

            {hasPicado && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Picado</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Viajes" value={picadoViajes} />
                  <StatCard label="Prom/viaje" value={picadoPromPorViaje != null ? moneyARS(picadoPromPorViaje) : "—"} accent />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
