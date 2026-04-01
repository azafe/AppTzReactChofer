import type { LimonFinca } from "../types/limones";

export function calcularToneladas(peso_real_kg: number): number {
  return peso_real_kg / 1000;
}

export function calcularIngresoBruto(toneladas: number, tarifa_bins: number): number {
  return toneladas * tarifa_bins;
}

export function calcularCorteChofer(ingreso_bruto: number): number {
  return ingreso_bruto * 0.15;
}

export function calcularConsumoTeoricoLitros(
  km_distancia: number,
  consumo_l100km: number
): number {
  const km_totales = km_distancia * 2;
  return (km_totales * consumo_l100km) / 100;
}

export function calcularEficienciaReal(km_gps: number, litros_cargados: number): number {
  return (litros_cargados / km_gps) * 100;
}

export interface LimonCalculos {
  toneladas: number;
  ingreso_bruto: number;
  corte_chofer: number;
  consumo_teorico_litros: number | null;
}

export function calcularViaje(params: {
  peso_real_kg: number;
  finca: LimonFinca;
  consumo_teorico_l100km: number | null;
}): LimonCalculos {
  const toneladas = calcularToneladas(params.peso_real_kg);
  const ingreso_bruto = calcularIngresoBruto(toneladas, params.finca.precio_bins);
  const corte_chofer = calcularCorteChofer(ingreso_bruto);
  const consumo_teorico_litros = params.consumo_teorico_l100km
    ? calcularConsumoTeoricoLitros(params.finca.km_distancia, params.consumo_teorico_l100km)
    : null;
  return { toneladas, ingreso_bruto, corte_chofer, consumo_teorico_litros };
}
