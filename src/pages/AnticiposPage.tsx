import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getAnticipos } from "../services/picadoApi";
import { StatCard, Card, SectionTitle, Chip } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { moneyARS, dateAR, monthRange } from "../lib/format";

export function AnticiposPage() {
  const { currentDriver } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { from, to } = monthRange(year, month);

  const query = useQuery({
    queryKey: ["anticipos", currentDriver?.id, { from, to }],
    queryFn: () => getAnticipos({ chofer: currentDriver!.name, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const filtered = query.data ?? [];

  const totalMonto = filtered.reduce((s, a) => s + a.monto, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Anticipos</SectionTitle>
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>

      {/* Info banner */}
      <div className="rounded-2xl border border-tz-yellow/20 bg-tz-yellow/5 p-3">
        <p className="text-xs text-[var(--muted)]">
          ℹ️ Los anticipos son registrados por el administrador. Aquí podés consultar los adelantos recibidos.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total anticipos" value={moneyARS(totalMonto)} accent />
        <StatCard label="Cantidad" value={filtered.length} sub="registros" />
      </div>

      {query.isPending && <PageSpinner />}
      {query.isError && (
        <ErrorCard
          message="No se pudieron cargar los anticipos"
          onRetry={() => query.refetch()}
        />
      )}
      {!query.isPending && filtered.length === 0 && (
        <EmptyState message="No hay anticipos registrados este mes" />
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((anticipo) => (
          <Card key={anticipo.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-[var(--text)]">
                  {dateAR(anticipo.fecha)}
                </p>
                <div className="mt-1">
                  <Chip variant={anticipo.metodo === "EFECTIVO" ? "neutral" : "good"}>
                    {anticipo.metodo}
                  </Chip>
                </div>
                {anticipo.observacion && (
                  <p className="mt-1.5 text-xs text-[var(--muted)]">
                    {anticipo.observacion}
                  </p>
                )}
              </div>
              <p className="font-display text-xl font-bold text-tz-yellow">
                {moneyARS(anticipo.monto)}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
