import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getSheets, getAnticipos } from "../services/picadoApi";
import { listMisViajesLimones } from "../services/limonesApi";
import { listMisViajes, getZafraConfig, listMisAmarillosDias } from "../services/zafraApi";
import { Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard } from "../components/Spinner";
import { moneyARS, monthRange } from "../lib/format";

function ReceiptRow({
  label,
  sub,
  amount,
  accent,
  bold,
}: {
  label: string;
  sub?: string;
  amount: string;
  accent?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-1">
      <span className={`text-sm ${bold ? "font-semibold text-[var(--text)]" : "text-[var(--muted)]"}`}>
        {label}
        {sub && <span className="ml-1 text-xs text-[var(--muted)]">{sub}</span>}
      </span>
      <span className={`text-sm tabular-nums shrink-0 ${accent ? "font-bold text-tz-yellow" : bold ? "font-semibold text-[var(--text)]" : "text-[var(--text)]"}`}>
        {amount}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1 mt-3 first:mt-0">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="border-t border-[var(--border)] my-2" />;
}

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

  const hasAmarillos = hasZafra && (amarillosViajes.length > 0 || diasTrabajados > 0);
  const hasParticulares = hasZafra && particularesViajes.length > 0;

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
    <div className="flex flex-col gap-4">
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

          {/* Recibo de haberes */}
          <Card>
            {/* ── Amarillos ── */}
            {hasAmarillos && (
              <>
                <SectionLabel>Amarillos</SectionLabel>
                <ReceiptRow
                  label="Días"
                  sub={`(${diasTrabajados})`}
                  amount={moneyARS(totalAmarillosDias)}
                />
                <ReceiptRow
                  label="Viajes"
                  sub={`(${amarillosViajesCount})`}
                  amount={moneyARS(totalAmarillosViajes)}
                />
                <div className="border-t border-[var(--border)] mt-1 pt-1">
                  <ReceiptRow
                    label="Total Amarillos"
                    amount={moneyARS(amarillosIngresos)}
                    accent
                    bold
                  />
                </div>
              </>
            )}

            {/* ── Particulares ── */}
            {hasParticulares && (
              <>
                {hasAmarillos && <Divider />}
                <SectionLabel>Particulares</SectionLabel>
                <ReceiptRow
                  label="Viajes"
                  sub={`(${particularesCount})`}
                  amount={moneyARS(particularesIngresos)}
                />
              </>
            )}

            {/* ── Limones ── */}
            {hasLimones && (
              <>
                {(hasAmarillos || hasParticulares) && <Divider />}
                <SectionLabel>Limones</SectionLabel>
                <ReceiptRow
                  label="Viajes"
                  sub={`(${limonesViajesCount})`}
                  amount={moneyARS(limonesIngresos)}
                />
              </>
            )}

            {/* ── Picado ── */}
            {hasPicado && (
              <>
                {(hasAmarillos || hasParticulares || hasLimones) && <Divider />}
                <SectionLabel>Picado</SectionLabel>
                <ReceiptRow
                  label="Viajes"
                  sub={`(${picadoViajes})`}
                  amount={moneyARS(picadoIngresos)}
                />
              </>
            )}

            {/* ── Total ingresos ── */}
            <div className="border-t border-[var(--border)] mt-2 pt-2">
              <ReceiptRow
                label="Total ingresos"
                amount={moneyARS(totalIngresos)}
                bold
              />
            </div>

            {/* ── Deducciones ── */}
            <div className="border-t border-[var(--border)] mt-2 pt-2">
              <SectionLabel>Deducciones</SectionLabel>
              <ReceiptRow
                label="Anticipos"
                sub={anticipos.length > 0 ? `(${anticipos.length})` : undefined}
                amount={`− ${moneyARS(totalAnticipos)}`}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
