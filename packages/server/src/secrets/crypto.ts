import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { config } from "../config.js";

/**
 * AES-256-GCM secret vault. The encryption key is derived from VAULT_KEY when
 * set (a base64-encoded 32-byte value) or from JWT_SECRET otherwise, so the
 * vault works out-of-the-box in development while remaining configurable for
 * production KMS-backed keys.
 */
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(): Buffer {
  if (config.vaultKey) {
    const buf = Buffer.from(config.vaultKey, "base64");
    if (buf.length === 32) return buf;
  }
  // Fall back to a stable 32-byte key derived from JWT_SECRET.
  return createHash("sha256").update(config.jwtSecret).digest();
}

const KEY = deriveKey();

export interface Encrypted {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export const vault = {
  encrypt(plaintext: string): Encrypted {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    };
  },

  decrypt(ciphertext: string, iv: string, authTag: string): string {
    const decipher = createDecipheriv(ALGO, KEY, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(authTag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  },
};