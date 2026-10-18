"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { CoolingOff } from "@/components/cooling-off";
import { buttonClay, buttonQuiet, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { formatGBP, poundsToPence, quoteTotals } from "@/lib/format";
import { coolingOffFor } from "@/lib/quotes/cooling-off";
import { saveQuoteAction } from "@/server/quote-actions";

export type EditorLine = {
  key: string;
  kind: "LABOUR" | "MATERIAL";
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  priceBookItemId: string | null;
  lastPaidPence: number | null;
};

function SubmitButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button className={buttonSecondary} type="submit" name="intent" value="save" disabled={pending}>
        {pending ? "Saving…" : "Save draft"}
      </button>
      <button className={buttonClay} type="submit" name="intent" value="approve" disabled={pending}>
        {pending ? "Sending…" : "Approve and send"}
      </button>
    </div>
  );
}

export function QuoteEditor({
  quoteId,
  initialLines,
  depositPercent,
  domestic,
  draftNote,
}: {
  quoteId: string;
  initialLines: EditorLine[];
  depositPercent: number;
  domestic: boolean;
  draftNote: string;
}) {
  const [lines, setLines] = useState(initialLines);
  const [deposit, setDeposit] = useState(String(depositPercent));
  const [isDomestic, setIsDomestic] = useState(domestic);

  const totals = useMemo(() => {
    const parsed = lines.flatMap((line) => {
      const price = poundsToPence(line.unitPrice);
      const quantity = Number(line.quantity);
      if (price === null || !(quantity > 0)) return [];
      return [{ kind: line.kind, quantity, unitPricePence: price }];
    });
    const percent = Number(deposit);
    return quoteTotals(parsed, Number.isInteger(percent) ? percent : 0);
  }, [lines, deposit]);

  const zeroPriced = lines.some((line) => poundsToPence(line.unitPrice) === 0);

  function update(key: string, patch: Partial<EditorLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <form
      action={saveQuoteAction}
      className="grid gap-5"
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const intent = submitter instanceof HTMLButtonElement ? submitter.value : "";
        if (intent === "approve") {
          const confirmed = window.confirm(
            "Approve and send this quote? The customer will be able to open the link. Until you approve, the link does not work.",
          );
          if (!confirmed) event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <p className="text-sm leading-6 text-muted">{draftNote}</p>
      {zeroPriced ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          A line is priced at £0. That is fine if you are leaving it out, but check it before you approve.
        </p>
      ) : null}

      <div className="grid gap-4">
        {lines.map((line, index) => (
          <fieldset key={line.key} className="card grid gap-3">
            <legend className="px-1 text-sm font-semibold text-muted">Line {index + 1}</legend>
            <label className={labelClass}>
              Type
              <select
                className={inputClass}
                value={line.kind}
                onChange={(event) => update(line.key, { kind: event.target.value as EditorLine["kind"] })}
              >
                <option value="LABOUR">Labour</option>
                <option value="MATERIAL">Materials</option>
              </select>
            </label>
            <label className={labelClass}>
              Description
              <input
                className={inputClass}
                value={line.description}
                onChange={(event) => update(line.key, { description: event.target.value })}
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className={labelClass}>
                Qty
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(event) => update(line.key, { quantity: event.target.value })}
                />
              </label>
              <label className={labelClass}>
                Unit
                <input className={inputClass} value={line.unit} onChange={(event) => update(line.key, { unit: event.target.value })} />
              </label>
              <label className={labelClass}>
                Price £
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={line.unitPrice}
                  onChange={(event) => update(line.key, { unitPrice: event.target.value })}
                />
              </label>
            </div>
            {line.lastPaidPence !== null ? (
              <p className="text-sm text-muted">Last paid {formatGBP(line.lastPaidPence)}</p>
            ) : null}
            <button
              type="button"
              className={`${buttonQuiet} justify-start px-0`}
              onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
            >
              Remove line
            </button>
          </fieldset>
        ))}
      </div>

      <button
        type="button"
        className={buttonSecondary}
        onClick={() =>
          setLines((current) => [
            ...current,
            {
              key: crypto.randomUUID(),
              kind: "MATERIAL",
              description: "",
              quantity: "1",
              unit: "item",
              unitPrice: "0.00",
              priceBookItemId: null,
              lastPaidPence: null,
            },
          ])
        }
      >
        Add a line
      </button>

      <div className="card grid gap-4">
        <label className={labelClass}>
          Deposit percent
          <input
            className={inputClass}
            name="depositPercent"
            inputMode="numeric"
            value={deposit}
            onChange={(event) => setDeposit(event.target.value)}
          />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            className="mt-1 h-5 w-5"
            type="checkbox"
            name="domestic"
            checked={isDomestic}
            onChange={(event) => setIsDomestic(event.target.checked)}
          />
          <span>Domestic customer. Show the cancellation notice placeholder.</span>
        </label>
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between"><dt>Labour</dt><dd>{formatGBP(totals.labour)}</dd></div>
          <div className="flex justify-between"><dt>Materials</dt><dd>{formatGBP(totals.materials)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatGBP(totals.total)}</dd></div>
          <div className="flex justify-between"><dt>Deposit</dt><dd>{formatGBP(totals.deposit)}</dd></div>
        </dl>
      </div>

      {isDomestic ? <CoolingOff text={coolingOffFor(true)} /> : (
        <p className="text-sm text-muted">Domestic cancellation notice is off because this is marked as a business customer.</p>
      )}

      <SubmitButtons />
      <p className="text-sm text-muted">
        Nothing is sent until you tap Approve and send. The public link stays closed while this is a draft.
      </p>
    </form>
  );
}
