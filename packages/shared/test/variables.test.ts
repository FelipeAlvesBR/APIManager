import { describe, expect, it } from "vitest";
import {
  findUnresolved,
  resolveTemplate,
  type VariableSource,
} from "../src/variables.js";
import { classifyStatus, statusPhrase } from "../src/errors.js";

const envVar: VariableSource = {
  name: "baseUrl",
  scope: "environment",
  secret: false,
  value: "https://api.example.com",
  enabled: true,
};
const collectionVar: VariableSource = {
  name: "baseUrl",
  scope: "collection",
  secret: false,
  value: "https://collection.example.com",
  enabled: true,
};
const globalVar: VariableSource = {
  name: "token",
  scope: "global",
  secret: true,
  value: "secret-123",
  enabled: true,
};
const runtimeVar: VariableSource = {
  name: "token",
  scope: "runtime",
  secret: false,
  value: "runtime-456",
  enabled: true,
};

describe("resolveTemplate", () => {
  it("resolves a simple variable", () => {
    const { resolved, unresolved } = resolveTemplate("{{baseUrl}}/users", [
      envVar,
    ]);
    expect(resolved).toBe("https://api.example.com/users");
    expect(unresolved).toEqual([]);
  });

  it("applies scope precedence (environment beats collection)", () => {
    const { resolved } = resolveTemplate("{{baseUrl}}", [
      collectionVar,
      envVar,
    ]);
    expect(resolved).toBe("https://api.example.com");
  });

  it("runtime scope beats global", () => {
    const { resolved } = resolveTemplate("{{token}}", [globalVar, runtimeVar]);
    expect(resolved).toBe("runtime-456");
  });

  it("reports unresolved variables and leaves them intact", () => {
    const { resolved, unresolved } = resolveTemplate("{{baseUrl}}/{{missing}}", [
      envVar,
    ]);
    expect(resolved).toBe("https://api.example.com/{{missing}}");
    expect(unresolved).toEqual(["missing"]);
  });

  it("handles multiple references of the same variable", () => {
    const { resolved } = resolveTemplate("{{baseUrl}}/{{baseUrl}}", [envVar]);
    expect(resolved).toBe("https://api.example.com/https://api.example.com");
  });
});

describe("findUnresolved", () => {
  it("finds all variable names", () => {
    expect(findUnresolved("{{a}} and {{ b }} and {{a}}")).toEqual(["a", "b"]);
  });
});

describe("errors", () => {
  it("maps status phrases", () => {
    expect(statusPhrase(200)).toBe("OK");
    expect(statusPhrase(999)).toBe("Unknown");
  });
  it("classifies statuses", () => {
    expect(classifyStatus(200)).toBe("success");
    expect(classifyStatus(301)).toBe("redirect");
    expect(classifyStatus(404)).toBe("clientError");
    expect(classifyStatus(500)).toBe("serverError");
  });
});