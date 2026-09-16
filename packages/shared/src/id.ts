function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** Short, URL-safe, immutable resource id. */
export function newId(prefix = "id"): string {
  const hex = Array.from(getRandomBytes(9))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${hex}`;
}

export function uuid(): string {
  return globalThis.crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}