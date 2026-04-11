import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadMpsaModules } from "./test_runner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const program = JSON.parse(readFileSync(resolve(ROOT, "tests/fixtures/program-sample.json"), "utf8"));

function load() {
  const sandbox = loadMpsaModules(["js/search.js"]);
  return sandbox.window.MPSA.search;
}

test("buildPeopleIndex dedupes by name+affiliation", () => {
  const S = load();
  const idx = S.buildPeopleIndex(program.sessions);
  const janes = idx.filter((p) => p.name === "Jane Smith");
  assert.equal(janes.length, 1);
  assert.equal(janes[0].affiliation, "University of Chicago");
});

test("buildPeopleIndex includes all participants", () => {
  const S = load();
  const idx = S.buildPeopleIndex(program.sessions);
  const names = idx.map((p) => p.name).sort();
  assert.deepEqual(names, ["Ana Garcia", "David Novak", "Hyunjin Lee", "Jane Smith", "Minji Kim", "Robert Chen"]);
});

test("matchPeople substring case-insensitive", () => {
  const S = load();
  const idx = S.buildPeopleIndex(program.sessions);
  const results = S.matchPeople(idx, "smi");
  const names = results.map((r) => r.name);
  assert.ok(names.includes("Jane Smith"));
});

test("matchPeople respects limit", () => {
  const S = load();
  const idx = S.buildPeopleIndex(program.sessions);
  const results = S.matchPeople(idx, "a", 2);
  assert.ok(results.length <= 2);
});

test("matchPeople empty query returns empty", () => {
  const S = load();
  const idx = S.buildPeopleIndex(program.sessions);
  assert.deepEqual(S.matchPeople(idx, ""), []);
  assert.deepEqual(S.matchPeople(idx, "   "), []);
});
