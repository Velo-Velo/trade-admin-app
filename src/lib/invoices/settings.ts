export type PaymentSettings = {
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  tradingAddress: string;
  vatRegistered: boolean;
  vatNumber: string;
  googleReviewUrl: string;
  reviewChasersEnabled: boolean;
};

export function parsePaymentSettings(input: {
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  tradingAddress: string;
  vatRegistered: boolean;
  vatNumber: string;
  googleReviewUrl: string;
  reviewChasersEnabled: boolean;
}): { ok: true; data: PaymentSettings } | { ok: false; error: string } {
  const bankAccountName = input.bankAccountName.trim().slice(0, 80);
  const sortDigits = input.bankSortCode.replace(/\D/g, "");
  const accountDigits = input.bankAccountNumber.replace(/\D/g, "");
  const tradingAddress = input.tradingAddress.trim().slice(0, 240);
  const reviewUrl = input.googleReviewUrl.trim();
  if ((sortDigits.length > 0 || accountDigits.length > 0 || bankAccountName) && sortDigits.length !== 6) {
    return { ok: false, error: "Enter a 6-digit sort code." };
  }
  if ((sortDigits.length > 0 || accountDigits.length > 0 || bankAccountName) && accountDigits.length !== 8) {
    return { ok: false, error: "Enter an 8-digit account number." };
  }
  if (sortDigits && !bankAccountName) return { ok: false, error: "Enter the name on the bank account." };
  let vatNumber = input.vatNumber.trim().toUpperCase().replace(/\s+/g, "");
  if (vatNumber && !vatNumber.startsWith("GB")) vatNumber = `GB${vatNumber}`;
  if (input.vatRegistered && !/^GB\d{9}$/.test(vatNumber)) {
    return { ok: false, error: "Enter a UK VAT number, such as GB123456789." };
  }
  if (reviewUrl && !/^https:\/\/\S{8,300}$/.test(reviewUrl)) {
    return { ok: false, error: "The Google review link must start with https://." };
  }
  return {
    ok: true,
    data: {
      bankAccountName,
      bankSortCode: sortDigits ? `${sortDigits.slice(0, 2)}-${sortDigits.slice(2, 4)}-${sortDigits.slice(4, 6)}` : "",
      bankAccountNumber: accountDigits,
      tradingAddress,
      vatRegistered: input.vatRegistered,
      vatNumber: input.vatRegistered ? vatNumber : "",
      googleReviewUrl: reviewUrl,
      reviewChasersEnabled: input.reviewChasersEnabled,
    },
  };
}
