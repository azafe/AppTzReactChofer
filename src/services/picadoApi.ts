import { apiGet, apiPost, apiPut } from "../lib/http";
import type { PicadoSheet, PicadoTrip, Anticipo, PicadoSummary, PicadoConfig } from "../types/picado";

function normalizeTrip(raw: Record<string, unknown>): PicadoTrip {
  // distance puede venir en km (float) o en metros como entero (distanceInput)
  const rawKm = raw.distance_km ?? raw.distanceKm;
  const rawInput = raw.distanceInput;
  let distanceKm: number | null = null;
  if (rawKm != null) {
    distanceKm = Number(rawKm);
  } else if (rawInput != null) {
    distanceKm = Number(rawInput) / 1000;
  }
  return {
    id: (raw.id ?? raw._id) as string | undefined,
    sheet_id: (raw.sheet_id ?? raw.sheetId) as string | undefined,
    trip_number: String(raw.trip_number ?? raw.tripNumber ?? ""),
    distance_km: distanceKm,
    total_trip_amount: (raw.total_trip_amount ?? raw.grossTrip ?? raw.totalTripAmount ?? null) as number | null,
    driver_amount: (raw.driver_amount ?? raw.driverPay ?? raw.driverFee ?? null) as number | null,
    diesel_theoretical_amount: (raw.diesel_theoretical_amount ?? raw.dieselTheoretical ?? null) as number | null,
    created_at: (raw.created_at ?? raw.createdAt ?? null) as string | null,
  };
}

// La API devuelve campos tanto en camelCase como snake_case — normalizar todo
function normalizeSheet(raw: Record<string, unknown>): PicadoSheet {
  const normalizeDate = (v: unknown) => {
    if (!v || typeof v !== "string") return "";
    return v.includes("T") ? v.slice(0, 10) : v.slice(0, 10);
  };
  const plate =
    (raw.vehicle_label ?? raw.vehicleLabel ?? raw.license_plate ?? raw.licensePlate ?? raw.vehicle_id ?? raw.vehicleId ?? null) as string | null;
  return {
    id: raw.id as string,
    sheet_date: normalizeDate(raw.sheet_date ?? raw.sheetDate),
    sheet_number: (raw.sheet_number ?? raw.sheetNumber ?? null) as string | null,
    driver_id: (raw.driver_id ?? raw.driverId ?? null) as string | null,
    driver_name: (raw.driver_name ?? raw.driverName ?? null) as string | null,
    vehicle_id: (raw.vehicle_id ?? raw.vehicleId ?? null) as string | null,
    vehicle_label: plate,
    license_plate: (raw.license_plate ?? raw.licensePlate ?? plate) as string | null,
    liters_loaded: (raw.liters_loaded ?? raw.litersLoaded ?? null) as number | null,
    observations: (raw.observations ?? raw.notes ?? null) as string | null,
    source_type: (raw.source_type ?? raw.sourceType ?? null) as string | null,
    trip_count: (raw.trip_count ?? raw.tripsCount ?? null) as number | null,
    total_trip_amount: (raw.total_trip_amount ?? raw.grossDay ?? null) as number | null,
    driver_amount: (raw.driver_amount ?? raw.driverPay ?? null) as number | null,
    lucas_fee_amount: (raw.lucas_fee_amount ?? raw.lucasFee ?? null) as number | null,
    diesel_theoretical_amount: (raw.diesel_theoretical_amount ?? null) as number | null,
    diesel_price_snapshot: (raw.diesel_price_snapshot ?? raw.diesel_price_with_iva ?? raw.dieselPriceWithVat ?? null) as number | null,
    diesel_real_value: (raw.diesel_real_value ?? null) as number | null,
    neto_tz_teorico: (raw.neto_tz_teorico ?? null) as number | null,
    neto_tz_real: (raw.neto_tz_real ?? null) as number | null,
    trips: Array.isArray(raw.trips)
      ? (raw.trips as Record<string, unknown>[]).map(normalizeTrip)
      : null,
    created_at: (raw.created_at ?? raw.createdAt ?? null) as string | null,
    updated_at: (raw.updated_at ?? raw.updatedAt ?? null) as string | null,
  };
}

function extractSheets(res: unknown): PicadoSheet[] {
  if (Array.isArray(res)) return (res as Record<string, unknown>[]).map(normalizeSheet);
  const r = res as Record<string, unknown>;
  const raw = r?.dailySheets ?? r?.sheets ?? r?.data ?? [];
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]).map(normalizeSheet) : [];
}

function extractTotal(res: unknown): number {
  if (Array.isArray(res)) return res.length;
  const r = res as Record<string, unknown>;
  const meta = r?.meta as Record<string, unknown> | undefined;
  return (meta?.total ?? r?.total ?? (r?.data as unknown[])?.length ?? 0) as number;
}

export type SheetsResult = { data: PicadoSheet[]; total: number };

export async function getSheets(params: {
  driverId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<SheetsResult> {
  const q = new URLSearchParams();
  if (params.driverId) q.set("driverId", params.driverId);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  q.set("page", String(params.page ?? 1));
  q.set("limit", String(params.limit ?? 50));
  const res = await apiGet<unknown>(`/picado/daily-sheets?${q.toString()}`);
  return { data: extractSheets(res), total: extractTotal(res) };
}

export async function getSheet(id: string): Promise<PicadoSheet> {
  const res = await apiGet<unknown>(`/picado/daily-sheets/${id}`);
  const r = res as Record<string, unknown>;
  const raw = r?.dailySheet ?? r?.sheet ?? (r?.id ? r : null);
  return normalizeSheet((raw ?? r) as Record<string, unknown>);
}

export async function createSheet(data: Partial<PicadoSheet>): Promise<PicadoSheet> {
  const res = await apiPost<unknown>("/picado/daily-sheets", data);
  const r = res as Record<string, unknown>;
  const raw = r?.dailySheet ?? r?.sheet ?? (r?.id ? r : null);
  return normalizeSheet((raw ?? r) as Record<string, unknown>);
}

export async function updateSheet(id: string, data: Partial<PicadoSheet>): Promise<PicadoSheet> {
  const res = await apiPut<unknown>(`/picado/daily-sheets/${id}`, data);
  const r = res as Record<string, unknown>;
  const raw = r?.dailySheet ?? r?.sheet ?? (r?.id ? r : null);
  return normalizeSheet((raw ?? r) as Record<string, unknown>);
}

export async function addSheetTrips(sheetId: string, trips: Partial<PicadoTrip>[]): Promise<PicadoTrip[]> {
  const res = await apiPost<unknown>(`/picado/daily-sheets/${sheetId}/trips`, trips);
  const r = res as Record<string, unknown>;
  return (Array.isArray(res) ? res : (r?.trips ?? [])) as PicadoTrip[];
}

export async function replaceSheetTrips(sheetId: string, trips: Partial<PicadoTrip>[]): Promise<PicadoTrip[]> {
  const res = await apiPut<unknown>(`/picado/daily-sheets/${sheetId}/trips`, trips);
  const r = res as Record<string, unknown>;
  return (Array.isArray(res) ? res : (r?.trips ?? [])) as PicadoTrip[];
}

export async function getSummary(params: {
  driverId?: string;
  from?: string;
  to?: string;
}): Promise<PicadoSummary> {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  // driverId no soportado en /summary — se filtra por sheets client-side
  return apiGet<PicadoSummary>(`/picado/summary?${q.toString()}`);
}

export async function getActiveConfig(): Promise<PicadoConfig[]> {
  const res = await apiGet<unknown>("/picado/config/active");
  const r = res as Record<string, unknown>;
  const raw = Array.isArray(res) ? res : (r?.configs ?? []);
  return raw as PicadoConfig[];
}

export async function getAnticipos(params?: {
  chofer?: string;
  from?: string;
  to?: string;
}): Promise<Anticipo[]> {
  const q = new URLSearchParams();
  q.set("limit", "200");
  q.set("sort", "fecha");
  q.set("order", "desc");
  if (params?.chofer) q.set("chofer", params.chofer);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const res = await apiGet<unknown>(`/anticipos?${q.toString()}`);
  const r = res as Record<string, unknown>;
  const raw = Array.isArray(res) ? res : (r?.anticipos ?? r?.data ?? []);
  return (raw as Record<string, unknown>[]).map((a) => ({
    id: a.id as string,
    fecha: ((a.fecha as string) ?? "").slice(0, 10),
    chofer: (a.chofer as string) ?? "",
    monto: Number(a.monto ?? 0),
    metodo: (a.metodo as "EFECTIVO" | "TRANSFERENCIA") ?? "EFECTIVO",
    observacion: (a.observacion as string) ?? undefined,
  }));
}
