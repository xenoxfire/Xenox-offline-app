// TOTP (Time-based One-Time Password) — RFC 6238
// Uses Web Crypto API (HMAC-SHA1) — no external library needed

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.replace(/\s+/g, "").toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

export async function generateTOTP(
  secret: string,
  digits = 6,
  period = 30
): Promise<string> {
  const keyBytes = base32ToBytes(secret.trim());
  if (keyBytes.length === 0) throw new Error("Invalid base32 secret key");

  const counter = Math.floor(Date.now() / 1000 / period);

  // 8-byte big-endian counter
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, buf);
  const hash = new Uint8Array(sig);

  // Dynamic truncation (RFC 4226)
  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3];

  return (code % Math.pow(10, digits)).toString().padStart(digits, "0");
}

// Seconds remaining in current 30s window
export function getSecondsLeft(period = 30): number {
  return period - (Math.floor(Date.now() / 1000) % period);
}
