import crypto from "crypto";

// AES-256-GCM encryption for BYOK API keys at rest.
// APP_SECRET is deployment infrastructure config (openssl rand -hex 32) —
// never a vendor AI key. See docs/06-ai-provider-layer.md.

const ALG = "aes-256-gcm";

function secret(): Buffer {
  const hex = process.env.APP_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "APP_SECRET must be a 64-character hex string. Generate one with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, secret(), iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${data.toString("base64")}`;
}

export function decrypt(ciphertext: string): string {
  const [iv, tag, data] = ciphertext.split(".");
  if (!iv || !tag || !data) throw new Error("Malformed ciphertext");
  const decipher = crypto.createDecipheriv(ALG, secret(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
