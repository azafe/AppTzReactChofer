import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getSheets, getSummary } from "../services/picadoApi";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { moneyARS, dateAR, monthRange } from "../lib/format";

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function HomePage() {
  const { currentDriver } = useAuth();
  const { year, month } = currentYearMonth();
  const { from, to } = monthRange(year, month);

  const summaryQuery = useQuery({
    queryKey: ["picado", "summary", currentDriver?.id, { from, to }],
    queryFn: () => getSummary({ driverId: currentDriver!.id, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const sheetsQuery = useQuery({
    queryKey: ["picado", "sheets", currentDriver?.id, { from, to, limit: 5 }],
    queryFn: () => getSheets({ driverId: currentDriver!.id, from, to, limit: 5, page: 1 }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const summary = summaryQuery.data;
  const sheets = sheetsQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">
          Hola, {currentDriver?.name?.split(" ")[0]}! 🚛
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {months[month - 1]} {year}
        </p>
      </div>

      {/* Summary stats */}
      {summaryQuery.isPending && <PageSpinner />}
      {summaryQuery.isError && (
        <ErrorCard
          message="No se pudo cargar el resumen"
          onRetry={() => summaryQuery.refetch()}
        />
      )}
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Viajes"
            value={summary.total_trips ?? 0}
            sub="este mes"
          />
          <StatCard
            label="Ingreso bruto"
            value={moneyARS(summary.total_trip_amount)}
            sub="este mes"
          />
          <StatCard
            label="Tu pago"
            value={moneyARS(summary.driver_amount)}
            sub="estimado"
            accent
          />
          <StatCard
            label="Litros"
            value={`${(summary.liters_loaded ?? 0).toLocaleString("es-AR")} L`}
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

        {sheetsQuery.isPending && <PageSpinner />}
        {sheetsQuery.isError && (
          <ErrorCard
            message="No se pudieron cargar las planillas"
            onRetry={() => sheetsQuery.refetch()}
          />
        )}
        {!sheetsQuery.isPending && sheets.length === 0 && (
          <EmptyState message="No tenés viajes este mes" />
        )}

        <div className="flex flex-col gap-3">
          {sheets.map((sheet) => (
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
