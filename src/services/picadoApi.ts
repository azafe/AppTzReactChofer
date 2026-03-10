import { apiGet, apiPost, apiPut } from "../lib/http";
import type { PicadoSheet, PicadoTrip, Anticipo, PicadoSummary, PicadoConfig, ApiListResponse } from "../types/picado";

export async function getSheets(params: {
  driverId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<ApiListResponse<PicadoSheet>> {
  const q = new URLSearchParams();
  if (params.driverId) q.set("driverId", params.driverId);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiGet<ApiListResponse<PicadoSheet>>(`/picado/daily-sheets${qs ? `?${qs}` : ""}`);
}

export async function getSheet(id: string): Promise<PicadoSheet> {
  return apiGet<PicadoSheet>(`/picado/daily-sheets/${id}`);
}

export async function createSheet(data: Partial<PicadoSheet>): Promise<PicadoSheet> {
  return apiPost<PicadoSheet>("/picado/daily-sheets", data);
}

export async function updateSheet(id: string, data: Partial<PicadoSheet>): Promise<PicadoSheet> {
  return apiPut<PicadoSheet>(`/picado/daily-sheets/${id}`, data);
}

export async function getSheetTrips(sheetId: string): Promise<PicadoTrip[]> {
  return apiGet<PicadoTrip[]>(`/picado/daily-sheets/${sheetId}/trips`);
}

export async function addSheetTrips(sheetId: string, trips: Partial<PicadoTrip>[]): Promise<PicadoTrip[]> {
  return apiPost<PicadoTrip[]>(`/picado/daily-sheets/${sheetId}/trips`, trips);
}

export async function replaceSheetTrips(sheetId: string, trips: Partial<PicadoTrip>[]): Promise<PicadoTrip[]> {
  return apiPut<PicadoTrip[]>(`/picado/daily-sheets/${sheetId}/trips`, trips);
}

export async function getSummary(params: {
  driverId?: string;
  from?: string;
  to?: string;
}): Promise<PicadoSummary> {
  const q = new URLSearchParams();
  if (params.driverId) q.set("driverId", params.driverId);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const qs = q.toString();
  return apiGet<PicadoSummary>(`/picado/summary${qs ? `?${qs}` : ""}`);
}

export async function getActiveConfig(): Promise<PicadoConfig[]> {
  return apiGet<PicadoConfig[]>("/picado/config/active");
}

export async function getAnticipos(params?: {
  driverId?: string;
}): Promise<Anticipo[]> {
  const q = new URLSearchParams();
  if (params?.driverId) q.set("driverId", params.driverId);
  const qs = q.toString();
  return apiGet<Anticipo[]>(`/anticipos${qs ? `?${qs}` : ""}`);
}
