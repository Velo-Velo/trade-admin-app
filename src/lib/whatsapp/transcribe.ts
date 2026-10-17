export async function transcribeVoiceNote(bytes: Uint8Array, mime: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const form = new FormData();
  const audio = new Uint8Array(bytes.byteLength);
  audio.set(bytes);
  form.append("file", new Blob([audio], { type: mime || "audio/ogg" }), "note.ogg");
  form.append("model", "gpt-4o-mini-transcribe");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { text?: string };
  const text = json.text?.trim();
  return text ? text : null;
}
