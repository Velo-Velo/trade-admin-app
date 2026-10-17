const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2_000_000;
const MAX_FILES = 4;

export async function readEnquiryPhotos(
  formData: FormData,
): Promise<{ ok: true; photos: Array<{ filename: string; mimeType: string; bytes: Uint8Array<ArrayBuffer> }> } | { ok: false; error: string }> {
  const files = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MAX_FILES) {
    return { ok: false, error: "You can attach up to 4 photos." };
  }
  const photos = [];
  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return { ok: false, error: "Photos need to be JPG, PNG or WebP." };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: "Each photo needs to be 2 MB or smaller." };
    }
    const filename = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 80) || "photo";
    const bytes = new Uint8Array(await file.arrayBuffer());
    photos.push({
      filename,
      mimeType: file.type,
      bytes,
    });
  }
  return { ok: true, photos };
}
