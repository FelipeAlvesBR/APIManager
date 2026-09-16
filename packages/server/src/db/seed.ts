import { queryOne } from "./connection.js";
import { registerUser, getUserByEmail, type UserRow } from "../auth/service.js";
import { createWorkspace } from "../workspaces/service.js";
import { createEnvironment } from "../environments/service.js";
import { createCollection } from "../collections/service.js";
import { createRequest } from "../requests/service.js";
import { saveExample } from "../examples/service.js";
import { routesFromCollection, createMock } from "../mocks/service.js";
import { createSpec } from "../spec/service.js";
import { createMonitor } from "../monitors/service.js";
import { logger } from "../logger.js";

export const DEMO_EMAIL = "demo@apiplatform.dev";
export const DEMO_PASSWORD = "demo12345";

export async function seedIfEmpty(): Promise<void> {
  const existing = queryOne<{ id: string }>("SELECT id FROM users LIMIT 1");
  if (existing) return;
  logger.info("seeding demo data");
  await seedDemoWorkspace();
  logger.info("seeded demo workspace", { email: DEMO_EMAIL });
}

export async function seedDemoWorkspace(): Promise<void> {
  let user: UserRow | undefined = getUserByEmail(DEMO_EMAIL);
  if (!user) {
    const result = await registerUser({ email: DEMO_EMAIL, name: "Demo User", password: DEMO_PASSWORD });
    user = getUserByEmail(DEMO_EMAIL)!;
    void result;
  }
  const userId = user.id;

  const ws = createWorkspace(userId, {
    name: "Sample Commerce API",
    description: "Demo workspace showing collections, environments, tests, mocks and specs.",
    visibility: "team",
  });

  // Environments
  createEnvironment(userId, ws.id, {
    name: "Local",
    variables: [
      { name: "baseUrl", value: "http://localhost:3000", enabled: true },
      { name: "apiKey", value: "demo-local-key", enabled: true, secret: true },
    ],
  });
  const staging = createEnvironment(userId, ws.id, {
    name: "Staging",
    variables: [
      { name: "baseUrl", value: "https://staging.shop.example.com", enabled: true },
      { name: "apiKey", value: "demo-staging-key", enabled: true, secret: true },
    ],
  });
  createEnvironment(userId, ws.id, {
    name: "Production",
    variables: [
      { name: "baseUrl", value: "https://api.shop.example.com", enabled: true },
      { name: "apiKey", value: "demo-prod-key", enabled: true, secret: true },
    ],
  });

  // Collections
  const authCol = createCollection(userId, ws.id, { name: "Auth", description: "Authentication endpoints" });
  const products = createCollection(userId, ws.id, { name: "Products", description: "Product catalog" });
  const orders = createCollection(userId, ws.id, { name: "Orders", description: "Orders" });

  const loginRequest = createRequest(userId, ws.id, {
    name: "Login",
    method: "POST",
    url: "{{baseUrl}}/auth/login",
    header: [{ key: "Content-Type", value: "application/json", enabled: true }],
    body: { mode: "raw", raw: JSON.stringify({ email: "{{email}}", password: "{{password}}" }) },
    collectionId: authCol.id,
    events: {
      test: `pm.test("status is 200", function () {\n  pm.response.to.have.status(200);\n});\npm.test("has token", function () {\n  const json = pm.response.json();\n  pm.expect(json.token).to.exist;\n});`,
    },
  });
  saveExample({
    requestId: loginRequest.id,
    name: "Success",
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "{{token}}", user: { id: "usr_1", email: "demo@apiplatform.dev" } }),
  });

  const listProducts = createRequest(userId, ws.id, {
    name: "List Products",
    method: "GET",
    url: "{{baseUrl}}/products",
    collectionId: products.id,
    events: {
      test: `pm.test("status is 200", function () {\n  pm.response.to.have.status(200);\n});\npm.test("returns array", function () {\n  const json = pm.response.json();\n  pm.expect(json).to.be.an("array");\n});`,
    },
  });
  saveExample({
    requestId: listProducts.id,
    name: "Product list",
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ id: "{{productId}}", name: "Wireless Mouse", price: 29.99 }]),
  });
  const getProduct = createRequest(userId, ws.id, {
    name: "Get Product",
    method: "GET",
    url: "{{baseUrl}}/products/{{productId}}",
    collectionId: products.id,
    events: {
      test: `pm.test("id matches", function () {\n  const json = pm.response.json();\n  pm.expect(json.id).to.eql(pm.variables.get("productId"));\n});`,
    },
  });
  saveExample({
    requestId: getProduct.id,
    name: "Product 1",
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "{{productId}}", name: "Wireless Mouse", price: 29.99 }),
  });

  createRequest(userId, ws.id, {
    name: "Create Order",
    method: "POST",
    url: "{{baseUrl}}/orders",
    header: [{ key: "Content-Type", value: "application/json", enabled: true }],
    body: { mode: "raw", raw: JSON.stringify({ productId: "{{productId}}", quantity: 1 }) },
    collectionId: orders.id,
    auth: { type: "bearer", token: "{{token}}" },
    events: {
      test: `pm.test("status is 201", function () {\n  pm.response.to.have.status(201);\n});`,
    },
  });

  // Mock server from products collection
  createMock(userId, ws.id, {
    name: "Commerce Mock",
    sourceCollectionId: products.id,
    routes: routesFromCollection(userId, ws.id, products.id),
    latency: 0,
  });

  // OpenAPI spec
  createSpec(userId, ws.id, {
    name: "Commerce API",
    format: "openapi",
    content: JSON.stringify(
      {
        openapi: "3.0.0",
        info: { title: "Commerce API", version: "1.0.0", description: "Sample commerce API" },
        servers: [{ url: "https://api.shop.example.com" }],
        paths: {
          "/products": {
            get: { summary: "List products", responses: { "200": { description: "OK" } } },
          },
          "/products/{id}": {
            get: { summary: "Get product", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
          },
        },
      },
      null,
      2,
    ),
  });

  // Monitor
  createMonitor(userId, ws.id, {
    name: "Products health check",
    collectionId: products.id,
    environmentId: staging.id,
    schedule: "hourly",
    timeoutMs: 30000,
    failureThreshold: 0,
  });
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  const { migrate } = await import("./migrate.js");
  migrate();
  await seedIfEmpty();
}