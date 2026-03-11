import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getSheets } from "../services/picadoApi";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { moneyARS, dateAR, monthRange } from "../lib/format";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function HomePage() {
  const { currentDriver } = useAuth();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { from, to } = monthRange(year, month);

  // Traer todas las planillas del mes para calcular totales (hasta 200)
  const sheetsQuery = useQuery({
    queryKey: ["picado", "sheets", currentDriver?.id, { from, to, limit: 200 }],
    queryFn: () => getSheets({ driverId: currentDriver!.id, from, to, limit: 200 }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const allSheets = sheetsQuery.data?.data ?? [];

  // Calcular totales del mes desde las planillas filtradas por este chofer
  const totalViajes = allSheets.reduce((s, sh) => s + (sh.trip_count ?? 0), 0);
  const totalBruto = allSheets.reduce((s, sh) => s + (sh.total_trip_amount ?? 0), 0);
  const totalPago = allSheets.reduce((s, sh) => s + (sh.driver_amount ?? 0), 0);
  const totalLitros = allSheets.reduce((s, sh) => s + (sh.liters_loaded ?? 0), 0);

  // Últimas 5 planillas
  const recentSheets = [...allSheets]
    .sort((a, b) => b.sheet_date.localeCompare(a.sheet_date))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">
          Hola, {currentDriver?.name?.split(" ")[0]}! 🚛
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {MONTHS[month - 1]} {year}
        </p>
      </div>

      {/* Summary stats */}
      {sheetsQuery.isPending && <PageSpinner />}
      {sheetsQuery.isError && (
        <ErrorCard
          message="No se pudo cargar el resumen"
          onRetry={() => sheetsQuery.refetch()}
        />
      )}
      {!sheetsQuery.isPending && !sheetsQuery.isError && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Viajes" value={totalViajes} sub="este mes" />
          <StatCard label="Ingreso bruto" value={moneyARS(totalBruto)} sub="este mes" />
          <StatCard label="Tu pago" value={moneyARS(totalPago)} sub="estimado" accent />
          <StatCard
            label="Litros"
            value={`${totalLitros.toLocaleString("es-AR")} L`}
            sub="cargados"
          />
        </div>
      )}

      {/* Quick action */}
      <Link
        to="/cargar"
        className="flex items-center justify-center gap-2 rounded-2xl bg-tz-yellow py-3 font-semibold text-tz-black hover:brightness-105 transition-all"
      >
        <span>➕</span>
        <span>Cargar viaje de hoy</span>
      </Link>

      {/* Recent sheets */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Últimas planillas</SectionTitle>
          <Link to="/mis-viajes" className="text-xs text-tz-yellow hover:underline">
            Ver todas
          </Link>
        </div>

        {!sheetsQuery.isPending && allSheets.length === 0 && (
          <EmptyState message="No tenés viajes este mes" />
        )}

        <div className="flex flex-col gap-3">
          {recentSheets.map((sheet) => (
            <Card key={sheet.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    {dateAR(sheet.sheet_date)}
                  </p>
                  {sheet.sheet_number && (
                    <p className="text-xs text-[var(--muted)]">
                      Planilla #{sheet.sheet_number}
                    </p>
                  )}
                  {sheet.vehicle_label && (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {sheet.vehicle_label}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-tz-yellow">
                    {moneyARS(sheet.driver_amount)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {sheet.trip_count ?? 0} viaje{(sheet.trip_count ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
