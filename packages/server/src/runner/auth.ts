import { createHmac, createHash, randomBytes } from "node:crypto";
import type { AuthConfig } from "@apiplatform/shared";

export interface AuthResolveResult {
  headers: Record<string, string>;
  query: Record<string, string>;
}

export type ResolveFn = (value: string) => string;

/**
 * Resolve an auth configuration (with already-resolved values via `resolve`)
 * into concrete request headers and query parameters.
 */
export function resolveAuth(auth: AuthConfig | null | undefined, resolve: ResolveFn): AuthResolveResult {
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};
  if (!auth || !auth.type || auth.type === "none") return { headers, query };

  switch (auth.type) {
    case "bearer": {
      const token = resolve(String(auth.token ?? ""));
      headers["Authorization"] = `Bearer ${token}`;
      break;
    }
    case "basic": {
      const username = resolve(String(auth.username ?? ""));
      const password = resolve(String(auth.password ?? ""));
      const encoded = Buffer.from(`${username}:${password}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
      break;
    }
    case "apikey": {
      const key = resolve(String(auth.key ?? ""));
      const value = resolve(String(auth.value ?? ""));
      const location = auth.in === "query" ? "query" : "header";
      if (location === "query") query[key] = value;
      else headers[key] = value;
      break;
    }
    case "oauth2": {
      const token = resolve(String(auth.accessToken ?? ""));
      if (!token) {
        // If no token is present (e.g. authorization-code flow not yet run), produce no header.
        break;
      }
      const prefix = resolve(String(auth.tokenType ?? "Bearer"));
      headers["Authorization"] = `${prefix} ${token}`;
      break;
    }
    case "digest": {
      const username = resolve(String(auth.username ?? ""));
      const password = resolve(String(auth.password ?? ""));
      headers["Authorization"] = buildDigestInitialHeader(username, password, String(auth.realm ?? ""));
      break;
    }
    case "awsv4": {
      const secretKey = resolve(String(auth.secretKey ?? ""));
      const accessKey = resolve(String(auth.accessKey ?? ""));
      if (secretKey && accessKey) {
        const sign = buildAwsSignatureV4({
          accessKey,
          secretKey,
          region: String(auth.region ?? "us-east-1"),
          service: String(auth.service ?? "execute-api"),
        });
        headers["Authorization"] = sign.authorization;
        headers["X-Amz-Date"] = sign.amzDate;
      }
      break;
    }
    case "custom": {
      const entries = Array.isArray(auth.entries) ? (auth.entries as { key: string; value: string; in?: string }[]) : [];
      for (const entry of entries) {
        const value = resolve(String(entry.value ?? ""));
        if (entry.in === "query") query[resolve(entry.key)] = value;
        else headers[resolve(entry.key)] = value;
      }
      break;
    }
    case "oauth1":
    case "hawk":
    case "ntlm": {
      // Documented as not yet supported: surface a clear error to the caller.
      throw Object.assign(
        new Error(`Auth type "${auth.type}" is recognized but not yet supported by the local request engine`),
        { code: "AUTH_NOT_SUPPORTED", status: 400 },
      );
    }
    default:
      break;
  }

  return { headers, query };
}

function buildDigestInitialHeader(username: string, password: string, realm: string): string {
  const nonce = randomBytes(8).toString("hex");
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`GET:/`);
  const response = md5(`${ha1}:${nonce}:${ha2}`);
  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="/", response="${response}"`;
}

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

function buildAwsSignatureV4(opts: {
  accessKey: string;
  secretKey: string;
  region: string;
  service: string;
}): { authorization: string; amzDate: string } {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256("")].join("\n");
  const kDate = createHmac("sha256", `AWS4${opts.secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(opts.region).digest();
  const kService = createHmac("sha256", kRegion).update(opts.service).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${scope}, SignedHeaders=host;x-amz-date, Signature=${signature}`;
  return { authorization, amzDate };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}