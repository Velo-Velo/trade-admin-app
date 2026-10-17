import type { LlmCompleter } from "@/lib/quotes/draft";

const SYSTEM_PROMPT = `You draft quote lines for a UK tradesperson.
You are given a job description and starter lines from a trade template, or a blank allowance.
Adjust quantities and descriptions so the lines match the job. Keep the starter unitPricePence values.
Use kind LABOUR or MATERIAL only.
Do not add a disclaimer line. Do not include the customer's name, phone, email or full address.
Return JSON only: {"lines":[{"kind":"LABOUR","description":"...","quantity":1,"unit":"hour","unitPricePence":5000}]}
The trader reviews every line before the customer sees the quote. Prefer fewer, clearer lines.`;

function parseModelJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "");
  return JSON.parse(trimmed);
}

export async function openAiCompleter(payload: {
  jobDescription: string;
  templateName: string | null;
  lines: unknown;
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
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status})`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty draft");
  return parseModelJson(content);
}

export function completerFromEnv(): LlmCompleter | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return openAiCompleter;
}
