export interface SnippetInput {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  contentType?: string;
}

export type SnippetLanguage =
  | "curl"
  | "javascript"
  | "node"
  | "python"
  | "java"
  | "kotlin"
  | "swift"
  | "csharp"
  | "go"
  | "php"
  | "ruby"
  | "http";

export const LANGUAGES: SnippetLanguage[] = [
  "curl", "javascript", "node", "python", "java", "kotlin", "swift", "csharp", "go", "php", "ruby", "http",
];

export function generateSnippet(language: SnippetLanguage, input: SnippetInput): string {
  switch (language) {
    case "curl": return curlSnippet(input);
    case "javascript": return jsFetchSnippet(input);
    case "node": return nodeSnippet(input);
    case "python": return pythonSnippet(input);
    case "java": return javaSnippet(input);
    case "kotlin": return kotlinSnippet(input);
    case "swift": return swiftSnippet(input);
    case "csharp": return csharpSnippet(input);
    case "go": return goSnippet(input);
    case "php": return phpSnippet(input);
    case "ruby": return rubySnippet(input);
    case "http": return httpSnippet(input);
    default: return curlSnippet(input);
  }
}

function jsString(s: string): string {
  return JSON.stringify(s);
}

function pyString(s: string): string {
  return JSON.stringify(s);
}

function formatHeaders(headers: Record<string, string>): [string, string][] {
  return Object.entries(headers);
}

function curlSnippet(i: SnippetInput): string {
  const parts = [`curl -X ${i.method}`];
  for (const [k, v] of formatHeaders(i.headers)) parts.push(` -H ${jsString(`${k}: ${v}`)}`);
  if (i.body) parts.push(` -d ${jsString(i.body)}`);
  parts.push(` ${jsString(i.url)}`);
  return parts.join("");
}

function jsFetchSnippet(i: SnippetInput): string {
  const lines = [`fetch(${jsString(i.url)}, {`, `  method: ${jsString(i.method)},`];
  const headers = formatHeaders(i.headers);
  if (headers.length) {
    lines.push(`  headers: {`);
    for (const [k, v] of headers) lines.push(`    ${jsString(k)}: ${jsString(v)},`);
    lines.push(`  },`);
  }
  if (i.body) lines.push(`  body: ${jsString(i.body)},`);
  lines.push(`});`);
  return lines.join("\n");
}

function nodeSnippet(i: SnippetInput): string {
  const lines = [
    `const res = await fetch(${jsString(i.url)}, {`,
    `  method: ${jsString(i.method)},`,
  ];
  if (i.body) lines.push(`  body: ${jsString(i.body)},`);
  const headers = formatHeaders(i.headers);
  if (headers.length) {
    lines.push(`  headers: {`);
    for (const [k, v] of headers) lines.push(`    ${jsString(k)}: ${jsString(v)},`);
    lines.push(`  },`);
  }
  lines.push(`});`);
  lines.push(`const data = await res.text();`);
  return lines.join("\n");
}

function pythonSnippet(i: SnippetInput): string {
  const lines = [`import requests`, ``, `url = ${pyString(i.url)}`];
  if (i.body) lines.push(`payload = ${pyString(i.body)}`);
  lines.push(`headers = ${pyPrettyDict(Object.fromEntries(formatHeaders(i.headers)))}`);
  if (i.body) lines.push(`response = requests.request(${pyString(i.method)}, url, headers=headers, data=payload)`);
  else lines.push(`response = requests.request(${pyString(i.method)}, url, headers=headers)`);
  lines.push(`print(response.text)`);
  return lines.join("\n");
}

function pyPrettyDict(obj: Record<string, string>): string {
  if (Object.keys(obj).length === 0) return "{}";
  const entries = Object.entries(obj).map(([k, v]) => `  ${pyString(k)}: ${pyString(v)}`);
  return `{\n${entries.join(",\n")}\n}`;
}

function javaSnippet(i: SnippetInput): string {
  return `// Requires an HTTP client library (OkHttp example)
OkHttpClient client = new OkHttpClient();
Request request = new Request.Builder()
    .url(${javaString(i.url)})
    .method(${javaString(i.method)}${i.body ? `, RequestBody.create(MediaType.parse(${javaString(i.contentType ?? "application/json")}), ${javaString(i.body)})` : ""})${formatHeaders(i.headers).map(([k, v]) => `\n    .addHeader(${javaString(k)}, ${javaString(v)})`).join("")}
    .build();
try (Response response = client.newCall(request).execute()) { /* handle */ }`;
}

function javaString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function kotlinSnippet(i: SnippetInput): string {
  const lines = [
    `val url = Url(${jsString(i.url)})`,
    `val request = Request.Builder().url(url).method(${jsString(i.method)}${i.body ? `, ${jsString(i.body)}.toRequestBody("application/json".toMediaType())` : ""})`,
  ];
  for (const [k, v] of formatHeaders(i.headers)) lines.push(`    .header(${jsString(k)}, ${jsString(v)})`);
  lines.push(`    .build()`);
  return "// Ktor client example\n" + lines.join("\n");
}

function swiftSnippet(i: SnippetInput): string {
  const lines = [`let url = URL(string: ${jsString(i.url)})!`, `var request = URLRequest(url: url)`, `request.httpMethod = ${jsString(i.method)}`];
  if (i.body) lines.push(`request.httpBody = ${jsString(i.body)}.data(using: .utf8)`);
  for (const [k, v] of formatHeaders(i.headers)) lines.push(`request.setValue(${jsString(v)}, forHTTPHeaderField: ${jsString(k)})`);
  return lines.join("\n");
}

function csharpSnippet(i: SnippetInput): string {
  return `using var client = new HttpClient();
var request = new HttpRequestMessage(new HttpMethod(${jsString(i.method)}), ${jsString(i.url)});
request.Content = new StringContent(${i.body ? jsString(i.body) : '""'});${formatHeaders(i.headers).map(([k, v]) => `\nrequest.Headers.TryAddWithoutValidation(${jsString(k)}, ${jsString(v)});`).join("")}
var response = await client.SendAsync(request);`;
}

function goSnippet(i: SnippetInput): string {
  const lines = [
    `package main`,
    ``,
    `import (`,
    `  "fmt"`,
    `  "net/http"`,
    `  "strings"`,
    `)`,
    ``,
    `func main() {`,
    `  url := ${jsString(i.url)}`,
    ...(i.body ? [`  body := strings.NewReader(${jsString(i.body)})`] : []),
    `  req, _ := http.NewRequest(${jsString(i.method)}, url, ${i.body ? "body" : "nil"})`,
  ];
  for (const [k, v] of formatHeaders(i.headers)) lines.push(`  req.Header.Add(${jsString(k)}, ${jsString(v)})`);
  lines.push(`  resp, err := http.DefaultClient.Do(req)`, `  if err != nil { panic(err) }`, `  defer resp.Body.Close()`, `  fmt.Println(resp.Status)`, `}`);
  return lines.join("\n");
}

function phpSnippet(i: SnippetInput): string {
  const lines = [`$ch = curl_init();`, `curl_setopt($ch, CURLOPT_URL, ${phpString(i.url)});`, `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpString(i.method)});`, `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);`];
  const headers = formatHeaders(i.headers);
  if (headers.length) lines.push(`curl_setopt($ch, CURLOPT_HTTPHEADER, array(${headers.map(([k, v]) => phpString(`${k}: ${v}`)).join(", ")}));`);
  if (i.body) lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpString(i.body)});`);
  lines.push(`$response = curl_exec($ch);`, `curl_close($ch);`);
  return lines.join("\n");
}

function phpString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function rubySnippet(i: SnippetInput): string {
  const lines = [`require 'net/http'`, `require 'json'`, ``, `uri = URI(${jsString(i.url)})`, `request = Net::HTTP::${capitalize(i.method)}.new(uri)`];
  for (const [k, v] of formatHeaders(i.headers)) lines.push(`request[${jsString(k)}] = ${jsString(v)}`);
  if (i.body) lines.push(`request.body = ${jsString(i.body)}`);
  lines.push(`response = Net::HTTP.start(uri.hostname, uri.port) { |http| http.request(request) }`);
  return lines.join("\n");
}

function capitalize(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function httpSnippet(i: SnippetInput): string {
  const lines = [`${i.method} ${new URL(i.url, "http://x").pathname + new URL(i.url, "http://x").search} HTTP/1.1`];
  const host = (() => { try { return new URL(i.url).host; } catch { return ""; } })();
  lines.push(`Host: ${host}`);
  for (const [k, v] of formatHeaders(i.headers)) lines.push(`${k}: ${v}`);
  if (i.body) {
    lines.push("");
    lines.push(i.body);
  }
  return lines.join("\n");
}