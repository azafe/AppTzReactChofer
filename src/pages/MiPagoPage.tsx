import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getSheets, getAnticipos } from "../services/picadoApi";
import { listMisViajesLimones } from "../services/limonesApi";
import { listMisViajes, getZafraConfig, listMisAmarillosDias } from "../services/zafraApi";
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
  const hasZafra = modulos.includes("ZAFRA");

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

  const zafraViajesQ = useQuery({
    queryKey: ["zafra", "mis-viajes", currentDriver?.id, { from, to }],
    queryFn: () => listMisViajes({ choferId: currentDriver!.id, from, to }),
    enabled: !!currentDriver && hasZafra,
    staleTime: 60_000,
  });

  const zafraConfigQ = useQuery({
    queryKey: ["zafra-config"],
    queryFn: getZafraConfig,
    enabled: hasZafra,
    staleTime: 300_000,
  });

  const amarillosDiasQ = useQuery({
    queryKey: ["amarillos-dias", currentDriver?.id, { from, to }],
    queryFn: () => listMisAmarillosDias({ choferId: currentDriver!.id, from, to }),
    enabled: !!currentDriver && hasZafra,
    staleTime: 60_000,
  });

  // ─── Picado ──────────────────────────────────────────────────────────────────
  const sheets = sheetsQuery.data?.data ?? [];
  const picadoIngresos = sheets.reduce((s, sh) => s + (sh.driver_amount ?? 0), 0);
  const picadoViajes = sheets.reduce((s, sh) => s + (sh.trip_count ?? 0), 0);

  // ─── Limones ─────────────────────────────────────────────────────────────────
  const limonesViajes = limonesQ.data?.viajes ?? [];
  const limonesIngresos = limonesViajes.reduce((s, v) => s + (v.corte_chofer ?? 0), 0);
  const limonesViajesCount = limonesViajes.length;

  // ─── Zafra Amarillos ─────────────────────────────────────────────────────────
  const zafraViajes = zafraViajesQ.data?.viajes ?? [];
  const amarillosViajes = zafraViajes.filter(v => v.modalidad === "AMARILLOS");
  const particularesViajes = zafraViajes.filter(v => v.modalidad === "PARTICULARES");

  const diasTrabajados = (amarillosDiasQ.data?.dias ?? []).filter(d => d.trabajo).length;
  const amarillosViajesCount = amarillosViajes.length;
  const tarifaDiaria = zafraConfigQ.data?.config?.amarillos.tarifaDiariaConductor ?? 0;
  const tarifaPorViaje = zafraConfigQ.data?.config?.amarillos.tarifaPorViajeConductor ?? 0;
  const totalAmarillosDias = diasTrabajados * tarifaDiaria;
  const totalAmarillosViajes = amarillosViajesCount * tarifaPorViaje;
  const amarillosIngresos = totalAmarillosDias + totalAmarillosViajes;

  // ─── Zafra Particulares ───────────────────────────────────────────────────────
  const particularesIngresos = particularesViajes.reduce((s, v) => s + (v.comisionChofer ?? 0), 0);
  const particularesCount = particularesViajes.length;

  // ─── Totales ─────────────────────────────────────────────────────────────────
  const anticipos = anticiposQuery.data ?? [];
  const totalAnticipos = anticipos.reduce((s, a) => s + a.monto, 0);
  const totalIngresos =
    (hasPicado ? picadoIngresos : 0) +
    (hasLimones ? limonesIngresos : 0) +
    (hasZafra ? amarillosIngresos + particularesIngresos : 0);
  const aCobrar = totalIngresos - totalAnticipos;

  const isPending =
    (hasPicado && sheetsQuery.isPending) ||
    anticiposQuery.isPending ||
    (hasLimones && limonesQ.isPending) ||
    (hasZafra && (zafraViajesQ.isPending || zafraConfigQ.isPending || amarillosDiasQ.isPending));

  const isError =
    (hasPicado && sheetsQuery.isError) ||
    anticiposQuery.isError ||
    (hasLimones && limonesQ.isError) ||
    (hasZafra && (zafraViajesQ.isError || zafraConfigQ.isError || amarillosDiasQ.isError));

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
            if (hasZafra) {
              zafraViajesQ.refetch();
              zafraConfigQ.refetch();
              amarillosDiasQ.refetch();
            }
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
            {hasZafra && (amarillosViajes.length > 0 || diasTrabajados > 0) && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Amarillos</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Días" value={diasTrabajados} />
                  <StatCard label="Total" value={moneyARS(totalAmarillosDias)} accent />
                  <StatCard label="Viajes" value={amarillosViajesCount} />
                  <StatCard label="Total" value={moneyARS(totalAmarillosViajes)} accent />
                </div>
              </div>
            )}

            {hasZafra && particularesViajes.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Particulares</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Viajes" value={particularesCount} />
                  <StatCard label="Total" value={moneyARS(particularesIngresos)} accent />
                </div>
              </div>
            )}

            {hasLimones && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Limones</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Viajes" value={limonesViajesCount} />
                  <StatCard label="Total" value={moneyARS(limonesIngresos)} accent />
                </div>
              </div>
            )}

            {hasPicado && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Picado</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Viajes" value={picadoViajes} />
                  <StatCard label="Total" value={moneyARS(picadoIngresos)} accent />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
