import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { listMisViajes, getZafraConfig, type ZafraViaje } from "../services/zafraApi";
import { ZafraNav } from "../components/ZafraNav";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { moneyARS, dateAR, monthRange } from "../lib/format";
import { ZafraViajeModal } from "../components/ZafraViajeModal";

export function ZafraMisViajesPage() {
  const { currentDriver } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedViaje, setSelectedViaje] = useState<ZafraViaje | null>(null);

  const { from, to } = monthRange(year, month);

  const viajesQ = useQuery({
    queryKey: ["zafra", "mis-viajes", currentDriver?.id, { from, to }],
    queryFn: () =>
      listMisViajes({ choferId: currentDriver!.id, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const configQ = useQuery({
    queryKey: ["zafra-config"],
    queryFn: getZafraConfig,
    staleTime: 300_000,
  });

  const viajes = viajesQ.data?.viajes ?? [];
  const amarillos = viajes.filter((v) => v.modalidad === "AMARILLOS");

  const diasTrabajados = new Set(amarillos.map((v) => v.fecha)).size;
  const cantidadViajes = amarillos.length;

  const tarifaDiaria = configQ.data?.config?.amarillos.tarifaDiariaConductor ?? 0;
  const tarifaPorViaje = configQ.data?.config?.amarillos.tarifaPorViajeConductor ?? 0;

  const totalDias = diasTrabajados * tarifaDiaria;
  const totalViajes = cantidadViajes * tarifaPorViaje;

  return (
    <div className="flex flex-col gap-6">
      <ZafraNav />

      <div className="flex items-center justify-between">
        <SectionTitle>Mis Viajes (Zafra)</SectionTitle>
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Días" value={diasTrabajados} />
        <StatCard label="Total" value={moneyARS(totalDias)} accent />
        <StatCard label="Viajes" value={cantidadViajes} />
        <StatCard label="Total" value={moneyARS(totalViajes)} accent />
      </div>

      {viajesQ.isPending && <PageSpinner />}
      {viajesQ.isError && (
        <ErrorCard
          message="No se pudieron cargar los viajes"
          onRetry={() => viajesQ.refetch()}
        />
      )}
      {!viajesQ.isPending && viajes.length === 0 && (
        <EmptyState message="No tenés viajes este mes" />
      )}

      <div className="flex flex-col gap-3">
        {viajes.map((v, idx) => {
          const kmEfectivo = v.kmPagaIngenioSnapshot ?? v.kmIngenioFinca;
          return (
            <div key={v.id} onClick={() => setSelectedViaje(v)} className="cursor-pointer">
            <Card className="hover:border-white/20 transition-colors">
              {/* Línea 1: # fecha | comisión */}
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[var(--text)]">
                  <span className="text-tz-yellow font-bold mr-1">#{viajes.length - idx}</span>
                  {dateAR(v.fecha)}
                </p>
                <div className="text-right shrink-0">
                  {v.comisionChofer != null ? (
                    <>
                      <p className="font-display text-xl font-bold text-tz-yellow leading-tight">
                        {moneyARS(v.comisionChofer)}
                      </p>
                      {v.modalidad === "AMARILLOS" && (
                      <p className="text-xs text-[var(--muted)]">pago viaje</p>
                    )}
                    </>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">—</p>
                  )}
                </div>
              </div>

              {/* Línea 2: modalidad · camión */}
              <p className="mt-0.5 text-xs text-[var(--muted)] capitalize">
                {v.modalidad.toLowerCase()} · {v.camionNombre || currentDriver?.vehicleLabel}
              </p>

              {/* Línea 3: lugar · frente */}
              {(v.lugarNombre || v.frenteNumero) && (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {[v.lugarNombre, v.frenteNumero ? `Frente ${v.frenteNumero}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              {/* Línea 4: km odómetro | km ingenio | gasoil */}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
                <span>
                  Km: {v.kmSalida} → {v.kmLlegada}
                  <span className="ml-1 text-[var(--text)]">({v.kmRecorridos} km)</span>
                </span>
                <span className="text-[var(--muted)]">|</span>
                <span>
                  Ing: <span className="text-[var(--text)]">{kmEfectivo} km</span>
                </span>
                <span className="text-[var(--muted)]">|</span>
                <span>
                  Gasoil: <span className="text-[var(--text)]">{v.gasoil} L</span>
                </span>
              </div>

              {/* Línea 5: peso */}
              {v.pesoNetoKg != null && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Peso: <span className="text-[var(--text)]">{v.pesoNetoKg.toLocaleString("es-AR")} kg</span>
                </p>
              )}
            </Card>
            </div>
          );
        })}
      </div>

      {selectedViaje && (
        <ZafraViajeModal
          viaje={selectedViaje}
          onClose={() => setSelectedViaje(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["zafra"] });
            setSelectedViaje(null);
          }}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["zafra"] });
            setSelectedViaje(null);
          }}
        />
      )}
    </div>
  );
}
