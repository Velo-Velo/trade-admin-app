import { ChatLine } from "@/components/chat-line";
import { buttonPrimary } from "@/components/styles";

const draft = [
  "Draft quote Q-0142.",
  "Replace the kitchen tap. £185.00.",
  "Nothing has been sent to the customer.",
  "Reply APPROVE Q-0142 to send it.",
].join("\n");

/** A static picture of the WhatsApp draft and the approve step. The buttons do not submit. */
export function PhonePreview() {
  return (
    <figure className="handset-in mx-auto w-full max-w-[320px]">
      <div className="rounded-[2rem] border-[10px] border-[#16181d] bg-[#16181d] shadow-[0_22px_50px_rgba(22,24,29,0.16)]">
        <div className="overflow-hidden rounded-[1.25rem] bg-[#f4f5f2]" aria-hidden="true">
          <div className="flex items-center justify-between bg-white px-4 py-3">
            <p className="font-serif text-lg tracking-tight">Quotestick</p>
            <p className="text-xs font-semibold text-muted">WhatsApp</p>
          </div>
          <div className="grid gap-2 px-3 py-3">
            <ChatLine direction="in" body="Kitchen tap is dripping. Please quote to replace it." />
            <ChatLine direction="out" body={draft} />
          </div>
          <div className="border-t border-sand bg-white px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Approve</p>
            <p className="mt-1 font-semibold">Q-0142 · Draft</p>
            <p className="mt-2 flex justify-between text-sm"><span>Labour, 1 hour</span><span>£65.00</span></p>
            <p className="flex justify-between text-sm"><span>Replacement tap</span><span>£120.00</span></p>
            <p className="mt-2 flex justify-between font-semibold"><span>Total</span><span>£185.00</span></p>
            <p className={`${buttonPrimary} mt-3 w-full`}>Approve and send</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-sm leading-6 text-muted">
        Example screen: a WhatsApp draft, then the approve step. Not a live quote, and nothing is sent from this picture.
      </figcaption>
    </figure>
  );
}
