import { describe, expect, it } from "vitest";
import { clearAeCache, formatMiles, hospitalSearchUrl, lookupNearestAe, normalisePostcode, suggestionsFromHospitals } from "@/lib/rams/ae";
import { sniffDocument } from "@/lib/rams/files";
import {
  decodeSignaturePng,
  editResetsSignatures,
  isFullySigned,
  signaturesAfterEdit,
  signaturesForPdf,
  signingLinkMessage,
  validSignatures,
  type RequiredSigner,
  type SignatureRecord,
} from "@/lib/rams/signing";
import { objectStorageConfigured, signS3Headers } from "@/lib/storage/object";

const required: RequiredSigner[] = [
  { signerId: "approver", kind: "APPROVER", name: "Sam Sample" },
  { signerId: "pat", kind: "OPERATIVE", name: "Pat Sample" },
];

function signature(overrides: Partial<SignatureRecord> = {}): SignatureRecord {
  return {
    signerId: "approver",
    kind: "APPROVER",
    name: "Sam Sample",
    roleLabel: "Competent person",
    signedAt: new Date("2026-10-24T12:00:00.000Z"),
    contentVersion: 1,
    invalidatedAt: null,
    invalidReason: "",
    image: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33]),
    ...overrides,
  };
}

describe("nearest A&E", () => {
  it("normalises a UK postcode and ranks emergency hospitals", () => {
    expect(normalisePostcode("bs14st")).toBe("BS1 4ST");
    expect(normalisePostcode("not a postcode")).toBeNull();
    const suggestions = suggestionsFromHospitals(51.454, -2.597, [
      { name: "South Bristol Community Hospital", lat: "51.41", lon: "-2.58", extratags: { emergency: "no" }, display_name: "South Bristol" },
      { name: "Bristol Royal Infirmary", lat: "51.459", lon: "-2.597", extratags: { emergency: "yes" }, display_name: "Bristol Royal Infirmary, Bristol, England" },
      { name: "Royal United Hospital", lat: "51.392", lon: "-2.391", extratags: { emergency: "yes" }, display_name: "Royal United Hospital, Bath, England" },
      { name: "St Michael's Hospital", lat: "51.4593", lon: "-2.599", extratags: { emergency: "yes" }, display_name: "St Michael's Hospital, Bristol, England" },
      { name: "Bristol Royal Infirmary", lat: "51.459", lon: "-2.597", extratags: { emergency: "yes" }, display_name: "Duplicate" },
    ]);
    expect(suggestions.map((item) => item.name)).toEqual(["Bristol Royal Infirmary", "St Michael's Hospital", "Royal United Hospital"]);
    expect(suggestions[0].distanceMiles).toBeLessThan(suggestions[2].distanceMiles);
    expect(formatMiles(suggestions[0].distanceMiles)).toMatch(/miles$/);
    expect(hospitalSearchUrl(51.45, -2.59)).toContain("amenity=hospital");
    expect(hospitalSearchUrl(51.45, -2.59)).toContain("countrycodes=gb");
  });

  it("uses a fake lookup, caches it, and fails open when the service is down", async () => {
    clearAeCache();
    let calls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      calls += 1;
      const url = String(input);
      if (url.includes("postcodes.io")) {
        return new Response(JSON.stringify({ result: { latitude: 51.45, longitude: -2.59 } }), { status: 200 });
      }
      return new Response(
        JSON.stringify([{ name: "Bristol Royal Infirmary", lat: "51.459", lon: "-2.597", extratags: { emergency: "yes" }, display_name: "Bristol Royal Infirmary, Bristol" }]),
        { status: 200 },
      );
    };
    const first = await lookupNearestAe("BS1 4ST", { fetch: fetchImpl, now: () => 1_000 });
    const second = await lookupNearestAe("bs1 4st", { fetch: fetchImpl, now: () => 2_000 });
    expect(first.ok && first.suggestions[0].name).toBe("Bristol Royal Infirmary");
    expect(second.ok).toBe(true);
    expect(calls).toBe(2);
    clearAeCache();
    const down = await lookupNearestAe("BS1 4ST", {
      fetch: async () => {
        throw new Error("offline");
      },
      now: () => 5_000,
    });
    expect(down.ok).toBe(false);
    if (!down.ok) expect(down.reason).toMatch(/unavailable/);
  });
});

describe("signatures must be redone after an edit", () => {
  it("drops every current signature and withholds them from the PDF", () => {
    const before = [
      signature(),
      signature({ signerId: "pat", kind: "OPERATIVE", name: "Pat Sample" }),
    ];
    expect(isFullySigned(required, before, 1)).toBe(true);
    expect(editResetsSignatures({ status: "SIGNED", validCount: 2 })).toBe(true);
    expect(editResetsSignatures({ status: "DRAFT", validCount: 0 })).toBe(false);
    const now = new Date("2026-10-24T15:00:00.000Z");
    const after = signaturesAfterEdit(before, now);
    expect(validSignatures(after, 1)).toEqual([]);
    expect(validSignatures(after, 2)).toEqual([]);
    expect(isFullySigned(required, after, 2)).toBe(false);
    expect(signaturesForPdf(after, 2)).toEqual([]);
    expect(after.every((record) => record.invalidReason.includes("no longer counts"))).toBe(true);

    const resigned = [
      ...after,
      signature({ contentVersion: 2, signedAt: new Date("2026-10-24T16:00:00.000Z") }),
    ];
    expect(isFullySigned(required, resigned, 2)).toBe(false);
    resigned.push(signature({ signerId: "pat", kind: "OPERATIVE", name: "Pat Sample", contentVersion: 2 }));
    expect(isFullySigned(required, resigned, 2)).toBe(true);
    expect(signaturesForPdf(resigned, 2)).toHaveLength(2);
    expect(signaturesForPdf(resigned, 2).every((record) => record.contentVersion === 2)).toBe(true);
  });

  it("offers a fresh WhatsApp signing link for each person", () => {
    const message = signingLinkMessage({
      businessName: "Sample Harbour Heating",
      number: "R-0001",
      personName: "Pat Sample",
      url: "https://example.test/sign/token",
      again: true,
    });
    expect(message).toContain("old signatures no longer count");
    expect(message).toContain("https://example.test/sign/token");
    expect(message).toContain("Pat Sample");
    expect(message).toContain("Nothing is sent to the customer");
    expect(message).toContain("not health and safety advice");
  });

  it("accepts a drawn PNG and rejects anything else", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    expect(png.length).toBeGreaterThan(40);
    expect(decodeSignaturePng(`data:image/png;base64,${png.toString("base64")}`)?.length).toBe(png.length);
    expect(decodeSignaturePng("data:image/jpeg;base64,aaaa")).toBeNull();
    expect(decodeSignaturePng("Sam Sample")).toBeNull();
  });
});

describe("company document files", () => {
  it("accepts PDF, JPG and PNG bytes and rejects other files", () => {
    expect(sniffDocument(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]))).toBe("application/pdf");
    expect(sniffDocument(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(sniffDocument(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffDocument(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x3c, 0x2f]))).toBeNull();
  });

  it("keeps files in the database until S3 settings are present", () => {
    const previous = {
      endpoint: process.env.S3_ENDPOINT,
      bucket: process.env.S3_BUCKET,
      key: process.env.S3_ACCESS_KEY_ID,
      secret: process.env.S3_SECRET_ACCESS_KEY,
    };
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    expect(objectStorageConfigured()).toBe(false);
    process.env.S3_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.S3_BUCKET = "quotestick";
    process.env.S3_ACCESS_KEY_ID = "access";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    expect(objectStorageConfigured()).toBe(true);
    const url = new URL("https://example.r2.cloudflarestorage.com/quotestick/company-documents/a/b");
    const headers = signS3Headers({
      method: "PUT",
      url,
      body: new Uint8Array([1, 2, 3]),
      contentType: "application/pdf",
      accessKey: "access",
      secret: "secret",
      region: "auto",
      now: new Date("2026-10-24T12:00:00.000Z"),
    });
    expect(headers.Authorization).toContain("AWS4-HMAC-SHA256");
    expect(headers.Authorization).toContain("SignedHeaders=");
    expect(headers["x-amz-content-sha256"]).toHaveLength(64);
    for (const [name, value] of [
      ["S3_ENDPOINT", previous.endpoint],
      ["S3_BUCKET", previous.bucket],
      ["S3_ACCESS_KEY_ID", previous.key],
      ["S3_SECRET_ACCESS_KEY", previous.secret],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
});
