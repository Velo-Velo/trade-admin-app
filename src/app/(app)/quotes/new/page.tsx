import { Flash } from "@/components/flash";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { firstParam } from "@/lib/format";
import { createManualQuote } from "@/server/enquiry-actions";

export const metadata = { title: "New draft quote" };

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <h1 className="font-serif text-4xl">New draft quote</h1>
      <p className="text-sm leading-6 text-muted">
        Use this for a phone call or a message. It creates a draft from a template if one matches. Nothing is sent to the customer.
      </p>
      <Flash error={firstParam(query.error)} />
      <form action={createManualQuote} className="grid gap-4">
        <label className={labelClass}>
          Customer name
          <input className={inputClass} name="customerName" required />
        </label>
        <label className={labelClass}>
          Email or phone
          <input className={inputClass} name="contact" required />
        </label>
        <label className={labelClass}>
          Postcode
          <input className={inputClass} name="postcode" required placeholder="SW1A 1AA" />
        </label>
        <label className={labelClass}>
          Job
          <textarea className={inputClass} name="jobDescription" required rows={5} placeholder="Kitchen tap is dripping and needs replacing." />
        </label>
        <button className={buttonPrimary} type="submit">
          Create draft
        </button>
      </form>
    </div>
  );
}
