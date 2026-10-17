export function CoolingOff({ text }: { text: string }) {
  if (!text) return null;
  return (
    <aside className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <p className="font-semibold">Consumer cancellation notice — for legal review</p>
      <p className="mt-2 whitespace-pre-wrap">{text}</p>
    </aside>
  );
}
