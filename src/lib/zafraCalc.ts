import {
  tarifaAmarillosVigente,
  type ZafraConfig,
} from "../services/zafraApi";

export const DEFAULT_CONFIG: ZafraConfig = {
  particulares: {
    tarifaBase: 1850,
    tarifaPorKm: 92.5,
    tarifaPorKmReducida: 46.25,
    porcentajeComision: 0.15,
  },
  amarillos: {
    gananciaDiariaOwner: 133333.33,
    tarifaDiariaConductor: 56000,
    tarifaPorViajeConductor: 12000,
  },
};

export function asNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export type MotivoSinMonto = "sin_km_lugar" | "sin_peso" | null;

export type MontosViaje = {
  valorUnitarioARS: number | null;
  valorTotalARS: number | null;
  comisionChofer: number | null;
  motivoSinMonto: MotivoSinMonto;
};

const SIN_MONTO = (motivo: Exclude<MotivoSinMonto, null>): MontosViaje => ({
  valorUnitarioARS: null,
  valorTotalARS: null,
  comisionChofer: null,
  motivoSinMonto: motivo,
});

/**
 * Montos de un viaje de PARTICULARES.
 *
 * El chofer ya no carga el odómetro, así que `kmPagaIngenio` (el km configurado
 * del lugar) es la ÚNICA fuente de km. Antes había un fallback a
 * `kmIngenioFinca = (kmLlegada - kmSalida) / 2`; sin él, un lugar sin km
 * configurado no se puede tarifar.
 *
 * En ese caso los tres montos vuelven en null y NO en 0: un 0 se persiste como
 * un viaje válido cobrado en cero y entra así a liquidaciones sin que nadie lo
 * note. Con null el viaje queda sin tarifar y oficina lo completa.
 *
 * `kmPagaIngenio <= 0` cuenta como "no configurado": un ingenio-finca de 0 km
 * no existe, y devolvería un valorUnitario = tarifaBase verosímil pero falso.
 */
export function calcMontosParticulares(p: {
  kmPagaIngenio: number | null | undefined;
  pesoNetoKg: number | null;
  tarifaBase: number;
  tarifaPorKm: number;
  porcentajeComision: number;
}): MontosViaje {
  const { kmPagaIngenio, pesoNetoKg, tarifaBase, tarifaPorKm, porcentajeComision } = p;

  if (kmPagaIngenio == null || !Number.isFinite(kmPagaIngenio) || kmPagaIngenio <= 0) {
    return SIN_MONTO("sin_km_lugar");
  }
  if (pesoNetoKg == null || !Number.isFinite(pesoNetoKg) || pesoNetoKg <= 0) {
    return SIN_MONTO("sin_peso");
  }

  const valorUnitarioARS = tarifaBase + tarifaPorKm * kmPagaIngenio;
  const valorTotalARS = valorUnitarioARS * (pesoNetoKg / 1000);
  const comisionChofer = valorTotalARS * porcentajeComision;

  return { valorUnitarioARS, valorTotalARS, comisionChofer, motivoSinMonto: null };
}

/** Comisión de un viaje de AMARILLOS: tarifa por viaje vigente a esa fecha. */
export function comisionAmarillos(
  amarillos: ZafraConfig["amarillos"] | undefined,
  fecha: string
): number {
  return tarifaAmarillosVigente(amarillos, fecha).tarifaPorViajeConductor;
}
