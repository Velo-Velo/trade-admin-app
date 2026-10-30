import { NOTE_FAILED, NOTE_NO_KEY, NOTE_READ } from "@/lib/receipts/copy";
import { parseExtractedReceipt, receiptHasFigures, type ParsedReceipt } from "@/lib/receipts/fields";
import { matchReceiptJob, type ReceiptJob } from "@/lib/receipts/match";

export type ReceiptReader = (input: { bytes: Uint8Array; mimeType: string; caption: string }) => Promise<unknown>;

export type ReceiptDraft = ParsedReceipt & {
  extractionNote: string;
  manual: boolean;
  jobId: string | null;
  customerId: string | null;
  jobTitle: string | null;
  ambiguousJob: boolean;
};

const EMPTY: ParsedReceipt = {
  supplier: "",
  description: "",
  spentOn: null,
  totalPence: null,
  vatPence: null,
  category: "OTHER",
};

function parseModelJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "");
  return JSON.parse(trimmed);
}

/**
 * Reads a receipt photo with the same OpenAI key used for quote drafts.
 * Swap this function for another reader; capture only needs the JSON shape from parseExtractedReceipt.
 */
export async function openAiReceiptReader(input: { bytes: Uint8Array; mimeType: string; caption: string }): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const mime = input.mimeType.startsWith("image/") ? input.mimeType : "image/jpeg";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You read a photo of a UK tradesperson's purchase receipt (materials, fuel, tools).",
            "Return JSON only with these keys:",
            '{"supplier": string or null, "description": string or null, "spentOn": "YYYY-MM-DD" or null, "totalPence": integer or null, "vatPence": integer or null, "category": "MATERIALS" | "FUEL" | "TOOLS" | "OTHER"}',
            "totalPence is the amount paid, in pence (1860 means £18.60). vatPence is the VAT printed on the receipt, in pence.",
            "If the receipt does not print a VAT amount, vatPence must be null. Do not calculate VAT. Do not invent figures. Use null when a field is unreadable.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            { type: "text", text: input.caption.trim() ? `Note from the trader: ${input.caption.trim().slice(0, 500)}` : "No note." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${Buffer.from(input.bytes).toString("base64")}` } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI receipt read failed (${response.status})`);
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty receipt read");
  return parseModelJson(content);
}

export function readerFromEnv(): ReceiptReader | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return openAiReceiptReader;
}

export async function readReceiptFields(input: {
  caption: string;
  jobs: ReceiptJob[];
  bytes: Uint8Array;
  mimeType: string;
  read: ReceiptReader | null;
  now?: Date;
}): Promise<ReceiptDraft> {
  const now = input.now ?? new Date();
  const match = matchReceiptJob(input.jobs, input.caption);
  const link =
    match.kind === "one"
      ? { jobId: match.jobId, customerId: match.customerId, jobTitle: match.title, ambiguousJob: false }
      : { jobId: null, customerId: null, jobTitle: null, ambiguousJob: match.kind === "many" };

  if (!input.read) {
    return { ...EMPTY, extractionNote: NOTE_NO_KEY, manual: true, ...link };
  }

  let parsed: ParsedReceipt | null = null;
  try {
    parsed = parseExtractedReceipt(await input.read({ bytes: input.bytes, mimeType: input.mimeType, caption: input.caption }), now);
  } catch (error) {
    console.error("[receipt read]", error instanceof Error ? error.message : "failed");
    parsed = null;
  }
  if (!parsed || !receiptHasFigures(parsed)) {
    return {
      ...(parsed ?? EMPTY),
      extractionNote: NOTE_FAILED,
      manual: true,
      ...link,
    };
  }
  return { ...parsed, extractionNote: NOTE_READ, manual: false, ...link };
}
