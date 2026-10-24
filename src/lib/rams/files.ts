const MAX_BYTES = 8_000_000;

export type DocumentFileKind = "application/pdf" | "image/jpeg" | "image/png";

export function sniffDocument(bytes: Uint8Array): DocumentFileKind | null {
  if (bytes.length < 8 || bytes.length > MAX_BYTES) return null;
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return null;
}

export function safeFileName(name: string, mime: DocumentFileKind): string {
  const cleaned = name.replace(/[^\w.\- ]+/g, "").trim().slice(0, 80);
  const extension = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
  if (!cleaned) return `document.${extension}`;
  if (cleaned.toLowerCase().endsWith(`.${extension}`)) return cleaned;
  return `${cleaned}.${extension}`;
}

export const DOCUMENT_FILE_LIMIT = "PDF, JPG or PNG, up to 8 MB.";

export async function readDocumentFile(
  formData: FormData,
): Promise<{ ok: true; filename: string; mimeType: DocumentFileKind; bytes: Uint8Array } | { ok: false; error: string } | { ok: true; empty: true }> {
  const entry = formData.get("file");
  if (!(entry instanceof File) || entry.size === 0) return { ok: true, empty: true };
  if (entry.size > MAX_BYTES) return { ok: false, error: `That file is too large. Use a ${DOCUMENT_FILE_LIMIT}` };
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const mimeType = sniffDocument(bytes);
  if (!mimeType) return { ok: false, error: `Use a ${DOCUMENT_FILE_LIMIT}` };
  return { ok: true, filename: safeFileName(entry.name, mimeType), mimeType, bytes };
}
