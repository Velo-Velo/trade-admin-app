import { redirect } from "next/navigation";

/** Next.js redirect() throws. Callers that catch errors must rethrow this. */
export function isNextRedirect(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  if (digest.startsWith("NEXT_REDIRECT")) return true;
  return error instanceof Error && error.message === "NEXT_REDIRECT";
}

export function redirectWith(path: string, kind: "error" | "notice", message: string): never {
  const [base, existing] = path.split("?");
  const params = new URLSearchParams(existing ?? "");
  params.set(kind, message);
  redirect(`${base}?${params.toString()}`);
}
