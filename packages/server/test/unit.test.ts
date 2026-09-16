import { describe, expect, it } from "vitest";
import { resolveAuth } from "../src/runner/auth.js";
import { buildUrl, parseUrl, isValidUrl } from "../src/runner/url.js";
import { generateSnippet } from "../src/codegen/service.js";
import { redactSecrets, isSensitiveHeader } from "../src/ai/redact.js";
import { serializeBody } from "../src/runner/body.js";

const noop = (s: string) => s;

describe("resolveAuth", () => {
  it("bearer token", () => {
    const r = resolveAuth({ type: "bearer", token: "tok" }, noop);
    expect(r.headers["Authorization"]).toBe("Bearer tok");
  });
  it("basic auth", () => {
    const r = resolveAuth({ type: "basic", username: "u", password: "p" }, noop);
    expect(r.headers["Authorization"]).toBe(`Basic ${Buffer.from("u:p").toString("base64")}`);
  });
  it("api key in header", () => {
    const r = resolveAuth({ type: "apikey", key: "X-Key", value: "v", in: "header" }, noop);
    expect(r.headers["X-Key"]).toBe("v");
  });
  it("api key in query", () => {
    const r = resolveAuth({ type: "apikey", key: "key", value: "v", in: "query" }, noop);
    expect(r.query["key"]).toBe("v");
  });
  it("none returns empty", () => {
    const r = resolveAuth(null, noop);
    expect(r.headers).toEqual({});
    expect(r.query).toEqual({});
  });
});

describe("buildUrl", () => {
  it("appends enabled query params", () => {
    const url = buildUrl({
      baseUrl: "https://x.io/a",
      query: [{ key: "q", value: "1", enabled: true }, { key: "skip", value: "2", enabled: false }],
    });
    expect(url).toBe("https://x.io/a?q=1");
  });
  it("preserves existing query string", () => {
    const url = buildUrl({ baseUrl: "https://x.io/a?b=2", query: [{ key: "c", value: "3", enabled: true }] });
    expect(url).toBe("https://x.io/a?b=2&c=3");
  });
});

describe("parseUrl / isValidUrl", () => {
  it("parses", () => {
    const p = parseUrl("https://x.io:8443/a/b?c=1");
    expect(p.protocol).toBe("https");
    expect(p.port).toBe("8443");
    expect(p.host).toBe("x.io");
  });
  it("validates", () => {
    expect(isValidUrl("https://x.io")).toBe(true);
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("ftp://x.io")).toBe(false);
  });
});

describe("codegen", () => {
  it("curl", () => {
    const s = generateSnippet("curl", { method: "GET", url: "https://x.io", headers: {}, body: null });
    expect(s).toContain("curl -X GET");
    expect(s).toContain("https://x.io");
  });
  it("python", () => {
    const s = generateSnippet("python", { method: "POST", url: "https://x.io", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(s).toContain("requests.request");
    expect(s).toContain("payload");
  });
});

describe("secret redaction", () => {
  it("redacts bearer authorization", () => {
    const r = redactSecrets("Authorization: Bearer abcdefghijklmnop");
    expect(r.redacted).toBe(true);
    expect(r.text).not.toContain("abcdefghijklmnop");
  });
  it("redacts api keys", () => {
    const r = redactSecrets("sk-abcdefghijklmnop123456");
    expect(r.redacted).toBe(true);
    expect(r.text).not.toContain("sk-abcdefghijklmnop");
  });
  it("redacts JWT", () => {
    const r = redactSecrets("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature");
    expect(r.redacted).toBe(true);
  });
  it("leaves normal text unchanged", () => {
    const r = redactSecrets("The sky is blue and peaceful");
    expect(r.redacted).toBe(false);
    expect(r.text).toBe("The sky is blue and peaceful");
  });
  it("flags sensitive headers", () => {
    expect(isSensitiveHeader("Authorization")).toBe(true);
    expect(isSensitiveHeader("Content-Type")).toBe(false);
  });
});

describe("serializeBody", () => {
  it("json", () => {
    const b = serializeBody({ mode: "json", json: "{}" });
    expect(b.contentType).toBe("application/json");
  });
  it("urlencoded", () => {
    const b = serializeBody({ mode: "urlencoded", urlencoded: [{ key: "a", value: "1", enabled: true }] });
    expect(b.body).toBe("a=1");
    expect(b.contentType).toBe("application/x-www-form-urlencoded");
  });
  it("none", () => {
    const b = serializeBody(undefined);
    expect(b.body).toBeNull();
  });
});