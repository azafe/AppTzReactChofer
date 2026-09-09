import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  type ZafraConfig,
  type ZafraFrente,
  type ZafraLugar,
  type ZafraModalidad,
  type ZafraOcrResult,
  type ZafraViaje,
  type ZafraViajeBody,
} from "../services/zafraApi";
import {
  asNum,
  calcMontosParticulares,
  comisionAmarillos,
  type MontosViaje,
} from "../lib/zafraCalc";
import { todayISO } from "../lib/format";
import { mergeOcr, type DocTipo, type OcrField, type Sources } from "../lib/ocrMerge";

// ─── Estado ──────────────────────────────────────────────────────────────────

export type ViajeFormValues = {
  modalidad: ZafraModalidad;
  fecha: string;
  camionVehicleId: string;
  lugarId: string;
  lugarNombre: string;
  lugarKmPagaIngenio: number | null;
  lugarTextoOcr: string;
  frenteId: string;
  frenteNumero: string;
  gasoil: string;
  pesoNetoKg: string;
  ingenioNombre: string;
  ordenCargaNumero: string;
  ordenRemitoNumero: string;
  observaciones: string;
};

export type { OcrField, FieldSource } from "../lib/ocrMerge";

type State = {
  values: ViajeFormValues;
  sources: Sources;
};

type Action =
  | { type: "set"; field: keyof ViajeFormValues; value: string }
  | { type: "selectLugar"; id: string; label: string; km: number | null }
  | { type: "selectFrente"; id: string; label: string }
  | {
      type: "ocr";
      source: DocTipo;
      result: ZafraOcrResult;
      lugares: ZafraLugar[];
      frentes: ZafraFrente[];
    }
  | { type: "reset"; values: ViajeFormValues };

/** Qué campo del formulario marca como "manual" a qué campo del OCR. */
const CAMPO_A_OCR: Partial<Record<keyof ViajeFormValues, OcrField>> = {
  fecha: "fecha",
  gasoil: "gasoil",
  pesoNetoKg: "pesoNetoKg",
  ingenioNombre: "ingenioNombre",
  ordenCargaNumero: "ordenCargaNumero",
  ordenRemitoNumero: "ordenRemitoNumero",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set": {
      const values = { ...state.values, [action.field]: action.value };
      const sources = { ...state.sources };
      const tocado = CAMPO_A_OCR[action.field];
      if (tocado) sources[tocado] = "manual";
      return { values, sources };
    }

    case "selectLugar":
      return {
        values: {
          ...state.values,
          lugarId: action.id,
          lugarNombre: action.label,
          lugarKmPagaIngenio: action.km,
          lugarTextoOcr: "",
        },
        sources: { ...state.sources, lugar: "manual" },
      };

    case "selectFrente":
      return {
        values: { ...state.values, frenteId: action.id, frenteNumero: action.label },
        sources: { ...state.sources, frente: "manual" },
      };

    case "ocr": {
      const { values, sources } = mergeOcr(
        state.values,
        state.sources,
        action.source,
        action.result,
        action.lugares,
        action.frentes
      );
      return { values, sources };
    }

    case "reset":
      return { values: action.values, sources: {} };
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function emptyValues(
  modalidad: ZafraModalidad = "PARTICULARES",
  camionVehicleId = ""
): ViajeFormValues {
  return {
    modalidad,
    fecha: todayISO(),
    camionVehicleId,
    lugarId: "",
    lugarNombre: "",
    lugarKmPagaIngenio: null,
    lugarTextoOcr: "",
    frenteId: "",
    frenteNumero: "",
    gasoil: "",
    pesoNetoKg: "",
    ingenioNombre: "",
    ordenCargaNumero: "",
    ordenRemitoNumero: "",
    observaciones: "",
  };
}

export function valuesFromViaje(v: ZafraViaje): ViajeFormValues {
  return {
    modalidad: v.modalidad,
    fecha: v.fecha,
    camionVehicleId: v.camionId,
    lugarId: v.lugarId ?? "",
    lugarNombre: v.lugarNombre ?? "",
    lugarKmPagaIngenio: v.kmPagaIngenioSnapshot ?? null,
    lugarTextoOcr: "",
    frenteId: v.frenteId ?? "",
    frenteNumero: v.frenteNumero ?? "",
    gasoil: String(v.gasoil ?? ""),
    pesoNetoKg: v.pesoNetoKg != null ? String(v.pesoNetoKg) : "",
    ingenioNombre: v.ingenioNombre ?? "",
    ordenCargaNumero: v.ordenCargaNumero ?? "",
    ordenRemitoNumero: v.ordenRemitoNumero ?? "",
    observaciones: v.observaciones ?? "",
  };
}

type Options = {
  initial: ViajeFormValues;
  config: ZafraConfig;
  lugares: ZafraLugar[];
  frentes: ZafraFrente[];
};

export type FotosViaje = {
  fotoRemitoUrl: string | null;
  fotoGasoilUrl: string | null;
};

export function useZafraViajeForm({ initial, config, lugares, frentes }: Options) {
  const [state, dispatch] = useReducer(reducer, { values: initial, sources: {} });

  // Las listas se leen desde un ref para que el reducer sea puro y no dependa
  // de un closure que puede estar viejo cuando llegan los dos OCR en paralelo.
  const listasRef = useRef({ lugares, frentes });
  useEffect(() => {
    listasRef.current = { lugares, frentes };
  }, [lugares, frentes]);

  const set = useCallback((field: keyof ViajeFormValues, value: string) => {
    dispatch({ type: "set", field, value });
  }, []);

  const selectLugar = useCallback((id: string, label: string, km: number | null) => {
    dispatch({ type: "selectLugar", id, label, km });
  }, []);

  const selectFrente = useCallback((id: string, label: string) => {
    dispatch({ type: "selectFrente", id, label });
  }, []);

  const applyOcr = useCallback((source: DocTipo, result: ZafraOcrResult) => {
    dispatch({
      type: "ocr",
      source,
      result,
      lugares: listasRef.current.lugares,
      frentes: listasRef.current.frentes,
    });
  }, []);

  const reset = useCallback((values: ViajeFormValues) => {
    dispatch({ type: "reset", values });
  }, []);

  const { values, sources } = state;

  const montos: MontosViaje = useMemo(() => {
    if (values.modalidad === "AMARILLOS") {
      return {
        valorUnitarioARS: null,
        valorTotalARS: null,
        comisionChofer: comisionAmarillos(config.amarillos, values.fecha),
        motivoSinMonto: null,
      };
    }
    const peso = asNum(values.pesoNetoKg);
    return calcMontosParticulares({
      kmPagaIngenio: values.lugarKmPagaIngenio,
      pesoNetoKg: Number.isFinite(peso) ? peso : null,
      tarifaBase: config.particulares.tarifaBase,
      tarifaPorKm: config.particulares.tarifaPorKm,
      porcentajeComision: config.particulares.porcentajeComision,
    });
  }, [values.modalidad, values.fecha, values.lugarKmPagaIngenio, values.pesoNetoKg, config]);

  const validate = useCallback((): string[] => {
    const errs: string[] = [];
    if (values.modalidad === "PARTICULARES") {
      const p = asNum(values.pesoNetoKg);
      if (!Number.isFinite(p) || p <= 0)
        errs.push("El peso neto es obligatorio para Particulares.");
    }
    if (values.gasoil.trim() !== "") {
      const g = asNum(values.gasoil);
      if (!Number.isFinite(g) || g < 0) errs.push("El gasoil no puede ser negativo.");
    }
    return errs;
  }, [values.modalidad, values.pesoNetoKg, values.gasoil]);

  /** Campos comunes al POST y al PUT. Nunca incluye kmSalida/kmLlegada. */
  const camposComunes = useCallback(
    (fotos: FotosViaje) => {
      const gasoilN = values.gasoil.trim() === "" ? 0 : asNum(values.gasoil);
      const peso = asNum(values.pesoNetoKg);
      return {
        modalidad: values.modalidad,
        fecha: values.fecha,
        lugarId: values.lugarId || null,
        lugarNombre: values.lugarNombre || null,
        frenteId: values.frenteId || null,
        frenteNumero: values.frenteNumero || null,
        gasoil: Number.isFinite(gasoilN) ? gasoilN : 0,
        pesoNetoKg:
          values.modalidad === "PARTICULARES" && Number.isFinite(peso) ? peso : null,
        ingenioNombre: values.ingenioNombre.trim() || null,
        ordenCargaNumero: values.ordenCargaNumero.trim() || null,
        ordenRemitoNumero: values.ordenRemitoNumero.trim() || null,
        observaciones: values.observaciones.trim() || null,
        fotoRemitoUrl: fotos.fotoRemitoUrl,
        fotoGasoilUrl: fotos.fotoGasoilUrl,
      };
    },
    [values]
  );

  /**
   * Alta: los montos y sus snapshots se incluyen SÓLO si hay monto. Un viaje sin
   * km del lugar se guarda sin tarifar y lo completa oficina.
   */
  const buildCreateBody = useCallback(
    (args: {
      driverId: string;
      driverNombre: string;
      camionId: string;
      camionNombre: string;
      fotos: FotosViaje;
    }): ZafraViajeBody => {
      const base = {
        ...camposComunes(args.fotos),
        choferId: args.driverId,
        choferNombre: args.driverNombre,
        camionId: args.camionId,
        camionNombre: args.camionNombre,
      };

      if (values.modalidad === "AMARILLOS") {
        return { ...base, comisionChofer: montos.comisionChofer };
      }
      if (montos.motivoSinMonto != null) return base;

      return {
        ...base,
        valorUnitarioARS: montos.valorUnitarioARS,
        valorTotalARS: montos.valorTotalARS,
        comisionChofer: montos.comisionChofer,
        tarifaBaseSnapshot: config.particulares.tarifaBase,
        tarifaPorKmSnapshot: config.particulares.tarifaPorKm,
        comisionPctSnapshot: config.particulares.porcentajeComision,
        kmPagaIngenioSnapshot: values.lugarKmPagaIngenio ?? undefined,
      };
    },
    [camposComunes, values.modalidad, values.lugarKmPagaIngenio, montos, config]
  );

  /**
   * Edición: al revés que el alta, los montos van SIEMPRE explícitos (incluido
   * null) para que un viaje cuyo lugar quedó sin km limpie el monto viejo.
   *
   * kmSalida/kmLlegada se omiten a propósito: updateViaje escribe la columna con
   * cualquier clave !== undefined, así que mandar null borraría los km del admin.
   */
  const buildUpdatePatch = useCallback(
    (args: { camionId: string; camionNombre: string; fotos: FotosViaje }) => {
      const base = {
        ...camposComunes(args.fotos),
        camionId: args.camionId,
        camionNombre: args.camionNombre,
      };

      if (values.modalidad === "AMARILLOS") {
        return {
          ...base,
          valorUnitarioARS: null,
          valorTotalARS: null,
          comisionChofer: montos.comisionChofer,
          kmPagaIngenioSnapshot: null,
        };
      }

      return {
        ...base,
        valorUnitarioARS: montos.valorUnitarioARS,
        valorTotalARS: montos.valorTotalARS,
        comisionChofer: montos.comisionChofer,
        tarifaBaseSnapshot: config.particulares.tarifaBase,
        tarifaPorKmSnapshot: config.particulares.tarifaPorKm,
        comisionPctSnapshot: config.particulares.porcentajeComision,
        kmPagaIngenioSnapshot: values.lugarKmPagaIngenio,
      };
    },
    [camposComunes, values.modalidad, values.lugarKmPagaIngenio, montos, config]
  );

  return {
    values,
    sources,
    set,
    selectLugar,
    selectFrente,
    applyOcr,
    reset,
    montos,
    validate,
    buildCreateBody,
    buildUpdatePatch,
  };
}
