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
  /** Lo que leyó el OCR como origen, tal cual. Se muestra aunque no matchee. */
  lugarTextoOcr: string;
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

/**
 * Normaliza un nombre de lugar para comparar: sin acentos, sin el código del
 * ingenio que va adelante, sin puntuación.
 *
 *   "25871-Arbol Solo - Marcos Jesús Gonzalo" → "arbol solo marcos jesus gonzalo"
 *   "Árbol solo"                              → "arbol solo"
 */
export function normalizarLugar(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\s*\d+\s*-\s*/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** El código del ingenio que precede al nombre, si lo trae. */
export function codigoLugar(nombre: string): string | null {
  const m = nombre.match(/^\s*(\d{3,})\s*-/);
  return m ? m[1] : null;
}

export type MatchLugar =
  /** Un solo candidato: se selecciona solo. */
  | { tipo: "unico"; lugar: ZafraLugar }
  /** Varios: NO se adivina, elige el chofer. */
  | { tipo: "varios"; candidatos: ZafraLugar[] }
  /** Ninguno: se ofrece crearlo con el texto del remito. */
  | { tipo: "ninguno" };

/**
 * Busca el lugar del remito en la lista, de la señal más fuerte a la más débil.
 * Nunca elige entre varios candidatos: un match errado es peor que ninguno,
 * porque arrastra el km de otra finca a la comisión y nadie lo revisa.
 */
export function buscarLugar(nombre: string, lugares: ZafraLugar[]): MatchLugar {
  const objetivo = normalizarLugar(nombre);
  if (!objetivo) return { tipo: "ninguno" };

  const decidir = (encontrados: ZafraLugar[]): MatchLugar | null => {
    if (encontrados.length === 1) return { tipo: "unico", lugar: encontrados[0] };
    if (encontrados.length > 1) return { tipo: "varios", candidatos: encontrados };
    return null;
  };

  // 1) Igualdad exacta ya normalizada.
  const exactos = lugares.filter((l) => normalizarLugar(l.nombre) === objetivo);
  const porExacto = decidir(exactos);
  if (porExacto) return porExacto;

  // 2) Mismo código de ingenio: la clave más confiable que trae el documento.
  const codigo = codigoLugar(nombre);
  if (codigo) {
    const porCodigo = decidir(lugares.filter((l) => codigoLugar(l.nombre) === codigo));
    if (porCodigo) return porCodigo;
  }

  // 3) Uno contiene al otro. Se exige un mínimo de largo para que un nombre
  //    corto como "Florida" no matchee media lista.
  const contenidos = lugares.filter((l) => {
    const n = normalizarLugar(l.nombre);
    if (!n) return false;
    const corto = n.length <= objetivo.length ? n : objetivo;
    if (corto.length < 4) return false;
    return n.includes(objetivo) || objetivo.includes(n);
  });
  return decidir(contenidos) ?? { tipo: "ninguno" };
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
    // Se guarda siempre lo que dijo el remito, matchee o no: antes, si no
    // matcheaba, el chofer no se enteraba de que el OCR sí había leído el origen.
    aplicar("lugar", () => {
      values.lugarTextoOcr = result.lugarNombre!;
      const match = buscarLugar(result.lugarNombre!, lugares);
      if (match.tipo === "unico") {
        values.lugarId = match.lugar.id;
        values.lugarNombre = match.lugar.nombre;
        values.lugarKmPagaIngenio = match.lugar.kmQuePagaIngenio ?? null;
      }
    });
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
