import { notFound, redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { demoModeEnabled } from "@/lib/demo";
import { firstParam } from "@/lib/format";
import { simulateVoiceNote, simulateWhatsApp } from "@/server/whatsapp-sim-actions";

export const metadata = { title: "WhatsApp simulator" };

export default async function WhatsAppSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  if (!demoModeEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const phone = user.trader.whatsappE164;
  const messages = phone
    ? await prisma.whatsAppMessage.findMany({
        where: { phone },
        orderBy: { createdAt: "asc" },
        take: 80,
      })
    : [];

  return (
    <div className="mx-auto grid min-w-0 max-w-xl gap-4">
      <div>
        <h1 className="font-serif text-4xl">WhatsApp simulator</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          This is not Meta. Messages stay in Quotestick so you can try drafts, invoices and approval. Nothing is sent to a real phone.
        </p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      {phone ? (
        <p className="text-sm text-muted">Linked number +{phone}</p>
      ) : (
        <p className="card text-sm">Link a WhatsApp number on Your page, then come back.</p>
      )}
      <div className="grid gap-2">
        {messages.map((message) => (
          <p
            key={message.id}
            className={`max-w-[90%] whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl px-3 py-2 text-sm leading-6 ${
              message.direction === "in" ? "ml-auto bg-pine text-white" : "bg-white"
            }`}
          >
            {message.body}
          </p>
        ))}
      </div>
      <form action={simulateWhatsApp} className="grid gap-3">
        <label className={labelClass}>
          Message
          <textarea className={inputClass} name="text" rows={3} required placeholder="Invoice Mrs Jones, replaced tap, £80" />
        </label>
        <button className={buttonPrimary} type="submit">Send</button>
      </form>
      <div className="flex flex-wrap gap-2">
        <form action={simulateWhatsApp}>
          <input type="hidden" name="text" value="The kitchen tap is dripping. Please quote to replace the tap." />
          <button className={buttonSecondary} type="submit">Sample quote</button>
        </form>
        <form action={simulateWhatsApp}>
          <input type="hidden" name="text" value="Invoice Mrs Jones, replaced tap, £80" />
          <button className={buttonSecondary} type="submit">Sample invoice</button>
        </form>
        <form action={simulateWhatsApp}>
          <input type="hidden" name="text" value="APPROVE" />
          <button className={buttonSecondary} type="submit">Reply APPROVE</button>
        </form>
        <form action={simulateVoiceNote}>
          <button className={buttonSecondary} type="submit">Sample voice note</button>
        </form>
      </div>
    </div>
  );
}
