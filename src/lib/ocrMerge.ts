import type {
  ZafraFrente,
  ZafraLugar,
  ZafraOcrResult,
} from "../services/zafraApi";

/**
 * Fusión de los resultados de OCR de los dos documentos del viaje.
 *
 * Sin imports de runtime a propósito: es lógica pura y verificable sola.
 */

export type DocTipo = "extracto" | "orden";

/** Campos que el OCR puede completar. "lugar" agrupa id + nombre + km. */
export type OcrField =
  | "fecha"
  | "lugar"
  | "frente"
  | "pesoNetoKg"
  | "gasoil"
  | "ingenioNombre"
  | "ordenCargaNumero"
  | "ordenRemitoNumero";

export type FieldSource = "manual" | DocTipo;

export type Sources = Partial<Record<OcrField, FieldSource>>;

/** Sólo los campos del formulario que el OCR toca. */
export type OcrValues = {
  fecha: string;
  lugarId: string;
  lugarNombre: string;
  lugarKmPagaIngenio: number | null;
  frenteId: string;
  frenteNumero: string;
  gasoil: string;
  pesoNetoKg: string;
  ingenioNombre: string;
  ordenCargaNumero: string;
  ordenRemitoNumero: string;
};

/**
 * Precedencia por ORIGEN, no por orden de llegada: con las dos fotos leyéndose
 * en paralelo, el resultado tiene que ser el mismo venga primero el extracto o
 * la orden.
 *
 *  - extracto: su prompt apunta explícitamente al "Origen" y a la fecha impresa.
 *  - orden:    el ingenio de destino es un campo de primera clase de la orden;
 *              en el extracto es una inferencia del encabezado.
 */
export const GANADOR: Record<OcrField, DocTipo> = {
  fecha: "extracto",
  lugar: "extracto",
  frente: "extracto",
  pesoNetoKg: "extracto",
  ordenRemitoNumero: "extracto",
  gasoil: "orden",
  ingenioNombre: "orden",
  ordenCargaNumero: "orden",
};

/** Campos que sólo existen en un documento; el otro no puede escribirlos. */
export const EXCLUSIVO: Partial<Record<OcrField, DocTipo>> = {
  pesoNetoKg: "extracto",
  frente: "extracto",
  ordenRemitoNumero: "extracto",
  gasoil: "orden",
  ordenCargaNumero: "orden",
};

export function puedeEscribir(
  field: OcrField,
  actual: FieldSource | undefined,
  entrante: DocTipo
): boolean {
  // Lo que el chofer tocó a mano no lo pisa ningún OCR.
  if (actual === "manual") return false;
  const exclusivo = EXCLUSIVO[field];
  if (exclusivo && exclusivo !== entrante) return false;
  if (actual == null) return true;
  // Releer el mismo documento sobreescribe su propio valor.
  if (actual === entrante) return true;
  return GANADOR[field] === entrante;
}

/** Mismo criterio difuso que usaba applyOcrResult, ahora como función pura. */
export function matchLugar(
  nombre: string,
  lugares: ZafraLugar[]
): ZafraLugar | undefined {
  const ocr = nombre.toLowerCase();
  return lugares.find((l) => {
    const n = l.nombre.toLowerCase();
    return n.includes(ocr) || ocr.includes(n);
  });
}

export function mergeOcr<V extends OcrValues>(
  prevValues: V,
  prevSources: Sources,
  source: DocTipo,
  result: ZafraOcrResult,
  lugares: ZafraLugar[],
  frentes: ZafraFrente[]
): { values: V; sources: Sources } {
  const values = { ...prevValues };
  const sources = { ...prevSources };

  const aplicar = (field: OcrField, write: () => void) => {
    if (!puedeEscribir(field, sources[field], source)) return;
    write();
    sources[field] = source;
  };

  if (result.pesoNetoKg != null) {
    aplicar("pesoNetoKg", () => {
      values.pesoNetoKg = String(result.pesoNetoKg);
    });
  }

  if (result.gasoilLts != null) {
    aplicar("gasoil", () => {
      values.gasoil = String(result.gasoilLts);
    });
  }

  if (result.frenteNumero) {
    const match = frentes.find(
      (f) => f.numero.toLowerCase() === result.frenteNumero!.toLowerCase()
    );
    if (match) {
      aplicar("frente", () => {
        values.frenteId = match.id;
        values.frenteNumero = match.numero;
      });
    }
  }

  if (result.lugarNombre) {
    const match = matchLugar(result.lugarNombre, lugares);
    if (match) {
      aplicar("lugar", () => {
        values.lugarId = match.id;
        values.lugarNombre = match.nombre;
        values.lugarKmPagaIngenio = match.kmQuePagaIngenio ?? null;
      });
    }
  }

  if (result.ingenioNombre) {
    aplicar("ingenioNombre", () => {
      values.ingenioNombre = result.ingenioNombre!;
    });
  }

  if (result.ordenCargaNumero) {
    aplicar("ordenCargaNumero", () => {
      values.ordenCargaNumero = String(result.ordenCargaNumero);
    });
  }

  if (result.ordenRemitoNumero) {
    aplicar("ordenRemitoNumero", () => {
      values.ordenRemitoNumero = String(result.ordenRemitoNumero);
    });
  }

  if (result.fecha) {
    const year = parseInt(result.fecha.slice(0, 4), 10);
    if (year >= 2025 && year <= 2030) {
      aplicar("fecha", () => {
        values.fecha = result.fecha!;
      });
    }
  }

  return { values, sources };
}
