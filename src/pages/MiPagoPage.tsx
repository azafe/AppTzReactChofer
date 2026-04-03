import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getSheets, getAnticipos } from "../services/picadoApi";
import { listMisViajesLimones } from "../services/limonesApi";
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
    queryFn: () => getAnticipos({ chofer: currentDriver!.name, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const limonesQ = useQuery({
    queryKey: ["limones-mis-viajes-pago", currentDriver?.id, { from, to }],
    queryFn: () => listMisViajesLimones({ choferId: currentDriver!.id, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const sheets = sheetsQuery.data?.data ?? [];
  const anticipos = anticiposQuery.data ?? [];
  const limonesViajes = limonesQ.data?.viajes ?? [];

  // Picado
  const totalViajes = sheets.reduce((s, sh) => s + (sh.trip_count ?? 0), 0);
  const totalBruto = sheets.reduce((s, sh) => s + (sh.total_trip_amount ?? 0), 0);
  const totalDriverAmount = sheets.reduce((s, sh) => s + (sh.driver_amount ?? 0), 0);

  // Limones
  const limonesTotalViajes = limonesViajes.length;
  const limonesTotalIngresos = limonesViajes.reduce((s, v) => s + (v.corte_chofer ?? 0), 0);

  // Anticipos (compartidos)
  const totalAnticipos = anticipos.reduce((s, a) => s + a.monto, 0);

  // A cobrar total
  const saldoPendiente = totalDriverAmount + limonesTotalIngresos - totalAnticipos;

  const isPending = sheetsQuery.isPending || anticiposQuery.isPending || limonesQ.isPending;
  const isError = sheetsQuery.isError || anticiposQuery.isError || limonesQ.isError;

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
            limonesQ.refetch();
          }}
        />
      )}

      {!isPending && !isError && (
        <>
          {/* A cobrar total */}
          <Card className="border-tz-yellow/30 bg-[var(--accent-soft)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-tz-yellow">
              A cobrar
            </p>
            <p className="mt-1 font-display text-4xl font-bold text-tz-yellow">
              {moneyARS(saldoPendiente)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Total ingresos menos anticipos recibidos</p>
          </Card>

          {/* Stats globales */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Anticipos recibidos" value={moneyARS(totalAnticipos)} />
            <StatCard label="A cobrar" value={moneyARS(saldoPendiente)} accent={saldoPendiente > 0} />
          </div>

          {/* ─── Sección Limones ─── */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Limones</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total viajes" value={limonesTotalViajes} />
              <StatCard label="Ingresos" value={moneyARS(limonesTotalIngresos)} accent />
            </div>

            {limonesViajes.length > 0 && (
              <Card className="p-0 overflow-hidden mt-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[var(--muted)] border-b border-white/8">
                        <th className="px-4 py-2 font-medium">Fecha</th>
                        <th className="px-4 py-2 font-medium">Finca</th>
                        <th className="px-4 py-2 font-medium text-right text-tz-yellow">Mi pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...limonesViajes]
                        .sort((a, b) => a.fecha.localeCompare(b.fecha))
                        .map((v) => (
                          <tr key={v.id} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                            <td className="px-4 py-2.5 text-[var(--text)] whitespace-nowrap">{dateAR(v.fecha)}</td>
                            <td className="px-4 py-2.5 text-[var(--muted)]">{v.finca?.nombre ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-tz-yellow">
                              {v.corte_chofer != null ? moneyARS(v.corte_chofer) : "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-white/15">
                        <td className="px-4 py-3 text-xs font-bold text-[var(--muted)] uppercase" colSpan={2}>Total</td>
                        <td className="px-4 py-3 text-right font-bold text-tz-yellow">{moneyARS(limonesTotalIngresos)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            )}

            {limonesViajes.length === 0 && (
              <EmptyState message="No hay viajes de limones este mes" />
            )}
          </div>

          {/* ─── Sección Picado ─── */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Picado</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total viajes" value={totalViajes} />
              <StatCard label="Ingresos" value={moneyARS(totalDriverAmount)} accent />
            </div>

            {sheets.length === 0 ? (
              <EmptyState message="No hay viajes de picado este mes" />
            ) : (
              <Card className="p-0 overflow-hidden mt-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[var(--muted)] border-b border-white/8">
                        <th className="px-4 py-2 font-medium">Fecha</th>
                        <th className="px-4 py-2 font-medium text-center">Viajes</th>
                        <th className="px-4 py-2 font-medium text-right">Bruto</th>
                        <th className="px-4 py-2 font-medium text-right text-tz-yellow">Tu pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSheets.map((sheet) => (
                        <tr key={sheet.id} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-2.5 text-[var(--text)]">{dateAR(sheet.sheet_date)}</td>
                          <td className="px-4 py-2.5 text-center text-[var(--muted)]">{sheet.trip_count ?? 0}</td>
                          <td className="px-4 py-2.5 text-right text-[var(--muted)]">{moneyARS(sheet.total_trip_amount)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-tz-yellow">{moneyARS(sheet.driver_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-white/15">
                        <td className="px-4 py-3 text-xs font-bold text-[var(--muted)] uppercase">Total</td>
                        <td className="px-4 py-3 text-center font-bold text-[var(--text)]">{totalViajes}</td>
                        <td className="px-4 py-3 text-right font-bold text-[var(--text)]">{moneyARS(totalBruto)}</td>
                        <td className="px-4 py-3 text-right font-bold text-tz-yellow">{moneyARS(totalDriverAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
