const FACTOR_BASE = 0.6;
const BATEA_M3 = 45;
const BASE_DISTANCE_KM = 4;
const EXTRA_LITERS_PER_KM = 4.5;
const DRIVER_RATE = 0.15;
const LUCAS_RATE = 0.04;
const IVA_RATE = 0.21;

export type TripCalcResult = {
  totalTrip: number;
  driverFee: number;
  lucasFee: number;
  dieselTheoretical: number;
};

export function calcTrip(
  distanceKm: number,
  dieselPriceWithIva: number
): TripCalcResult {
  const dieselWithoutIva = dieselPriceWithIva / (1 + IVA_RATE);
  const baseLiters = FACTOR_BASE * BATEA_M3;
  const basePrice = baseLiters * dieselPriceWithIva;
  const excessKm = Math.max(0, distanceKm - BASE_DISTANCE_KM);
  const extraLiters = excessKm * EXTRA_LITERS_PER_KM;
  const extraPrice = extraLiters * dieselWithoutIva;
  const totalTrip = basePrice + extraPrice;
  const driverFee = totalTrip * DRIVER_RATE;
  const lucasFee = totalTrip * LUCAS_RATE;
  const dieselLiters = baseLiters + extraLiters;
  const dieselTheoretical = dieselLiters * dieselPriceWithIva;
  return { totalTrip, driverFee, lucasFee, dieselTheoretical };
}

export type TripRow = {
  trip_number: string;
  distance_km: number;
};

export type PlanillaCalcResult = {
  trips: Array<TripCalcResult & TripRow>;
  totalTripAmount: number;
  totalDriverAmount: number;
  totalLucasFee: number;
  totalDieselTheoretical: number;
};

export function calcPlanilla(
  rows: TripRow[],
  dieselPriceWithIva: number
): PlanillaCalcResult {
  const trips = rows.map((r) => ({
    ...r,
    ...calcTrip(r.distance_km, dieselPriceWithIva),
  }));
  const totalTripAmount = trips.reduce((s, t) => s + t.totalTrip, 0);
  const totalDriverAmount = trips.reduce((s, t) => s + t.driverFee, 0);
  const totalLucasFee = trips.reduce((s, t) => s + t.lucasFee, 0);
  const totalDieselTheoretical = trips.reduce((s, t) => s + t.dieselTheoretical, 0);
  return { trips, totalTripAmount, totalDriverAmount, totalLucasFee, totalDieselTheoretical };
}
