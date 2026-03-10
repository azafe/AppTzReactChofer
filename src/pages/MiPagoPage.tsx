import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getSheets, getAnticipos } from "../services/picadoApi";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { moneyARS, dateAR, monthRange } from "../lib/format";

export function MiPagoPage() {
  const { currentDriver } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { from, to } = monthRange(year, month);

  const sheetsQuery = useQuery({
    queryKey: ["picado", "sheets", currentDriver?.id, { from, to, limit: 200 }],
    queryFn: () =>
      getSheets({ driverId: currentDriver!.id, from, to, limit: 200 }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const anticiposQuery = useQuery({
    queryKey: ["anticipos", currentDriver?.id, { from, to }],
    queryFn: () => getAnticipos(),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const sheets = sheetsQuery.data?.data ?? [];
  const allAnticipos = anticiposQuery.data ?? [];

  // Filter anticipos by driver and date range
  const anticipos = allAnticipos.filter((a) => {
    if (a.chofer !== currentDriver?.name) return false;
    const d = a.fecha.substring(0, 10);
    return d >= from && d <= to;
  });

  const totalViajes = sheets.reduce((s, sh) => s + (sh.trip_count ?? 0), 0);
  const totalBruto = sheets.reduce((s, sh) => s + (sh.total_trip_amount ?? 0), 0);
  const totalDriverAmount = sheets.reduce((s, sh) => s + (sh.driver_amount ?? 0), 0);
  const totalAnticipos = anticipos.reduce((s, a) => s + a.monto, 0);
  const saldoPendiente = totalDriverAmount - totalAnticipos;

  const isPending = sheetsQuery.isPending || anticiposQuery.isPending;
  const isError = sheetsQuery.isError || anticiposQuery.isError;

  // Sort sheets by date
  const sortedSheets = [...sheets].sort((a, b) =>
    a.sheet_date.localeCompare(b.sheet_date)
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Mi Pago</SectionTitle>
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>

      {isPending && <PageSpinner />}
      {isError && (
        <ErrorCard
          message="No se pudo cargar la información de pago"
          onRetry={() => {
            sheetsQuery.refetch();
            anticiposQuery.refetch();
          }}
        />
      )}

      {!isPending && !isError && (
        <>
          {/* Main pay card */}
          <Card className="border-tz-yellow/30 bg-[var(--accent-soft)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-tz-yellow">
              Tu pago del mes
            </p>
            <p className="mt-1 font-display text-4xl font-bold text-tz-yellow">
              {moneyARS(totalDriverAmount)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">15% del ingreso bruto</p>
          </Card>

          {/* Desglose */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total viajes" value={totalViajes} />
            <StatCard label="Ingreso bruto" value={moneyARS(totalBruto)} />
            <StatCard label="Anticipos recibidos" value={moneyARS(totalAnticipos)} />
            <StatCard
              label="Saldo pendiente"
              value={moneyARS(saldoPendiente)}
              accent={saldoPendiente > 0}
            />
          </div>

          {/* Day-by-day table */}
          {sheets.length === 0 ? (
            <EmptyState message="No hay viajes registrados este mes" />
          ) : (
            <Card className="p-0 overflow-hidden">
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-white/8">
                Detalle por día
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--muted)]">
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 font-medium text-center">Viajes</th>
                      <th className="px-4 py-2 font-medium text-right">Bruto</th>
                      <th className="px-4 py-2 font-medium text-right text-tz-yellow">
                        Tu pago
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSheets.map((sheet) => (
                      <tr
                        key={sheet.id}
                        className="border-t border-white/5 hover:bg-white/3 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-[var(--text)]">
                          {dateAR(sheet.sheet_date)}
                        </td>
                        <td className="px-4 py-2.5 text-center text-[var(--muted)]">
                          {sheet.trip_count ?? 0}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[var(--muted)]">
                          {moneyARS(sheet.total_trip_amount)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-tz-yellow">
                          {moneyARS(sheet.driver_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-white/15">
                      <td className="px-4 py-3 text-xs font-bold text-[var(--muted)] uppercase">
                        Total
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[var(--text)]">
                        {totalViajes}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text)]">
                        {moneyARS(totalBruto)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-tz-yellow">
                        {moneyARS(totalDriverAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
