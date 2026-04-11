// tests/js/test_runner.mjs
// Loads a plain <script>-style JS file into an isolated scope and exposes MPSA.
// Uses new Function to keep execution in the host realm so objects returned from
// the modules are host-realm objects that pass assert.deepEqual across module
// boundaries (vm.createContext creates a new realm whose object literals fail
// node:assert/strict deepEqual in Node 18+).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

export function loadMpsaModules(relativePaths, extraGlobals = {}) {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Map,
    Set,
    ...extraGlobals,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const keys = Object.keys(sandbox);
  const vals = keys.map((k) => sandbox[k]);

  for (const rel of relativePaths) {
    const src = readFileSync(resolve(ROOT, rel), "utf8");
    // Run in host realm so returned objects pass assert.deepEqual
    const fn = new Function(...keys, src);
    fn(...vals);
  }
  return sandbox;
}

export function mockLocalStorage() {
  const store = {};
  return {
    store,
    api: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i] ?? null,
    },
  };
}
