export function DemoBanner({ kind }: { kind: "mode" | "sample" }) {
  const text =
    kind === "mode"
      ? "Demo mode is on. Try the demo opens a fictional plumbing and heating business. Nothing is sent to a real customer."
      : "Sample Harbour Heating is fictional and separate from real accounts. It does not send real emails, WhatsApp messages or payments.";
  return (
    <p className="bg-clay px-4 py-2 text-center text-sm font-semibold leading-6 text-white">{text}</p>
  );
}
