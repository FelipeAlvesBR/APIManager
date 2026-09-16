export interface RedactionResult {
  text: string;
  redacted: boolean;
  count: number;
}

const PLACEHOLDER = "[REDACTED]";

/**
 * Detect and redact common credential patterns before any text leaves the
 * local client for an AI provider. Purely heuristic; designed to be aggressive
 * about not leaking secrets (false positives are acceptable).
 */
export function redactSecrets(text: string): RedactionResult {
  let out = text;
  let count = 0;

  const patterns: RegExp[] = [
    // Authorization / bearer tokens
    /\b(?:authorization\s*[:=]\s*)(?:bearer\s+)?[A-Za-z0-9._~+/=-]{8,}/gi,
    // API keys (sk-..., xoxb-..., ghp_..., etc.)
    /\b(?:sk|sk-[A-Za-z0-9]{1,}|rk|pk|ghp|gho|ghu|ghs|github_pat|xox[bpors]|AIza)\b[-_A-Za-z0-9]{10,}/g,
    // Generic "key/value" pairs
    /(["']?(?:api[_-]?key|apikey|access[_-]?token|secret|client[_-]?secret|password|passwd|pwd)["']?\s*[:=]\s*["'])[^"'\s]{4,}(["'])/gi,
    // Bearer JWT (three dot-separated base64url segments)
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    // Generic base64-looking secrets (long tokens)
    /\bAC[0-9a-zA-Z][0-9a-zA-Z_-]{16,}\b/g,
  ];

  for (const re of patterns) {
    out = out.replace(re, (match, g1?: string, g2?: string) => {
      count += 1;
      if (g1 && g2) return `${g1}${PLACEHOLDER}${g2}`;
      return PLACEHOLDER;
    });
  }

  return { text: out, redacted: count > 0, count };
}

/** Detect whether a header name indicates a sensitive header. */
export function isSensitiveHeader(name: string): boolean {
  return /authorization|set-cookie|cookie|api[-_]?key|x-api-key|token|password|secret/i.test(name);
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = isSensitiveHeader(k) ? PLACEHOLDER : v;
  }
  return out;
}