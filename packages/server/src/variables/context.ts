import {
  resolveTemplate,
  type VariableDefinition,
  type VariableSource,
} from "@apiplatform/shared";
import { resolveDynamic } from "./dynamic.js";

export interface VariableContext {
  /** Ordered sources (highest precedence first is NOT required; resolveTemplate sorts). */
  sources: VariableSource[];
  /** Raw runtime variables (script-set) by name. */
  runtime: Record<string, string>;
  /** Names that must always be treated as secret for logging/redaction. */
  secretNames: Set<string>;
}

export function emptyContext(): VariableContext {
  return { sources: [], runtime: {}, secretNames: new Set() };
}

function toSources(
  defs: VariableDefinition[],
  scope: VariableDefinition["scope"] & string,
): VariableSource[] {
  return defs.map((d) => ({
    name: d.name,
    scope: (d.scope ?? scope) as VariableSource["scope"],
    secret: Boolean(d.secret),
    value: d.value,
    enabled: d.enabled,
    description: d.description,
  }));
}

export function buildContext(input: {
  runtime?: Record<string, string>;
  data?: Record<string, string>;
  environment?: VariableDefinition[];
  collection?: VariableDefinition[];
  globals?: VariableDefinition[];
  secretNames?: Set<string>;
}): VariableContext {
  const runtime = input.runtime ?? {};
  const sources: VariableSource[] = [];
  for (const [name, value] of Object.entries(runtime)) {
    sources.push({ name, scope: "runtime", secret: false, value, enabled: true });
  }
  if (input.data) {
    for (const [name, value] of Object.entries(input.data)) {
      sources.push({ name, scope: "data", secret: false, value, enabled: true });
    }
  }
  sources.push(...toSources(input.environment ?? [], "environment"));
  sources.push(...toSources(input.collection ?? [], "collection"));
  sources.push(...toSources(input.globals ?? [], "global"));
  return { sources, runtime, secretNames: input.secretNames ?? new Set() };
}

/**
 * Resolve a template string against a context. Also evaluates built-in dynamic
 * variables (e.g. {{$guid}}) and vault secrets via {{$secret.<key>}}.
 */
export function resolve(
  template: string,
  ctx: VariableContext,
  secrets?: Map<string, string>,
): { value: string; unresolved: string[] } {
  const { resolved, unresolved } = resolveTemplate(template, ctx.sources);
  // Second pass for dynamic variables and vault secrets.
  const withDynamic = resolved.replace(
    /\{\{\s*(\$[a-zA-Z0-9_.-]+)\s*\}\}/g,
    (m, name: string) => {
      if (name.startsWith("$secret.") && secrets) {
        const key = name.slice("$secret.".length);
        const value = secrets.get(key);
        if (value === undefined) {
          unresolved.push(key);
          return m;
        }
        return value;
      }
      const dynamic = resolveDynamic(name);
      if (dynamic === undefined) {
        if (!unresolved.includes(name)) unresolved.push(name);
        return m;
      }
      return dynamic;
    },
  );
  return { value: withDynamic, unresolved };
}

/** Resolve a variable reference directly for hover/preview purposes. */
export function lookup(name: string, ctx: VariableContext): VariableSource | undefined {
  return ctx.sources.find((s) => s.name === name && s.enabled);
}