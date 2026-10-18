import sharp from "sharp";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 75;

export function photoBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return bytes;
}

export type PreparedPhoto =
  | { ok: true; bytes: Buffer; mimeType: "image/jpeg"; width: number; height: number }
  | { ok: false; error: string };

/** Resize phone photos and store them as JPEG so the database stays small on a free host. */
export async function prepareJobPhoto(bytes: Uint8Array): Promise<PreparedPhoto> {
  if (bytes.byteLength === 0) return { ok: false, error: "That photo was empty." };
  if (bytes.byteLength > 8_000_000) {
    return { ok: false, error: "Each photo needs to be 8 MB or smaller before it is reduced." };
  }
  try {
    const image = sharp(bytes, { failOn: "error" }).rotate();
    const meta = await image.metadata();
    if (!meta.width || !meta.height) {
      return { ok: false, error: "That file is not a photo Quotestick can use. Try a JPG or PNG." };
    }
    const output = await image
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    const saved = await sharp(output).metadata();
    return {
      ok: true,
      bytes: output,
      mimeType: "image/jpeg",
      width: saved.width ?? meta.width,
      height: saved.height ?? meta.height,
    };
  } catch {
    return { ok: false, error: "That file is not a photo Quotestick can use. Try a JPG or PNG." };
  }
}
