import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { listMisViajesLimones } from "../services/limonesApi";
import { getAnticipos } from "../services/picadoApi";
import { LimonesNav } from "../components/LimonesNav";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { moneyARS, dateAR, monthRange } from "../lib/format";

export function LimonesMiPagoPage() {
  const { currentDriver } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { from, to } = monthRange(year, month);

  const viajesQ = useQuery({
    queryKey: ["limones-mis-viajes-pago", currentDriver?.id, { from, to }],
    queryFn: () => listMisViajesLimones({ choferId: currentDriver!.id, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const anticiposQ = useQuery({
    queryKey: ["anticipos", currentDriver?.id, { from, to }],
    queryFn: () => getAnticipos({ chofer: currentDriver!.name, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const viajes = viajesQ.data?.viajes ?? [];
  const anticipos = anticiposQ.data ?? [];

  const totalViajes = viajes.length;
  const totalIngresos = viajes.reduce((s, v) => s + (v.corte_chofer ?? 0), 0);
  const totalAnticipos = anticipos.reduce((s, a) => s + a.monto, 0);
  const aCobrar = totalIngresos - totalAnticipos;

  const isPending = viajesQ.isPending || anticiposQ.isPending;
  const isError = viajesQ.isError || anticiposQ.isError;

  return (
    <div className="flex flex-col gap-6">
      <LimonesNav />

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
          onRetry={() => { viajesQ.refetch(); anticiposQ.refetch(); }}
        />
      )}

      {!isPending && !isError && (
        <>
          {/* A cobrar highlight */}
          <Card className="border-tz-yellow/30 bg-[var(--accent-soft)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-tz-yellow">
              A cobrar
            </p>
            <p className="mt-1 font-display text-4xl font-bold text-tz-yellow">
              {moneyARS(aCobrar)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Ingresos menos anticipos recibidos</p>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total viajes" value={totalViajes} />
            <StatCard label="Ingresos" value={moneyARS(totalIngresos)} accent />
            <StatCard label="Anticipos recibidos" value={moneyARS(totalAnticipos)} />
            <StatCard label="A cobrar" value={moneyARS(aCobrar)} accent={aCobrar > 0} />
          </div>

          {/* Viajes del período */}
          {viajes.length === 0 ? (
            <EmptyState message="No hay viajes registrados este mes" />
          ) : (
            <Card className="p-0 overflow-hidden">
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-white/8">
                Viajes del período
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--muted)]">
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 font-medium">Finca</th>
                      <th className="px-4 py-2 font-medium text-right text-tz-yellow">Mi pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...viajes]
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
                      <td className="px-4 py-3 text-right font-bold text-tz-yellow">{moneyARS(totalIngresos)}</td>
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
