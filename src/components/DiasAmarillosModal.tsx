import { moneyARS, dateAR } from "../lib/format";
import { ModalPortal } from "./ModalPortal";

interface DiaAmarillo {
  id: string;
  fecha: string;
  camionNombre: string;
  porcentaje?: number;
  compartidoCon?: string | null;
}

interface DiasAmarillosModalProps {
  dias: DiaAmarillo[];
  tarifaDiaria: number;
  onClose: () => void;
}

export function DiasAmarillosModal({ dias, tarifaDiaria, onClose }: DiasAmarillosModalProps) {
  const ordenados = [...dias].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const total = ordenados.reduce((s, d) => s + tarifaDiaria * (d.porcentaje ?? 1), 0);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#0a0c0f] p-6 shadow-xl max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold text-[var(--text)]">
              <span className="text-tz-yellow font-bold mr-1">Días</span>
              trabajados
            </p>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--muted)] hover:text-[var(--text)] transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {ordenados.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              No hay días cargados este mes.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {ordenados.map((d) => {
                const compartido = (d.porcentaje ?? 1) < 1;
                return (
                  <div
                    key={d.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)] capitalize">
                          {dateAR(d.fecha)}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">{d.camionNombre}</p>
                      </div>
                      <p className="font-display text-base font-bold text-tz-yellow shrink-0">
                        {moneyARS(tarifaDiaria * (d.porcentaje ?? 1))}
                      </p>
                    </div>
                    {compartido && (
                      <p className="mt-2 text-xs text-tz-yellow">
                        Compartido con {d.compartidoCon ?? "otro chofer"} · {Math.round((d.porcentaje ?? 1) * 100)}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {ordenados.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
                Total
              </p>
              <p className="font-display text-xl font-bold text-tz-yellow">{moneyARS(total)}</p>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
