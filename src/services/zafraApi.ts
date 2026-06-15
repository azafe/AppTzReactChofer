import { apiGet, apiPost, apiPostForm, apiPut, apiDelete } from "../lib/http";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ZafraModalidad = "PARTICULARES" | "AMARILLOS";

export type ZafraViaje = {
  id: string;
  modalidad: ZafraModalidad;
  fecha: string;
  choferId: string;
  choferNombre: string;
  camionId: string;
  camionNombre: string;
  lugarId?: string | null;
  lugarNombre?: string | null;
  frenteId?: string | null;
  frenteNumero?: string | null;
  kmSalida: number | null;
  kmLlegada: number | null;
  kmRecorridos: number | null;
  kmIngenioFinca: number;
  gasoil: number;
  pesoNetoKg?: number | null;
  observaciones?: string | null;
  fotoRemitoUrl?: string | null;
  fotoGasoilUrl?: string | null;
  ordenCargaNumero?: string | null;
  ordenRemitoNumero?: string | null;
  valorUnitarioARS?: number | null;
  valorTotalARS?: number | null;
  comisionChofer?: number | null;
  tarifaBaseSnapshot?: number | null;
  tarifaPorKmSnapshot?: number | null;
  comisionPctSnapshot?: number | null;
  kmPagaIngenioSnapshot?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ZafraLugar = { id: string; nombre: string; kmQuePagaIngenio?: number | null };
export type ZafraFrente = { id: string; numero: string; nombre?: string | null };
export type ZafraCamion = { vehicleId: string; vehicleLabel: string; tieneOdometro?: boolean };

export type ZafraConfig = {
  particulares: {
    tarifaBase: number;
    tarifaPorKm: number;
    tarifaPorKmReducida: number;
    porcentajeComision: number;
  };
  amarillos: {
    gananciaDiariaOwner: number;
    tarifaDiariaConductor: number;
    tarifaPorViajeConductor: number;
  };
};

export type ZafraViajeBody = {
  modalidad: ZafraModalidad;
  fecha: string;
  choferId: string;
  choferNombre: string;
  camionId: string;
  camionNombre: string;
  lugarId?: string | null;
  lugarNombre?: string | null;
  frenteId?: string | null;
  frenteNumero?: string | null;
  kmSalida: number | null;
  kmLlegada: number | null;
  gasoil: number;
  pesoNetoKg?: number | null;
  observaciones?: string | null;
  fotoRemitoUrl?: string | null;
  fotoGasoilUrl?: string | null;
  ordenCargaNumero?: string | null;
  ordenRemitoNumero?: string | null;
  valorUnitarioARS?: number | null;
  valorTotalARS?: number | null;
  comisionChofer?: number | null;
  tarifaBaseSnapshot?: number | null;
  tarifaPorKmSnapshot?: number | null;
  comisionPctSnapshot?: number | null;
  kmPagaIngenioSnapshot?: number | null;
};

// ─── API functions ────────────────────────────────────────────────────────────

export async function listMisViajes(params: {
  choferId: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ ok: boolean; viajes: ZafraViaje[]; meta: { total: number } }> {
  const q = new URLSearchParams();
  q.set("choferId", params.choferId);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  q.set("limit", String(params.limit ?? 200));
  return apiGet(`/registro-viajes?${q.toString()}`);
}

export async function createZafraViaje(
  body: ZafraViajeBody
): Promise<{ ok: boolean; viaje: ZafraViaje }> {
  return apiPost("/registro-viajes", body);
}

export async function updateZafraViaje(
  id: string,
  body: Partial<ZafraViajeBody>
): Promise<{ ok: boolean; viaje: ZafraViaje }> {
  return apiPut(`/registro-viajes/${id}`, body);
}

export async function deleteZafraViaje(id: string): Promise<{ ok: boolean }> {
  return apiDelete(`/registro-viajes/${id}`);
}

export async function getLugares(): Promise<{ ok: boolean; lugares: ZafraLugar[] }> {
  return apiGet("/registro-viajes/lugares");
}

export async function createLugar(dto: {
  nombre: string;
}): Promise<{ ok: boolean; lugar: ZafraLugar }> {
  return apiPost("/registro-viajes/lugares", dto);
}

export async function getFrentes(): Promise<{ ok: boolean; frentes: ZafraFrente[] }> {
  return apiGet("/registro-viajes/frentes");
}

export async function createFrente(dto: {
  numero: string;
}): Promise<{ ok: boolean; frente: ZafraFrente }> {
  return apiPost("/registro-viajes/frentes", dto);
}

export async function getZafraConfig(): Promise<{ ok: boolean; config: ZafraConfig | null }> {
  return apiGet("/registro-viajes/config");
}

export async function getUnidadesActivas(): Promise<{ ok: boolean; unidades: ZafraCamion[] }> {
  return apiGet("/unidades?estado=ACTIVA&tipo=CAMION&limit=200");
}

export async function uploadZafraFoto(
  file: File,
  tipo: "remito" | "gasoil"
): Promise<{ ok: boolean; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("tipo", tipo);
  return apiPostForm("/registro-viajes/upload-foto", fd);
}

export type ZafraOcrResult = {
  pesoNetoKg?: number;
  gasoilLts?: number;
  frenteNumero?: string;
  lugarNombre?: string;
  ingenioNombre?: string;
  fecha?: string;
  ordenCargaNumero?: string;
  ordenRemitoNumero?: string;
};

export async function listMisAmarillosDias(params: {
  choferId: string;
  from?: string;
  to?: string;
}): Promise<{ ok: boolean; dias: Array<{ id: string; fecha: string; camionId: string; trabajo: boolean }> }> {
  const q = new URLSearchParams({ choferId: params.choferId });
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  return apiGet(`/registro-viajes/amarillos-dias?${q.toString()}`);
}

export async function ocrZafraDocumento(
  url: string,
  tipo: "extracto_pesaje" | "orden_carga"
): Promise<{ ok: boolean; data: ZafraOcrResult }> {
  return apiPost("/registro-viajes/ocr", { url, tipo });
}
