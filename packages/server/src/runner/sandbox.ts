import { Worker } from "node:worker_threads";
import type {
  ResponseSnapshot,
  ScriptLog,
  TestResult,
} from "@apiplatform/shared";

export interface SandboxState {
  runtime: Record<string, string>;
  environment: Record<string, string>;
  collection: Record<string, string>;
  globals: Record<string, string>;
  environmentName?: string;
  cookies: Record<string, string>;
  secretNames: string[];
}

export interface ScriptRunPayload {
  code: string;
  timeoutMs: number;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response: {
    status: number | null;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    responseTime: number;
  };
  state: SandboxState;
  sendRequestAllowed: boolean;
}

export interface ScriptRunResult {
  ok: boolean;
  error?: string;
  tests: TestResult[];
  logs: ScriptLog[];
  runtime: Record<string, string>;
  environment: Record<string, string>;
  collection: Record<string, string>;
  globals: Record<string, string>;
  cookies: Record<string, string>;
}

const WORKER_CODE = `
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');

function AssertionError(message) {
  const e = new Error(message);
  e.name = 'AssertionError';
  return e;
}

function makeExpect(actual) {
  const target = { actual: actual, negated: false };
  const chainWords = { to: 1, be: 1, been: 1, is: 1, that: 1, which: 1, and: 1, with: 1, has: 1, have: 1, at: 1, of: 1, same: 1 };
  const typeWords = { string: 1, number: 1, object: 1, array: 1, boolean: 1, function: 1, undefined: 1, null: 1 };

  function fail(msg) {
    const prefix = target.negated ? 'expected NOT ' : 'expected ';
    throw new AssertionError(prefix + msg);
  }
  function ok(v) { return Boolean(v); }
  function isOk(cond, msg) {
    const pass = target.negated ? !cond : cond;
    if (!pass) fail(msg);
  }
  function deepEqual(a, b) { try { return require('node:util').isDeepStrictEqual(a, b); } catch (e) { return a === b; } }

  const methods = {
    status: function (code) { return methods.code.call(this, code); },
    code: function (code) {
      const v = (actual && typeof actual === 'object' && 'code' in actual) ? actual.code : actual;
      return isOk(v === code, 'status code to equal ' + code + ' but got ' + v);
    },
    statusCode: function (code) { return methods.code.call(this, code); },
    equal: function (v) { return isOk(actual === v, 'value to equal ' + JSON.stringify(v) + ' but got ' + JSON.stringify(actual)); },
    eq: function (v) { return methods.equal.call(this, v); },
    equals: function (v) { return methods.equal.call(this, v); },
    eql: function (v) { return isOk(deepEqual(actual, v), 'deep equality with ' + JSON.stringify(v)); },
    deep: function (v) { return methods.eql.call(this, v); },
    deeplyEqual: function (v) { return methods.eql.call(this, v); },
    include: function (item) {
      let contained = false;
      if (typeof actual === 'string') contained = actual.includes(item);
      else if (Array.isArray(actual)) contained = actual.some(function (x) { return deepEqual(x, item); });
      else if (actual && typeof actual === 'object') contained = deepEqual(actual[item], undefined) ? false : Object.prototype.hasOwnProperty.call(actual, item);
      if (arguments.length === 0) contained = true;
      return isOk(contained, 'value to include ' + JSON.stringify(item));
    },
    contains: function (item) { return methods.include.call(this, item); },
    contain: function (item) { return methods.include.call(this, item); },
    haveProperty: function (name, value) {
      const has = actual != null && Object.prototype.hasOwnProperty.call(actual, name);
      if (!has) return isOk(false, 'to have property "' + name + '"');
      if (value !== undefined) return isOk(deepEqual(actual[name], value), 'property "' + name + '" to equal ' + JSON.stringify(value));
      return isOk(true, '');
    },
    property: function (name, value) { return methods.haveProperty.call(this, name, value); },
    length: function (n) { return isOk(actual != null && actual.length === n, 'length to equal ' + n + ' but got ' + (actual && actual.length)); },
    lengthOf: function (n) { return methods.length.call(this, n); },
    above: function (n) { return isOk(actual > n, 'value to be above ' + n); },
    greaterThan: function (n) { return methods.above.call(this, n); },
    below: function (n) { return isOk(actual < n, 'value to be below ' + n); },
    lessThan: function (n) { return methods.below.call(this, n); },
    least: function (n) { return isOk(actual >= n, 'value to be at least ' + n); },
    most: function (n) { return isOk(actual <= n, 'value to be at most ' + n); },
    match: function (re) { return isOk(new RegExp(re).test(actual), 'value to match ' + re); },
    matches: function (re) { return methods.match.call(this, re); },
    empty: function () { return isOk(actual == null || actual.length === 0 || (typeof actual === 'object' && Object.keys(actual).length === 0), 'value to be empty'); },
    keys: function () { var names = Array.prototype.slice.call(arguments); var k = actual ? Object.keys(actual) : []; return isOk(names.every(function (n) { return k.indexOf(n) >= 0; }), 'to have keys ' + names.join(',')); },
    oneOf: function (arr) { return isOk(arr.some(function (x) { return deepEqual(x, actual); }), 'value to be one of ' + JSON.stringify(arr)); },
    in: function (arr) { return methods.oneOf.call(this, arr); },
    a: function (type) { if (type) return methods.type(type); return proxy; },
    an: function (type) { if (type) return methods.type(type); return proxy; },
    type: function (t) {
      const checks = {
        string: function (v) { return typeof v === 'string'; },
        number: function (v) { return typeof v === 'number'; },
        object: function (v) { return v && typeof v === 'object' && !Array.isArray(v); },
        array: function (v) { return Array.isArray(v); },
        boolean: function (v) { return typeof v === 'boolean'; },
        function: function (v) { return typeof v === 'function'; },
      };
      const f = checks[t];
      if (!f) return isOk(false, 'unknown type ' + t);
      return isOk(f(actual), 'a ' + t + ' but got ' + typeof actual);
    },
    json: function () { return proxy; },
    body: function (str) { const v = (actual && typeof actual === 'object' && 'body' in actual) ? actual.body : actual; return isOk(typeof v === 'string' && v.includes(str), 'body to contain ' + str); },
    text: function (str) { return methods.body.call(this, str); },
    header: function (name, value) {
      const headers = (actual && typeof actual === 'object' && 'headers' in actual) ? actual.headers : {};
      const has = headers != null && (headers[name] !== undefined || (headers.get && headers.get(name) !== null));
      if (!has) return isOk(false, 'to have header "' + name + '"');
      if (value !== undefined) { const actualVal = headers.get ? headers.get(name) : headers[name]; return isOk(actualVal === value, 'header "' + name + '" to equal ' + value); }
      return isOk(true, '');
    },
    jsonBody: function (subset) {
      var body = (actual && typeof actual === 'object' && 'json' in actual) ? actual.json() : null;
      var parsed = body != null && typeof body === 'object' ? body : (() => { try { return JSON.parse(actual && actual.body ? actual.body : '{}'); } catch (e) { return null; } })();
      if (parsed == null) return isOk(false, 'response to be valid JSON');
      for (var k in subset) { if (!deepEqual(parsed[k], subset[k])) return isOk(false, 'json body to have ' + k + ' == ' + JSON.stringify(subset[k])); }
      return isOk(true, '');
    }
  };

  const getters = {
    ok: function () { return isOk(ok(actual), 'value to be truthy'); },
    true: function () { return isOk(actual === true, 'value to be true'); },
    false: function () { return isOk(actual === false, 'value to be false'); },
    null: function () { return isOk(actual === null, 'value to be null'); },
    undefined: function () { return isOk(actual === undefined, 'value to be undefined'); },
    exist: function () { return isOk(actual != null, 'value to exist'); },
    existProperty: function () { return proxy; }
  };

  const proxy = new Proxy(target, {
    get: function (t, prop) {
      if (prop === 'not') { t.negated = !t.negated; return proxy; }
      if (prop === 'actual') return t.actual;
      if (prop in chainWords) return proxy;
      if (prop in methods) return function () { methods[prop].apply(this, arguments); return proxy; };
      if (prop in getters) { getters[prop](); return proxy; }
      if (prop === 'to') return proxy;
      if (prop === Symbol.toStringTag) return 'Expect';
      if (prop === 'then') return undefined;
      return undefined;
    }
  });
  return proxy;
}

function formatLog(args) {
  args = Array.prototype.slice.call(args);
  return args.map(function (a) {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.stack || a.message;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }).join(' ');
}

function run() {
  const data = workerData;
  const state = {
    runtime: Object.assign({}, data.state.runtime),
    environment: Object.assign({}, data.state.environment),
    collection: Object.assign({}, data.state.collection),
    globals: Object.assign({}, data.state.globals),
    environmentName: data.state.environmentName || '',
    cookies: Object.assign({}, data.state.cookies),
    secretNames: data.state.secretNames || []
  };
  const tests = [];
  const logs = [];
  let pending = 0;

  const req = data.request || {};
  const res = data.response || {};

  const pmResponse = {
    get code() { return res.status; },
    get status() { return res.statusText || ''; },
    get statusCode() { return res.status; },
    get reason() { return res.statusText || ''; },
    get responseTime() { return res.responseTime || 0; },
    get headers() { const h = {}; var hs = res.headers || {}; Object.keys(hs).forEach(function (k) { h[k] = hs[k]; }); return h; },
    get body() { return res.body || ''; },
    text: function () { return res.body || ''; },
    json: function () { try { return JSON.parse(res.body || '{}'); } catch (e) { return null; } },
    get to() { return makeExpect({ code: res.status, status: res.statusText, headers: res.headers, body: res.body, json: this.json.bind(this) }); }
  };

  function makeVarScope(getStore) {
    return {
      get: function (name) { return getStore() != null && getStore()[name] !== undefined ? String(getStore()[name]) : undefined; },
      set: function (name, value) { getStore()[name] = String(value); },
      unset: function (name) { delete getStore()[name]; },
      has: function (name) { return getStore()[name] !== undefined; },
      toObject: function () { return Object.assign({}, getStore()); },
      replaceIn: function (str) { return String(str).replace(/\\{\\{\\s*([a-zA-Z0-9_.-]+)\\s*\\}\\}/g, function (m, n) { var v = getStore()[n]; return v === undefined ? m : v; }); }
    };
  }

  const pm = {
    variables: makeVarScope(function () { return state.runtime; }),
    environment: Object.assign(makeVarScope(function () { return state.environment; }), { name: state.environmentName }),
    collectionVariables: makeVarScope(function () { return state.collection; }),
    globals: makeVarScope(function () { return state.globals; }),
    request: {
      get method() { return req.method || 'GET'; },
      get url() { return req.url || ''; },
      get headers() { const h = {}; var hs = req.headers || {}; Object.keys(hs).forEach(function (k) { h[k] = hs[k]; }); return h; },
      get body() { return req.body; }
    },
    response: pmResponse,
    info: { eventName: 'script' },
    test: function (name, fn) {
      const start = Date.now();
      try { fn(); tests.push({ name: name, passed: true }); }
      catch (e) { tests.push({ name: name, passed: false, message: e && e.message ? e.message : String(e) }); }
    },
    expect: makeExpect,
    sendRequest: function (input, cb) {
      if (!data.sendRequestAllowed) { if (cb) cb(new Error('sendRequest is disabled')); return Promise.reject(new Error('sendRequest is disabled')); }
      pending++;
      var uri = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var method = (input && input.method) || 'GET';
      var headers = {};
      var hs = input && input.header;
      if (hs) { if (Array.isArray(hs)) { hs.forEach(function (h) { headers[h.key] = h.value; }); } else { Object.assign(headers, hs); } }
      var body = input && input.body;
      var fetchPromise = fetch(uri, { method: method, headers: headers, body: method === 'GET' || method === 'HEAD' ? undefined : body })
        .then(function (fr) {
          return fr.text().then(function (txt) {
            const resp = {
              code: fr.status,
              status: fr.statusText || '',
              responseTime: Date.now(),
              headers: Object.fromEntries(fr.headers.entries()),
              text: function () { return txt; },
              json: function () { try { return JSON.parse(txt); } catch (e) { return null; } },
              to: makeExpect({ code: fr.status, headers: Object.fromEntries(fr.headers.entries()), body: txt, json: function () { return JSON.parse(txt); } })
            };
            if (cb) cb(null, resp);
            return resp;
          });
        })
        .catch(function (err) { if (cb) cb(err); throw err; })
        .finally(function () { pending--; });
      if (!cb) return fetchPromise;
      return undefined;
    },
    cookies: {
      get: function (name) { return state.cookies[name]; },
      set: function (name, value) { state.cookies[name] = String(value); },
      unset: function (name) { delete state.cookies[name]; },
      toObject: function () { return Object.assign({}, state.cookies); }
    },
    execution: { location: { name: 'script' } }
  };

  const consoleObj = {
    log: function () { logs.push({ level: 'log', message: formatLog(arguments) }); },
    info: function () { logs.push({ level: 'info', message: formatLog(arguments) }); },
    warn: function () { logs.push({ level: 'warn', message: formatLog(arguments) }); },
    error: function () { logs.push({ level: 'error', message: formatLog(arguments) }); },
    debug: function () { logs.push({ level: 'log', message: formatLog(arguments) }); }
  };

  const sandbox = {
    pm: pm,
    console: consoleObj,
    consolelog: consoleObj.log,
    JSON: JSON, Object: Object, Array: Array, Math: Math, Date: Date,
    String: String, Number: Number, Boolean: Boolean, RegExp: RegExp,
    parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN,
    Promise: Promise, Error: Error, TypeError: TypeError,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    encodeURI: encodeURI, decodeURI: decodeURI,
    ArrayBuffer: ArrayBuffer, Uint8Array: Uint8Array, setTimeout: setTimeout, clearTimeout: clearTimeout
  };
  vm.createContext(sandbox);

  let scriptError = null;
  try {
    const ret = vm.runInContext(data.code, sandbox, { timeout: data.timeoutMs });
    if (ret && typeof ret.then === 'function') {
      ret.then(function () {}, function (e) { scriptError = e; });
    }
  } catch (e) {
    scriptError = e;
  }

  const deadline = Date.now() + data.timeoutMs + 2000;
  function drain() {
    return new Promise(function (resolve) {
      (function check() {
        if (pending <= 0) return resolve();
        if (Date.now() > deadline) return resolve();
        setTimeout(check, 5);
      })();
    });
  }
  drain().then(function () {
    if (scriptError && tests.length === 0 && pending === 0 && !(scriptError.name === 'AssertionError')) {
      parentPort.postMessage({ ok: false, error: scriptError && scriptError.message ? scriptError.message : String(scriptError), stack: scriptError && scriptError.stack ? scriptError.stack : undefined, tests: tests, logs: logs, runtime: state.runtime, environment: state.environment, collection: state.collection, globals: state.globals, cookies: state.cookies });
    } else {
      parentPort.postMessage({ ok: true, tests: tests, logs: logs, runtime: state.runtime, environment: state.environment, collection: state.collection, globals: state.globals, cookies: state.cookies });
    }
  });
}

run();
`;

export function runScript(payload: ScriptRunPayload): Promise<ScriptRunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_CODE, {
      eval: true,
      workerData: payload,
    });

    let settled = false;
    const hardTimeoutMs = Math.max(payload.timeoutMs + 3000, 5000);

    const finish = (result: ScriptRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      void worker.terminate();
      resolve(result);
    };

    const hardTimer = setTimeout(() => {
      finish({
        ok: false,
        error: `Script exceeded the ${payload.timeoutMs}ms execution limit or was terminated (possible infinite loop)`,
        tests: [],
        logs: [],
        runtime: payload.state.runtime,
        environment: payload.state.environment,
        collection: payload.state.collection,
        globals: payload.state.globals,
        cookies: payload.state.cookies,
      });
    }, hardTimeoutMs);

    worker.on("message", (msg: Record<string, unknown>) => {
      finish({
        ok: Boolean(msg.ok),
        error: msg.error ? String(msg.error) : undefined,
        tests: (msg.tests as TestResult[]) ?? [],
        logs: (msg.logs as ScriptLog[]) ?? [],
        runtime: (msg.runtime as Record<string, string>) ?? payload.state.runtime,
        environment: (msg.environment as Record<string, string>) ?? payload.state.environment,
        collection: (msg.collection as Record<string, string>) ?? payload.state.collection,
        globals: (msg.globals as Record<string, string>) ?? payload.state.globals,
        cookies: (msg.cookies as Record<string, string>) ?? payload.state.cookies,
      });
    });

    worker.on("error", (err) => {
      finish({
        ok: false,
        error: err?.message ?? "Script worker error",
        tests: [],
        logs: [],
        runtime: payload.state.runtime,
        environment: payload.state.environment,
        collection: payload.state.collection,
        globals: payload.state.globals,
        cookies: payload.state.cookies,
      });
    });

    worker.on("exit", (code) => {
      if (!settled && code !== 0) {
        finish({
          ok: false,
          error: `Script worker exited with code ${code}`,
          tests: [],
          logs: [],
          runtime: payload.state.runtime,
          environment: payload.state.environment,
          collection: payload.state.collection,
          globals: payload.state.globals,
          cookies: payload.state.cookies,
        });
      }
    });
  });
}