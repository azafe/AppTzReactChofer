import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { listMisCargas, patchCargaFoto, uploadLimonesFoto, type LimonCarga } from "../services/limonesApi";
import { LimonesNav } from "../components/LimonesNav";
import { StatCard, Card, SectionTitle } from "../components/Card";
import { MonthPicker } from "../components/MonthPicker";
import { PageSpinner, ErrorCard, EmptyState } from "../components/Spinner";
import { showToast } from "../components/Toast";
import { dateAR, monthRange } from "../lib/format";

export function LimonesMisCargas() {
  const { currentDriver } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { from, to } = monthRange(year, month);

  const cargasQ = useQuery({
    queryKey: ["limones-mis-cargas", currentDriver?.id, { from, to }],
    queryFn: () => listMisCargas({ choferId: currentDriver!.id, from, to }),
    enabled: !!currentDriver,
    staleTime: 60_000,
  });

  const cargas = cargasQ.data?.cargas ?? [];
  const totalLitros = cargas.reduce((s, c) => s + c.litros, 0);

  return (
    <div className="flex flex-col gap-6">
      <LimonesNav />

      <div className="flex items-center justify-between">
        <SectionTitle>Mis Cargas (Limones)</SectionTitle>
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Cargas" value={cargas.length} />
        <StatCard label="Litros totales" value={totalLitros > 0 ? `${totalLitros.toFixed(0)} L` : "0 L"} />
      </div>

      {cargasQ.isPending && <PageSpinner />}
      {cargasQ.isError && (
        <ErrorCard
          message="No se pudieron cargar las cargas"
          onRetry={() => cargasQ.refetch()}
        />
      )}
      {!cargasQ.isPending && cargas.length === 0 && (
        <EmptyState message="No tenés cargas este mes" />
      )}

      <div className="flex flex-col gap-3">
        {cargas.map((c) => (
          <CargaCard
            key={c.id}
            carga={c}
            onFotoUpdated={() =>
              queryClient.invalidateQueries({ queryKey: ["limones-mis-cargas"] })
            }
          />
        ))}
      </div>
    </div>
  );
}

function CargaCard({
  carga,
  onFotoUpdated,
}: {
  carga: LimonCarga;
  onFotoUpdated: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: (url: string | null) => patchCargaFoto(carga.id, url),
    onSuccess: () => {
      showToast("Foto guardada ✓");
      onFotoUpdated();
    },
    onError: () => showToast("Error al guardar la foto", "error"),
  });

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-[var(--text)]">{dateAR(carga.fecha)}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{carga.camionNombre}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
            <span>
              {carga.litros} L
              {carga.tanqueInicial != null && (
                <span className="ml-1 text-[var(--text)]">
                  (disponible: {(carga.litros + carga.tanqueInicial).toFixed(0)} L)
                </span>
              )}
            </span>
            <span>{carga.origen === "BASE_TZ" ? "Base TZ" : "Ext."}</span>
            <span>{carga.kmOdometro} km</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-xl font-bold text-tz-yellow">
            {carga.litros.toFixed(0)} L
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-white/5 pt-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
              const res = await uploadLimonesFoto(file, "limones-gasoil");
              mutation.mutate(res.url);
            } catch {
              showToast("Error al subir la foto", "error");
            } finally {
              setUploading(false);
              e.target.value = "";
            }
          }}
        />
        {carga.fotoRemitoUrl ? (
          <div className="flex items-center gap-3">
            <a href={carga.fotoRemitoUrl} target="_blank" rel="noreferrer">
              <img
                src={carga.fotoRemitoUrl}
                alt="Remito gasoil"
                className="h-10 w-10 rounded-lg border border-white/15 object-cover"
              />
            </a>
            <button
              type="button"
              disabled={uploading || mutation.isPending}
              onClick={() => inputRef.current?.click()}
              className="text-xs text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"
            >
              Cambiar foto
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading || mutation.isPending}
            onClick={() => inputRef.current?.click()}
            className="h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] text-sm text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {uploading || mutation.isPending ? "Subiendo..." : "Subir foto remito gasoil"}
          </button>
        )}
      </div>
    </Card>
  );
}

