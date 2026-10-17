import { redirect } from "next/navigation";

export function redirectWith(path: string, kind: "error" | "notice", message: string): never {
  const [base, existing] = path.split("?");
  const params = new URLSearchParams(existing ?? "");
  params.set(kind, message);
  redirect(`${base}?${params.toString()}`);
}
