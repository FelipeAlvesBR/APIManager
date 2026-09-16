import type { VariableDefinition, VariableScope } from "./types.js";

export interface VariableSource {
  name: string;
  scope: VariableScope;
  secret: boolean;
  value: string;
  enabled: boolean;
  description?: string;
}

/** Variable precedente order, highest first (matches the spec in section 11). */
export const SCOPE_PRECEDENCE: VariableScope[] = [
  "runtime",
  "data",
  "environment",
  "collection",
  "global",
  "system",
];

/** Matches {{name}} with optional surrounding whitespace inside the braces. */
export const VARIABLE_REFERENCE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export interface ResolutionResult {
  resolved: string;
  unresolved: string[];
}

/**
 * Resolve a template string against a collection of variable sources.
 * Sources are applied in increasing-precedence order; the first enabled
 * match from the highest-precedence source wins.
 */
export function resolveTemplate(
  template: string,
  sources: VariableSource[],
): ResolutionResult {
  const byName = buildLookup(sources);
  const unresolved: string[] = [];

  const resolved = template.replace(VARIABLE_REFERENCE, (match, rawName) => {
    const name = String(rawName).trim();
    const entries = byName.get(name);
    if (!entries || entries.length === 0) {
      unresolved.push(name);
      return match;
    }
    const entry = entries.find((e) => e.enabled) ?? entries[0];
    if (!entry || !entry.enabled) {
      unresolved.push(name);
      return match;
    }
    return entry.value;
  });

  return { resolved, unresolved };
}

function buildLookup(
  sources: VariableSource[],
): Map<string, VariableSource[]> {
  const map = new Map<string, VariableSource[]>();
  // Group by name; order within a name is decided by scope precedence later.
  for (const source of sources) {
    const list = map.get(source.name) ?? [];
    list.push(source);
    map.set(source.name, list);
  }
  // Sort each list by scope precedence (highest first).
  const precedenceIndex: Record<VariableScope, number> = Object.fromEntries(
    SCOPE_PRECEDENCE.map((scope, i) => [scope, i]),
  ) as Record<VariableScope, number>;

  for (const [name, list] of map) {
    list.sort(
      (a, b) => precedenceIndex[a.scope] - precedenceIndex[b.scope],
    );
  }
  return map;
}

export function findUnresolved(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(VARIABLE_REFERENCE)) {
    found.add(match[1]!.trim());
  }
  return [...found];
}

export function isSecretVariable(def: VariableDefinition): boolean {
  return Boolean(def.secret);
}

/** Redact a resolved value if it originated from a secret variable. */
export function maskSecret(value: string): string {
  if (!value) return value;
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}••••••${value.slice(-2)}`;
}