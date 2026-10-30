import { formatDate, formatGBP } from "@/lib/format";

export const RECEIPT_RECORD_NOTE =
  "This is a record for you and your accountant. Quotestick does not file it with HMRC and it is not tax advice.";

export const NOTE_READ = "Read from the photo. Check the supplier, date, total and VAT before you confirm.";

export const NOTE_NO_KEY =
  "The photo is saved. No reader is connected, so type the supplier, date and total yourself.";

export const NOTE_FAILED =
  "The photo is saved. The reader could not read this receipt, so type the supplier, date and total yourself.";

export const UNLINKED_RECEIPT_REPLY =
  "This number is not linked to a Quotestick account, so the receipt was not saved. Open Your page, create a link code, then send LINK and the code from this phone.";

export function receiptPhotoFailedText(detail: string | null): string {
  const why = detail ? ` ${detail}` : "";
  return `The receipt photo was not saved.${why} Send a JPG or PNG and try again.`;
}

export function receiptSavedText(input: {
  supplier: string;
  spentOn: Date | null;
  totalPence: number | null;
  vatPence: number | null;
  jobTitle: string | null;
  ambiguousJob: boolean;
  manual: boolean;
  url: string;
}): string {
  const lines = ["Receipt photo saved."];
  if (input.manual) {
    lines.push("Type the supplier, date and total in Quotestick. The photo is there.");
  } else {
    const bits = [input.supplier || "Supplier not read"];
    if (input.spentOn) bits.push(formatDate(input.spentOn));
    if (input.totalPence != null) bits.push(formatGBP(input.totalPence));
    lines.push(`${bits.join(", ")}.`);
    if (input.vatPence == null) lines.push("No VAT amount was read. Leave VAT blank if the receipt does not show it.");
    else lines.push(`VAT shown on the receipt: ${formatGBP(input.vatPence)}.`);
  }
  if (input.jobTitle) lines.push(`Linked to ${input.jobTitle}.`);
  else if (input.ambiguousJob) {
    lines.push("That note matches more than one job, so it is not linked yet. Choose the job when you check it.");
  }
  lines.push(`Check it here: ${input.url}`);
  lines.push(RECEIPT_RECORD_NOTE);
  return lines.join("\n");
}
