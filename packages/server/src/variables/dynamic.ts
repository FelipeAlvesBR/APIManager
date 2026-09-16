import { randomUUID } from "node:crypto";

const FIRST_NAMES = ["Ada", "Grace", "Alan", "Linus", "Margaret", "Dennis", "Katherine", "Edsger", "Barbara", "Donald"];
const LAST_NAMES = ["Lovelace", "Hopper", "Turing", "Torvalds", "Hamilton", "Ritchie", "Johnson", "Dijkstra", "Liskov", "Knuth"];
const DOMAINS = ["example.com", "test.dev", "api.example.org", "mail.test"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function seed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

function ipv4(): string {
  const b = () => Math.floor(Math.random() * 256);
  return `${b()}.${b()}.${b()}.${b()}`;
}

export interface DynamicVariableFn {
  (): string;
}

export const DYNAMIC_VARIABLES: Record<string, DynamicVariableFn> = {
  $guid: () => randomUUID(),
  $uuid: () => randomUUID(),
  $randomUUID: () => randomUUID(),
  $randomGuid: () => randomUUID(),
  $randomEmail: () => `${pick(FIRST_NAMES).toLowerCase()}.${pick(LAST_NAMES).toLowerCase()}@${pick(DOMAINS)}`,
  $email: () => `${pick(FIRST_NAMES).toLowerCase()}${seed() % 100}@${pick(DOMAINS)}`,
  $randomFirstName: () => pick(FIRST_NAMES),
  $randomLastName: () => pick(LAST_NAMES),
  $randomFullName: () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
  $randomInt: () => String(Math.floor(Math.random() * 100000)),
  $randomInteger: () => String(Math.floor(Math.random() * 100000)),
  $randomFloat: () => (Math.random() * 1000).toFixed(4),
  $randomBoolean: () => (Math.random() < 0.5 ? "true" : "false"),
  $randomDateRecent: () => new Date().toISOString(),
  $randomDateTime: () => new Date(Date.now() - Math.random() * 86400000).toISOString(),
  $timestamp: () => String(Math.floor(Date.now() / 1000)),
  $isoTimestamp: () => new Date().toISOString(),
  $randomIP: () => ipv4(),
  $randomIp: () => ipv4(),
  $randomDomain: () => pick(DOMAINS),
  $randomUrl: () => `https://${pick(DOMAINS)}/${seed() % 1000}`,
  $randomHex: () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0"),
  $randomPassword: () => randomUUID().replace(/-/g, "").slice(0, 16),
};

export function resolveDynamic(name: string): string | undefined {
  const fn = DYNAMIC_VARIABLES[name];
  return fn ? fn() : undefined;
}