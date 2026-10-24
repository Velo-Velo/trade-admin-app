export function monitorTarget(env?: { ERROR_WEBHOOK_URL?: string }): string | null {
  const url = (env ? env.ERROR_WEBHOOK_URL : process.env.ERROR_WEBHOOK_URL)?.trim();
  return url || null;
}

export async function reportError(input: { message: string; digest?: string; source: string }): Promise<void> {
  const payload = {
    source: input.source,
    message: input.message.slice(0, 500),
    digest: input.digest ?? "",
    at: new Date().toISOString(),
  };
  console.error("[monitor]", payload.source, payload.message);
  const url = monitorTarget();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("[monitor] webhook failed", error);
  }
}
