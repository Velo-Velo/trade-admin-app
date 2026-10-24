import { createHash, createHmac } from "node:crypto";

/**
 * Private company files. When S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and
 * S3_SECRET_ACCESS_KEY are set, files go to that S3-compatible bucket
 * (Cloudflare R2 uses this). Otherwise they stay in Postgres, which is what
 * local development and demo mode use. The bucket must not be public. The app
 * only serves a file after it has checked the trader is signed in.
 */

export function objectStorageConfigured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT?.trim() &&
      process.env.S3_BUCKET?.trim() &&
      process.env.S3_ACCESS_KEY_ID?.trim() &&
      process.env.S3_SECRET_ACCESS_KEY?.trim(),
  );
}

function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

export function signS3Headers(input: {
  method: string;
  url: URL;
  body: Uint8Array | null;
  contentType?: string;
  accessKey: string;
  secret: string;
  region: string;
  now?: Date;
}): Record<string, string> {
  const now = input.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(input.body ?? "");
  const contentType = input.contentType ?? "";
  const headerPairs: Array<[string, string]> = [
    ["host", input.url.host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", amzDate],
  ];
  if (contentType) headerPairs.push(["content-type", contentType]);
  headerPairs.sort((a, b) => a[0].localeCompare(b[0]));
  const canonicalHeaders = headerPairs.map(([key, value]) => `${key}:${value}\n`).join("");
  const signedHeaders = headerPairs.map(([key]) => key).join(";");
  const canonical = [input.method, input.url.pathname, input.url.search.replace(/^\?/, ""), canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${input.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secret}`, dateStamp), input.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const headers: Record<string, string> = {
    Authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

function objectUrl(key: string): { url: URL; region: string; accessKey: string; secret: string } {
  const endpoint = (process.env.S3_ENDPOINT || "").replace(/\/$/, "");
  const bucket = (process.env.S3_BUCKET || "").trim();
  const encoded = key.split("/").map((part) => encodeURIComponent(part)).join("/");
  return {
    url: new URL(`${endpoint}/${bucket}/${encoded}`),
    region: process.env.S3_REGION?.trim() || "auto",
    accessKey: process.env.S3_ACCESS_KEY_ID || "",
    secret: process.env.S3_SECRET_ACCESS_KEY || "",
  };
}

async function s3(method: string, key: string, body: Uint8Array | null, contentType?: string): Promise<Response> {
  const target = objectUrl(key);
  const headers = signS3Headers({
    method,
    url: target.url,
    body,
    contentType,
    accessKey: target.accessKey,
    secret: target.secret,
    region: target.region,
  });
  return fetch(target.url, { method, headers, body: body ? new Uint8Array(body) : undefined });
}

export async function putPrivateObject(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const response = await s3("PUT", key, bytes, contentType);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`File store rejected the upload (${response.status}). ${detail.slice(0, 180)}`);
  }
}

export async function getPrivateObject(key: string): Promise<Uint8Array> {
  const response = await s3("GET", key, null);
  if (!response.ok) throw new Error(`File store could not read the file (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function deletePrivateObject(key: string): Promise<void> {
  if (!key) return;
  const response = await s3("DELETE", key, null);
  if (!response.ok && response.status !== 404) {
    throw new Error(`File store could not delete the file (${response.status}).`);
  }
}
