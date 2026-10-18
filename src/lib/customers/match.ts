export type CustomerFields = {
  name: string;
  phone: string;
  email: string;
  postcode: string;
  address: string;
};

/** UK numbers are stored as digits starting with 44, so 07700 and +44 match the same customer. */
export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("44")) return digits;
  if (digits.startsWith("0")) return `44${digits.slice(1)}`;
  if (digits.length === 10) return `44${digits}`;
  return digits;
}

export function displayPhone(stored: string): string {
  if (!stored) return "";
  const local = stored.startsWith("44") ? `0${stored.slice(2)}` : stored;
  if (/^07\d{9}$/.test(local)) return `${local.slice(0, 5)} ${local.slice(5)}`;
  return local;
}

export function customerSearchText(fields: CustomerFields): string {
  const phone = normalisePhone(fields.phone);
  const local = phone.startsWith("44") ? `0${phone.slice(2)}` : phone;
  const postcode = fields.postcode.trim().toLowerCase();
  const parts = [
    fields.name,
    fields.email,
    fields.phone,
    phone,
    local,
    displayPhone(phone),
    postcode,
    postcode.replace(/\s+/g, ""),
    fields.address,
  ];
  return parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Each needle must appear in the customer search text. A phone word also matches its 07 and 44 forms. */
export function searchNeedles(raw: string): string[] {
  const query = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!query) return [];
  const needles: string[] = [];
  for (const word of query.split(" ")) {
    if (!word) continue;
    const digits = word.replace(/\D/g, "");
    const phoneLike = digits.length >= 4 && word.replace(/[\d+\s()-]/g, "") === "";
    if (!phoneLike) {
      needles.push(word);
      continue;
    }
    needles.push(digits);
    if (digits.startsWith("0")) needles.push(`44${digits.slice(1)}`);
    if (digits.startsWith("44") && digits.length > 2) needles.push(`0${digits.slice(2)}`);
  }
  return [...new Set(needles)];
}

export function customerMatches(searchText: string, query: string): boolean {
  const needles = searchNeedles(query);
  if (needles.length === 0) return true;
  const haystack = searchText.toLowerCase();
  return needles.every((needle) => haystack.includes(needle));
}
