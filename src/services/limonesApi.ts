import { apiGet, apiPatch, apiPost, apiPostForm } from "../lib/http";
import type { LimonFinca } from "../types/limones";
export type { LimonFinca };

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
  fotoRemitoUrl?: string | null;
  finca_id?: string | null;
  finca?: LimonFinca | null;
  peso_real_kg?: number | null;
  toneladas?: number | null;
  tarifa_aplicada?: number | null;
  ingreso_bruto?: number | null;
  corte_chofer?: number | null;
  createdAt?: string | null;
};

export type LimonCarga = {
  id: string;
  fecha: string;
  choferId?: string | null;
  choferNombre?: string | null;
  camionId: string;
  camionNombre: string;
  litros: number;
  tanqueInicial: number | null;
  kmOdometro: number;
  origen: LimonCombustibleOrigen;
  observaciones?: string | null;
  fotoRemitoUrl?: string | null;
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
  fotoRemitoUrl?: string | null;
  finca_id?: string | null;
  peso_real_kg?: number | null;
  toneladas?: number | null;
  tarifa_aplicada?: number | null;
  ingreso_bruto?: number | null;
  corte_chofer?: number | null;
};

export type LimonCamion = { vehicleId: string; vehicleLabel: string; consumo_teorico_l100km?: number | null };

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
  choferId?: string | null;
  choferNombre?: string | null;
  camionId: string;
  camionNombre: string;
  litros: number;
  tanqueInicial: number | null;
  kmOdometro: number;
  origen: LimonCombustibleOrigen;
  observaciones?: string | null;
  fotoRemitoUrl?: string | null;
}): Promise<{ ok: boolean }> {
  return apiPost("/limones/cargas-combustible", body);
}

export async function listMisCargas(params: {
  choferId?: string;
  camionId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ ok: boolean; cargas: LimonCarga[] }> {
  const q = new URLSearchParams();
  if (params.choferId) q.set("choferId", params.choferId);
  if (params.camionId) q.set("camionId", params.camionId);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  q.set("limit", String(params.limit ?? 200));
  return apiGet(`/limones/cargas-combustible?${q.toString()}`);
}

export async function patchCargaFoto(
  id: string,
  fotoRemitoUrl: string | null
): Promise<{ ok: boolean; carga: LimonCarga }> {
  return apiPatch(`/limones/cargas-combustible/${id}`, { fotoRemitoUrl });
}

export async function uploadLimonesFoto(
  file: File,
  tipo: "limones-remito" | "limones-gasoil"
): Promise<{ ok: boolean; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("tipo", tipo);
  return apiPostForm("/limones/upload-foto", fd);
}

export async function getUnidadesActivas(): Promise<{ ok: boolean; unidades: LimonCamion[] }> {
  return apiGet("/unidades?estado=ACTIVA&tipo=CAMION&limit=200");
}

export async function listFincasActivas(): Promise<{ ok: boolean; fincas: LimonFinca[] }> {
  return apiGet("/limones/fincas?activa=true&limit=200");
}
