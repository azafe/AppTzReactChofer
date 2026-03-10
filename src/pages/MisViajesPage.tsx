import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getSheet, getSheets } from "../services/picadoApi";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { moneyARS, dateAR, monthRange } from "../lib/format";

export function MisViajesPage() {
  const { currentDriver } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const { from, to } = monthRange(year, month);

  const sheetsQuery = useQuery({
    queryKey: ["picado", "sheets", currentDriver?.id, { from, to, page, limit: LIMIT }],
    queryFn: () =>
      getSheets({ driverId: currentDriver!.id, from, to, page, limit: LIMIT }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const expandedQuery = useQuery({
    queryKey: ["picado", "sheet-detail", expandedId],
    queryFn: () => getSheet(expandedId!),
    enabled: !!expandedId,
    staleTime: 60_000,
  });

  const sheets = sheetsQuery.data?.data ?? [];
  const total = sheetsQuery.data?.total ?? 0;

  const totalViajes = sheets.reduce((s, sh) => s + (sh.trip_count ?? 0), 0);
  const totalPago = sheets.reduce((s, sh) => s + (sh.driver_amount ?? 0), 0);
  const totalLitros = sheets.reduce((s, sh) => s + (sh.liters_loaded ?? 0), 0);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Mis Viajes</SectionTitle>
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
            setPage(1);
            setExpandedId(null);
          }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Viajes" value={totalViajes} />
        <StatCard label="Tu pago" value={moneyARS(totalPago)} accent />
        <StatCard label="Litros" value={`${totalLitros.toLocaleString("es-AR")} L`} />
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
        {sheets.map((sheet) => {
          const isOpen = expandedId === sheet.id;
          const detail = isOpen ? expandedQuery.data : null;

          return (
            <Card key={sheet.id} className="overflow-hidden p-0">
              <button
                onClick={() => toggleExpand(sheet.id)}
                className="w-full p-4 text-left"
              >
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
                    <div className="mt-2 flex gap-3 text-xs text-[var(--muted)]">
                      <span>{sheet.trip_count ?? 0} viajes</span>
                      {sheet.liters_loaded != null && (
                        <span>{sheet.liters_loaded} L</span>
                      )}
                      <span className="text-[var(--text)]">
                        Bruto: {moneyARS(sheet.total_trip_amount)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold text-tz-yellow">
                      {moneyARS(sheet.driver_amount)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">tu pago</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {isOpen ? "▲ cerrar" : "▼ ver detalle"}
                    </p>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-white/8 px-4 pb-4">
                  {expandedQuery.isPending && (
                    <div className="py-4 text-center text-sm text-[var(--muted)]">
                      Cargando...
                    </div>
                  )}
                  {detail && (
                    <>
                      {detail.diesel_price_snapshot && (
                        <p className="mt-3 text-xs text-[var(--muted)]">
                          Precio gasoil: {moneyARS(detail.diesel_price_snapshot)} / L
                        </p>
                      )}
                      {detail.observations && (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Obs: {detail.observations}
                        </p>
                      )}
                      {detail.trips && detail.trips.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                            Viajes
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {detail.trips.map((trip, i) => (
                              <div
                                key={trip.id ?? i}
                                className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                              >
                                <div className="flex gap-3 text-sm">
                                  <span className="font-medium text-[var(--text)]">
                                    #{trip.trip_number}
                                  </span>
                                  <span className="text-[var(--muted)]">
                                    {trip.distance_km} km
                                  </span>
                                </div>
                                <span className="text-sm font-semibold text-tz-yellow">
                                  {moneyARS(trip.driver_amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {total > page * LIMIT && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="w-full rounded-2xl border border-white/10 py-3 text-sm text-[var(--muted)] hover:border-tz-yellow/40 hover:text-tz-yellow transition-colors"
        >
          Cargar más
        </button>
      )}
    </div>
  );
}
