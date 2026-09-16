import { queryAll, queryOne, run } from "../db/connection.js";
import { newId, nowIso, type ResponseExample } from "@apiplatform/shared";

interface ExampleRow {
  id: string;
  request_id: string;
  name: string;
  status: number | null;
  status_text: string;
  headers: string;
  body: string;
  created_at: string;
}

export interface SaveExampleInput {
  requestId: string;
  name?: string;
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

function toExample(row: ExampleRow): ResponseExample {
  return {
    id: row.id,
    requestId: row.request_id,
    name: row.name,
    status: row.status,
    statusText: row.status_text,
    headers: JSON.parse(row.headers) as Record<string, string>,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function saveExample(input: SaveExampleInput): ResponseExample {
  const id = newId("ex");
  run(
    `INSERT INTO examples (id, request_id, name, status, status_text, headers, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.requestId,
    input.name ?? `Example ${new Date().getTime() % 10000}`,
    input.status,
    input.statusText,
    JSON.stringify(input.headers),
    input.body,
    nowIso(),
  );
  return getExampleById(id)!;
}

export function listExamples(requestId: string): ResponseExample[] {
  return queryAll<ExampleRow>(
    "SELECT * FROM examples WHERE request_id = ? ORDER BY created_at DESC",
    requestId,
  ).map(toExample);
}

export function getExampleById(id: string): ResponseExample | undefined {
  const row = queryOne<ExampleRow>("SELECT * FROM examples WHERE id = ?", id);
  return row ? toExample(row) : undefined;
}

export function deleteExample(id: string): void {
  run("DELETE FROM examples WHERE id = ?", id);
}