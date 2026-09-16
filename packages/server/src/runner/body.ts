import type { FormField, KeyValue, RequestBody } from "@apiplatform/shared";

export interface SerializedBody {
  body: string | Uint8Array | null;
  contentType: string | null;
}

function entriesEnabled(list: KeyValue[] | undefined): KeyValue[] {
  return (list ?? []).filter((e) => e.enabled && e.key !== "");
}

export function serializeBody(body: RequestBody | undefined): SerializedBody {
  if (!body || body.mode === "none") return { body: null, contentType: null };

  switch (body.mode) {
    case "raw":
    case "javascript":
    case "html":
    case "graphql": {
      if (body.mode === "graphql") {
        const payload = JSON.stringify({
          query: body.graphql?.query ?? "",
          variables: body.graphql?.variables
            ? safeParse(body.graphql.variables)
            : undefined,
        });
        return { body: payload, contentType: "application/json" };
      }
      const text = body.raw ?? "";
      const contentType =
        body.mode === "html"
          ? "text/html"
          : body.mode === "javascript"
            ? "application/javascript"
            : "text/plain";
      return { body: text, contentType };
    }
    case "json": {
      const text = body.json ?? "";
      return { body: text, contentType: "application/json" };
    }
    case "xml": {
      const text = body.raw ?? "";
      return { body: text, contentType: "application/xml" };
    }
    case "urlencoded": {
      const params = entriesEnabled(body.urlencoded).map(
        (e) => `${encodeURIComponent(e.key)}=${encodeURIComponent(e.value ?? "")}`,
      );
      return { body: params.join("&"), contentType: "application/x-www-form-urlencoded" };
    }
    case "formdata": {
      const fields: FormField[] = (body.formdata ?? []).filter(
        (f) => f.enabled && f.key !== "",
      );
      return buildMultipart(fields);
    }
    case "binary": {
      const raw = body.binary ?? "";
      const bytes = safeDecodeBase64(raw);
      return { body: bytes, contentType: "application/octet-stream" };
    }
    default:
      return { body: null, contentType: null };
  }
}

function safeDecodeBase64(raw: string): Buffer {
  // Support base64 and data: URLs.
  const cleaned = raw.includes(",") ? raw.split(",").slice(1).join(",") : raw;
  try {
    return Buffer.from(cleaned, "base64");
  } catch {
    return Buffer.alloc(0);
  }
}

function buildMultipart(fields: FormField[]): SerializedBody {
  const boundary = `----apiplatform-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const field of fields) {
    const disposition =
      field.type === "file" && field.fileName
        ? `Content-Disposition: form-data; name="${escapeQuotes(field.key)}"; filename="${escapeQuotes(field.fileName)}"`
        : `Content-Disposition: form-data; name="${escapeQuotes(field.key)}"`;
    chunks.push(Buffer.from(`--${boundary}\r\n${disposition}\r\n`));
    if (field.type === "file" && field.contentType) {
      chunks.push(Buffer.from(`Content-Type: ${field.contentType}\r\n`));
    }
    chunks.push(Buffer.from("\r\n"));
    chunks.push(
      field.type === "file"
        ? safeDecodeBase64(field.value ?? "")
        : Buffer.from(field.value ?? "", "utf8"),
    );
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: new Uint8Array(Buffer.concat(chunks)),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function escapeQuotes(v: string): string {
  return v.replace(/"/g, '\\"');
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}