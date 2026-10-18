export function ChatLine({ direction, body }: { direction: "in" | "out"; body: string }) {
  return (
    <p
      className={`max-w-[90%] whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl px-3 py-2 text-sm leading-6 ${
        direction === "in" ? "ml-auto bg-pine text-white" : "bg-white text-ink"
      }`}
    >
      {body}
    </p>
  );
}
