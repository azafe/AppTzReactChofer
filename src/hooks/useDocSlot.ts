import { useCallback, useEffect, useRef, useState } from "react";
import {
  ocrZafraDocumento,
  uploadZafraFoto,
  type ZafraOcrResult,
} from "../services/zafraApi";

export type { DocTipo } from "../lib/ocrMerge";
import type { DocTipo } from "../lib/ocrMerge";

export type SlotStatus =
  | "empty"
  | "uploading"
  | "reading"
  | "done"
  | "upload_error"
  | "ocr_failed";

export type DocSlot = {
  status: SlotStatus;
  /** objectURL local mientras sube; después la URL remota. */
  previewUrl: string | null;
  /** URL remota, una vez subida. Es lo que se guarda con el viaje. */
  url: string | null;
  error: string | null;
};

const EMPTY: DocSlot = { status: "empty", previewUrl: null, url: null, error: null };

const UPLOAD_TIPO = { extracto: "remito", orden: "gasoil" } as const;
const OCR_TIPO = { extracto: "extracto_pesaje", orden: "orden_carga" } as const;

/**
 * Máquina de estados de una foto del viaje:
 *
 *   empty → pick(file) → uploading → reading → done
 *                            ↓          ↓
 *                     upload_error   ocr_failed
 *
 * Guarda el File en memoria para que "Reintentar" no obligue a volver a abrir
 * la cámara, y no limpia el input hasta que la subida sale bien.
 */
export function useDocSlot(
  tipo: DocTipo,
  onResult: (tipo: DocTipo, result: ZafraOcrResult) => void
) {
  const [slot, setSlot] = useState<DocSlot>(EMPTY);

  const fileRef = useRef<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // El callback puede cambiar de identidad en cada render; con un ref evitamos
  // recrear las funciones del hook y leer un closure viejo.
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });

  const revokePreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => revokePreview, [revokePreview]);

  const runOcr = useCallback(
    async (url: string) => {
      setSlot((s) => ({ ...s, status: "reading", url, error: null }));
      try {
        const res = await ocrZafraDocumento(url, OCR_TIPO[tipo]);
        if (res.ok) {
          onResultRef.current(tipo, res.data);
          setSlot((s) => ({ ...s, status: "done", url, error: null }));
        } else {
          setSlot((s) => ({ ...s, status: "ocr_failed", url, error: null }));
        }
      } catch {
        setSlot((s) => ({ ...s, status: "ocr_failed", url, error: null }));
      }
    },
    [tipo]
  );

  const upload = useCallback(
    async (file: File) => {
      setSlot((s) => ({ ...s, status: "uploading", error: null }));
      try {
        const res = await uploadZafraFoto(file, UPLOAD_TIPO[tipo]);
        await runOcr(res.url);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo subir la foto";
        setSlot((s) => ({ ...s, status: "upload_error", error: msg }));
      }
    },
    [tipo, runOcr]
  );

  const pick = useCallback(
    (file: File) => {
      revokePreview();
      fileRef.current = file;
      const preview = URL.createObjectURL(file);
      objectUrlRef.current = preview;
      setSlot({ status: "uploading", previewUrl: preview, url: null, error: null });
      void upload(file);
    },
    [revokePreview, upload]
  );

  const retryUpload = useCallback(() => {
    if (fileRef.current) void upload(fileRef.current);
  }, [upload]);

  const retryOcr = useCallback(() => {
    if (slot.url) void runOcr(slot.url);
  }, [slot.url, runOcr]);

  /** Descarta el aviso de OCR fallido: la foto queda igual, se completa a mano. */
  const dismissOcrError = useCallback(() => {
    setSlot((s) => (s.status === "ocr_failed" ? { ...s, status: "done" } : s));
  }, []);

  const clear = useCallback(() => {
    revokePreview();
    fileRef.current = null;
    setSlot(EMPTY);
  }, [revokePreview]);

  const busy = slot.status === "uploading" || slot.status === "reading";

  return { slot, busy, pick, retryUpload, retryOcr, dismissOcrError, clear };
}
