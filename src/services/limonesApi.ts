import { apiGet, apiPost } from "../lib/http";

export type LimonViaje = {
  id: string;
  fecha: string;
  choferId: string;
  choferNombre: string;
  camionId: string;
  camionNombre: string;
  origen: string;
  destino: string;
  kmSalida: number;
  kmLlegada: number;
  kmRecorridos: number;
  observaciones?: string | null;
  createdAt?: string | null;
};

export type LimonViajeBody = {
  fecha: string;
  choferId: string;
  choferNombre: string;
  camionId: string;
  camionNombre: string;
  origen: string;
  destino: string;
  kmSalida: number;
  kmLlegada: number;
  observaciones?: string | null;
};

export type LimonCamion = { vehicleId: string; vehicleLabel: string };

export async function listMisViajesLimones(params: {
  choferId: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ ok: boolean; viajes: LimonViaje[] }> {
  const q = new URLSearchParams();
  q.set("choferId", params.choferId);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  q.set("limit", String(params.limit ?? 200));
  return apiGet(`/limones/viajes?${q.toString()}`);
}

export async function createLimonViaje(
  body: LimonViajeBody
): Promise<{ ok: boolean; viaje: LimonViaje }> {
  return apiPost("/limones/viajes", body);
}

export type LimonCombustibleOrigen = "BASE_TZ" | "EXTERNA";

export async function createLimonCarga(body: {
  fecha: string;
  camionId: string;
  camionNombre: string;
  litros: number;
  tanqueInicial: number | null;
  kmOdometro: number;
  origen: LimonCombustibleOrigen;
  observaciones?: string | null;
}): Promise<{ ok: boolean }> {
  return apiPost("/limones/cargas-combustible", body);
}

export async function getUnidadesActivas(): Promise<{ ok: boolean; unidades: LimonCamion[] }> {
  return apiGet("/unidades?estado=ACTIVA&tipo=CAMION&limit=200");
}
