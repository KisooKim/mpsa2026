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
  const sandbox = loadMpsaModules(["js/filters.js"]);
  return sandbox.window.MPSA.filters;
}

const empty = { dates: [], authors: [], divisions: [], sessionTypes: [], keyword: "", favoritesOnly: false };
const s1 = program.sessions[0]; // Comparative, democracy/populism
const s2 = program.sessions[1]; // American, voting
const s3 = program.sessions[2]; // Roundtable Comparative 04-24

test("emptyState returns fresh empty FilterState", () => {
  const F = load();
  assert.deepEqual(F.emptyState(), empty);
});

test("isEmpty true for empty state, false otherwise", () => {
  const F = load();
  assert.equal(F.isEmpty(empty), true);
  assert.equal(F.isEmpty({ ...empty, dates: ["2026-04-23"] }), false);
  assert.equal(F.isEmpty({ ...empty, keyword: "x" }), false);
});

test("matches no filter: all pass", () => {
  const F = load();
  assert.equal(F.matches(s1, empty), true);
  assert.equal(F.matches(s2, empty), true);
  assert.equal(F.matches(s3, empty), true);
});

test("matches date OR within category", () => {
  const F = load();
  const state = { ...empty, dates: ["2026-04-23"] };
  assert.equal(F.matches(s1, state), true);
  assert.equal(F.matches(s2, state), true);
  assert.equal(F.matches(s3, state), false);
});

test("matches division OR within category", () => {
  const F = load();
  assert.equal(F.matches(s1, { ...empty, divisions: ["American Politics"] }), false);
  assert.equal(F.matches(s2, { ...empty, divisions: ["American Politics"] }), true);
  assert.equal(F.matches(s1, { ...empty, divisions: ["American Politics", "Comparative Politics"] }), true);
});

test("matches session type", () => {
  const F = load();
  assert.equal(F.matches(s3, { ...empty, sessionTypes: ["Roundtable"] }), true);
  assert.equal(F.matches(s1, { ...empty, sessionTypes: ["Roundtable"] }), false);
});

test("matches author substring on all_people", () => {
  const F = load();
  assert.equal(F.matches(s1, { ...empty, authors: ["Jane Smith"] }), true);
  assert.equal(F.matches(s2, { ...empty, authors: ["Jane Smith"] }), false);
  assert.equal(F.matches(s2, { ...empty, authors: ["Hyunjin Lee"] }), true);
});

test("authors OR'd", () => {
  const F = load();
  assert.equal(F.matches(s1, { ...empty, authors: ["Hyunjin Lee", "Jane Smith"] }), true);
  assert.equal(F.matches(s2, { ...empty, authors: ["Hyunjin Lee", "Jane Smith"] }), true);
});

test("matchesAuthors does not leak across the separator boundary", () => {
  const F = load();
  // all_people = ["jane smith", "robert chen"] — query "h ro" would match the
  // old ' | '-joined string. With per-entry iteration it must NOT match.
  assert.equal(F.matches(s1, { ...empty, authors: ["h ro"] }), false);
  // And a real partial still works
  assert.equal(F.matches(s1, { ...empty, authors: ["jane"] }), true);
});

test("keyword single word matches session title", () => {
  const F = load();
  assert.equal(F.matches(s1, { ...empty, keyword: "democratic" }), true);
  assert.equal(F.matches(s2, { ...empty, keyword: "democratic" }), false);
});

test("keyword matches paper titles", () => {
  const F = load();
  assert.equal(F.matches(s1, { ...empty, keyword: "populist" }), true);
});

test("multiple keywords AND'd", () => {
  const F = load();
  assert.equal(F.matches(s1, { ...empty, keyword: "democratic populist" }), true);
  assert.equal(F.matches(s1, { ...empty, keyword: "democratic turnout" }), false);
});

test("category AND: divisions AND keyword", () => {
  const F = load();
  const state = { ...empty, divisions: ["Comparative Politics"], keyword: "democratic" };
  assert.equal(F.matches(s1, state), true);
  assert.equal(F.matches(s3, state), false);
});

test("equals deep compare", () => {
  const F = load();
  assert.equal(F.equals(empty, F.emptyState()), true);
  assert.equal(F.equals({ ...empty, dates: ["a"] }, { ...empty, dates: ["a"] }), true);
  assert.equal(F.equals({ ...empty, dates: ["a"] }, { ...empty, dates: ["b"] }), false);
  assert.equal(F.equals({ ...empty, keyword: "x" }, { ...empty, keyword: "y" }), false);
  assert.equal(F.equals({ ...empty, favoritesOnly: true }, { ...empty, favoritesOnly: false }), false);
  assert.equal(F.equals({ ...empty, favoritesOnly: true }, { ...empty, favoritesOnly: true }), true);
});

test("isEmpty treats favoritesOnly as a non-empty filter", () => {
  const F = load();
  assert.equal(F.isEmpty({ ...empty, favoritesOnly: true }), false);
});

test("matches with favoritesOnly=true requires session id in the favorites set", () => {
  const F = load();
  const favs = new Set(["s1"]);
  // s1's id is "s1" in the fixture
  assert.equal(F.matches(s1, { ...empty, favoritesOnly: true }, favs), true);
  assert.equal(F.matches(s2, { ...empty, favoritesOnly: true }, favs), false);
  // Without favoritesOnly, the set is ignored
  assert.equal(F.matches(s2, empty, favs), true);
});

test("matches with favoritesOnly=true and null favorites returns false", () => {
  const F = load();
  assert.equal(F.matches(s1, { ...empty, favoritesOnly: true }, null), false);
  assert.equal(F.matches(s1, { ...empty, favoritesOnly: true }, undefined), false);
});

test("matches combines favoritesOnly with other filters (AND)", () => {
  const F = load();
  const favs = new Set(["s1", "s2", "s3"]);
  // s1 is date 2026-04-23, s3 is date 2026-04-24
  const state = { ...empty, favoritesOnly: true, dates: ["2026-04-23"] };
  assert.equal(F.matches(s1, state, favs), true);
  assert.equal(F.matches(s3, state, favs), false);
});
