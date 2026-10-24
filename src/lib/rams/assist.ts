import type { HazardCompleter } from "./library";

const SYSTEM_PROMPT = `You help a UK tradesperson choose hazards for a risk assessment and method statement.
You are given a job description and a checked library. Each hazard has a key.
Choose keys that fit this job. Use only keys from the list. Never invent a hazard, a control, or a key.
Keep every hazard marked core. Add specific hazards when the description calls for them.
Return JSON only: {"keys":["key-a","key-b"]}`;

function parseModelJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "");
  return JSON.parse(trimmed);
}

export async function openAiHazardCompleter(payload: {
  trade: string;
  scope: string;
  hazards: Array<{ key: string; activity: string; hazard: string; core: boolean }>;
}): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed (${response.status})`);
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty hazard list");
  return parseModelJson(content);
}

export function ramsCompleterFromEnv(): HazardCompleter | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return openAiHazardCompleter;
}
