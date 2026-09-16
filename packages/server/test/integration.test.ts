import { beforeAll, afterAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import request from "supertest";

// Set env BEFORE importing server modules (ESM hoisting means we must use
// dynamic imports below and set env first).
process.env.DATABASE_PATH = ":memory:";
process.env.JWT_SECRET = "integration-test-secret-32chars!";
process.env.VAULT_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");

let app: Express;
let echoServer: http.Server;
let echoPort = 0;

beforeAll(async () => {
  const { migrate } = await import("../src/db/migrate.js");
  migrate();
  const appModule = await import("../src/http/app.js");
  app = appModule.createApp();

  echoServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ method: req.method, url: req.url, body, ok: true }));
    });
  });
  await new Promise<void>((resolve) => {
    echoServer.listen(0, "127.0.0.1", () => {
      echoPort = (echoServer.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => echoServer.close(() => resolve()));
});

let token = "";
let workspaceId = "";

describe("auth + tenants", () => {
  it("registers and logs in", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      email: "alice@test.dev",
      name: "Alice",
      password: "password123",
    });
    expect(reg.status).toBe(201);
    token = reg.body.token;
    expect(reg.body.user.email).toBe("alice@test.dev");

    const login = await request(app).post("/api/auth/login").send({
      email: "alice@test.dev",
      password: "password123",
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "alice@test.dev", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("enforces tenant isolation", async () => {
    const bob = await request(app).post("/api/auth/register").send({
      email: "bob@test.dev",
      name: "Bob",
      password: "password123",
    });
    const bobTabs = await request(app).get("/api/workspaces").set("Authorization", `Bearer ${bob.body.token}`);
    expect(bobTabs.body.workspaces.length).toBe(1);

    const aliceWorkspaces = await request(app).get("/api/workspaces").set("Authorization", `Bearer ${token}`);
    workspaceId = aliceWorkspaces.body.workspaces[0].id;

    const forbidden = await request(app).get(`/api/workspaces/${workspaceId}`).set("Authorization", `Bearer ${bob.body.token}`);
    expect([401, 403, 404]).toContain(forbidden.status);
  });

  it("rejects missing token", async () => {
    const res = await request(app).get("/api/workspaces");
    expect(res.status).toBe(401);
  });
});

describe("collections + requests", () => {
  it("creates a collection and request", async () => {
    const col = await request(app).post(`/api/collections/${workspaceId}`).set("Authorization", `Bearer ${token}`).send({ name: "Test Collection" });
    expect(col.status).toBe(201);
    const collectionId = col.body.collection.id;

    const req = await request(app).post(`/api/requests/${workspaceId}`).set("Authorization", `Bearer ${token}`).send({
      name: "Echo GET",
      method: "GET",
      url: `http://127.0.0.1:${echoPort}/hello`,
      collectionId,
    });
    expect(req.status).toBe(201);
    const requestId = req.body.request.id;
    expect(requestId).toBeTruthy();
    (globalThis as Record<string, unknown>)._collectionId = collectionId;
    (globalThis as Record<string, unknown>)._requestId = requestId;
  });
});

describe("request execution", () => {
  it("sends a request and records history", async () => {
    const requestId = (globalThis as Record<string, unknown>)._requestId;
    const res = await request(app)
      .post(`/api/requests/${workspaceId}/${requestId}/send`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.response.status).toBe(200);
    expect(res.body.response.body).toContain("hello");

    const history = await request(app).get(`/api/history/${workspaceId}`).set("Authorization", `Bearer ${token}`);
    expect(history.body.entries.length).toBeGreaterThan(0);
    expect(history.body.entries[0].status).toBe(200);
  });

  it("resolves environment variables", async () => {
    const env = await request(app).post(`/api/environments/${workspaceId}`).set("Authorization", `Bearer ${token}`).send({
      name: "Local",
      variables: [{ name: "baseUrl", value: `http://127.0.0.1:${echoPort}`, enabled: true }],
    });
    const envId = env.body.environment.id;

    const req = await request(app).post(`/api/requests/${workspaceId}`).set("Authorization", `Bearer ${token}`).send({
      name: "Var Echo",
      method: "GET",
      url: "{{baseUrl}}/fromvar",
    });
    const requestId = req.body.request.id;

    const res = await request(app)
      .post(`/api/requests/${workspaceId}/${requestId}/send`)
      .set("Authorization", `Bearer ${token}`)
      .send({ environmentId: envId });
    expect(res.body.response.status).toBe(200);
    expect(res.body.response.body).toContain("/fromvar");
  });

  it("runs tests with assertions", async () => {
    const req = await request(app).post(`/api/requests/${workspaceId}`).set("Authorization", `Bearer ${token}`).send({
      name: "Tested Echo",
      method: "GET",
      url: `http://127.0.0.1:${echoPort}/assert`,
      events: {
        test: `pm.test("status is 200", function () { pm.response.to.have.status(200); });\npm.test("body has ok", function () { const j = pm.response.json(); pm.expect(j.ok).to.equal(true); });`,
      },
    });
    const res = await request(app)
      .post(`/api/requests/${workspaceId}/${req.body.request.id}/send`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.body.response.tests.length).toBe(2);
    expect(res.body.response.tests.every((t: { passed: boolean }) => t.passed)).toBe(true);
  });

  it("kills infinite-loop scripts", async () => {
    const req = await request(app).post(`/api/requests/${workspaceId}`).set("Authorization", `Bearer ${token}`).send({
      name: "Infinite",
      method: "GET",
      url: `http://127.0.0.1:${echoPort}/loop`,
      events: { prerequest: "while(true){}" },
    });
    const res = await request(app)
      .post(`/api/requests/${workspaceId}/${req.body.request.id}/send`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    // Response is typically an error/timeout response rather than a hang.
    expect(res.status).toBe(200);
  });
});

describe("secret vault", () => {
  it("stores and reveals a secret without leaking in list", async () => {
    const put = await request(app)
      .put(`/api/environments/${workspaceId}/secrets/apiToken`)
      .set("Authorization", `Bearer ${token}`)
      .send({ value: "super-secret-value" });
    expect(put.status).toBe(200);

    const list = await request(app).get(`/api/environments/${workspaceId}/secrets`).set("Authorization", `Bearer ${token}`);
    expect(list.body.secrets[0].key).toBe("apiToken");
    expect(JSON.stringify(list.body)).not.toContain("super-secret-value");

    const reveal = await request(app).post(`/api/environments/${workspaceId}/secrets/apiToken/reveal`).set("Authorization", `Bearer ${token}`).send({});
    expect(reveal.body.value).toBe("super-secret-value");
  });
});

describe("mocks", () => {
  it("serves a mock endpoint deterministically", async () => {
    const requestId = (globalThis as Record<string, unknown>)._requestId;
    const collectionId = (globalThis as Record<string, unknown>)._collectionId;
    const mock = await request(app).post(`/api/mocks/${workspaceId}`).set("Authorization", `Bearer ${token}`).send({
      name: "Test Mock",
      sourceCollectionId: collectionId,
      routes: [{ id: "r1", method: "GET", path: "/hello", responses: [{ id: "x1", name: "Ok", status: 200, statusText: "OK", headers: {}, body: '{"mocked":true}', delayMs: 0 }] }],
    });
    const mockId = mock.body.mock.id;

    const hit = await request(app).get(`/mock/${mockId}/hello`);
    expect(hit.status).toBe(200);
    expect(hit.body.mocked).toBe(true);
  });
});