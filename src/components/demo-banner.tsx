export function DemoBanner({ kind }: { kind: "mode" | "sample" }) {
  const text =
    kind === "mode"
      ? "Demo mode is on. Try the demo opens a fictional plumbing and heating business. Nothing is sent to a real customer."
      : "Sample data. Sample Harbour Heating is not a real business. Prices, jobs and registration numbers are made up.";
  return (
    <p className="bg-clay px-4 py-2 text-center text-sm font-semibold leading-6 text-white">{text}</p>
  );
}
