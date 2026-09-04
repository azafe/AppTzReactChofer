// Comprime fotos en el navegador antes de subirlas al storage.
// Mismos parametros que la migracion de fotos historicas: 1280 px de lado
// mayor y JPEG calidad 0.65, que deja los remitos legibles en ~150 kB.

const MAX_DIM = 1280;
const QUALITY = 0.65;
const MIN_BYTES = 300 * 1024; // por debajo de esto no vale la pena tocar la foto

export type ComprimirOpts = {
  maxDim?: number;
  quality?: number;
};

function jpgName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "foto";
  return `${base}.jpg`;
}

async function cargarBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap respeta la orientacion EXIF, asi que las fotos sacadas
  // de costado no quedan rotadas.
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/**
 * Devuelve una version comprimida del archivo. Si no es una imagen, si el
 * navegador no puede procesarla o si el resultado no pesa menos, devuelve el
 * archivo original: comprimir nunca puede hacer fallar una subida.
 */
export async function comprimirImagen(file: File, opts: ComprimirOpts = {}): Promise<File> {
  const maxDim = opts.maxDim ?? MAX_DIM;
  const quality = opts.quality ?? QUALITY;

  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size <= MIN_BYTES) return file;

  try {
    const bitmap = await cargarBitmap(file);
    const { width, height } = bitmap;
    if (!width || !height) {
      bitmap.close();
      return file;
    }

    // nunca agrandar
    const escala = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.round(width * escala);
    const h = Math.round(height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // fondo blanco: los PNG con transparencia pasan a JPEG sin quedar negros
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], jpgName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
