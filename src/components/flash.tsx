export function Flash({ error, notice }: { error?: string; notice?: string }) {
  if (error) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="status">
        {notice}
      </p>
    );
  }
  return null;
}
