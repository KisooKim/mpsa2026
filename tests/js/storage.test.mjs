import { test } from "node:test";
import assert from "node:assert/strict";
import { loadMpsaModules, mockLocalStorage } from "./test_runner.mjs";

function load() {
  const ls = mockLocalStorage();
  const sandbox = loadMpsaModules(["js/storage.js"], { localStorage: ls.api });
  return { storage: sandbox.window.MPSA.storage, ls };
}

test("loadFilters returns empty state when nothing stored", () => {
  const { storage } = load();
  const s = storage.loadFilters();
  assert.deepEqual(s, { dates: [], authors: [], divisions: [], sessionTypes: [], keyword: "", favoritesOnly: false });
});

test("saveFilters persists state and loadFilters reads it back", () => {
  const { storage } = load();
  const state = { dates: ["2026-04-23"], authors: ["Jane Smith"], divisions: ["American Politics"], sessionTypes: [], keyword: "democracy", favoritesOnly: true };
  storage.saveFilters(state);
  assert.deepEqual(storage.loadFilters(), state);
});

test("loadFilters defaults favoritesOnly=false for pre-favorites stored state", () => {
  const { storage, ls } = load();
  ls.api.setItem("mpsa2026-filters", JSON.stringify({ dates: [], authors: [], divisions: [], sessionTypes: [], keyword: "" }));
  const s = storage.loadFilters();
  assert.equal(s.favoritesOnly, false);
});

test("listPresets returns empty array when none saved", () => {
  const { storage } = load();
  assert.deepEqual(storage.listPresets(), []);
});

test("savePreset creates a preset with id, timestamps, and appears in list", () => {
  const { storage } = load();
  const filters = { dates: ["2026-04-23"], authors: [], divisions: [], sessionTypes: [], keyword: "" };
  const p = storage.savePreset("Thursday only", filters);
  assert.ok(p.id);
  assert.equal(p.name, "Thursday only");
  assert.deepEqual(p.filters, filters);
  assert.equal(typeof p.createdAt, "number");
  assert.equal(p.createdAt, p.updatedAt);
  assert.deepEqual(storage.listPresets(), [p]);
});

test("updatePreset replaces filters and bumps updatedAt", async () => {
  const { storage } = load();
  const p = storage.savePreset("X", { dates: [], authors: [], divisions: [], sessionTypes: [], keyword: "" });
  const before = p.updatedAt;
  await new Promise((r) => setTimeout(r, 5));
  const updated = storage.updatePreset(p.id, { dates: ["2026-04-23"], authors: [], divisions: [], sessionTypes: [], keyword: "" });
  assert.deepEqual(updated.filters.dates, ["2026-04-23"]);
  assert.ok(updated.updatedAt >= before);
});

test("renamePreset changes the name", () => {
  const { storage } = load();
  const p = storage.savePreset("Old", { dates: [], authors: [], divisions: [], sessionTypes: [], keyword: "" });
  const renamed = storage.renamePreset(p.id, "New");
  assert.equal(renamed.name, "New");
  assert.equal(storage.listPresets()[0].name, "New");
});

test("deletePreset removes it", () => {
  const { storage } = load();
  const p = storage.savePreset("Doomed", { dates: [], authors: [], divisions: [], sessionTypes: [], keyword: "" });
  storage.deletePreset(p.id);
  assert.deepEqual(storage.listPresets(), []);
});

test("loadActivePresetId defaults to null", () => {
  const { storage } = load();
  assert.equal(storage.loadActivePresetId(), null);
});

test("saveActivePresetId persists and removes", () => {
  const { storage } = load();
  storage.saveActivePresetId("p_123");
  assert.equal(storage.loadActivePresetId(), "p_123");
  storage.saveActivePresetId(null);
  assert.equal(storage.loadActivePresetId(), null);
});

test("loadFilters survives corrupt JSON gracefully", () => {
  const { storage, ls } = load();
  ls.api.setItem("mpsa2026-filters", "{not json");
  assert.deepEqual(storage.loadFilters(), { dates: [], authors: [], divisions: [], sessionTypes: [], keyword: "", favoritesOnly: false });
});

test("loadFavorites returns empty Set when nothing stored", () => {
  const { storage } = load();
  const favs = storage.loadFavorites();
  assert.ok(favs instanceof Set);
  assert.equal(favs.size, 0);
});

test("toggleFavorite adds then removes", () => {
  const { storage } = load();
  const favs = storage.loadFavorites();
  assert.equal(storage.toggleFavorite(favs, "2315178"), true);
  assert.equal(storage.isFavorite(favs, "2315178"), true);
  assert.equal(storage.toggleFavorite(favs, "2315178"), false);
  assert.equal(storage.isFavorite(favs, "2315178"), false);
});

test("saveFavorites persists across loads", () => {
  const { storage } = load();
  const favs = storage.loadFavorites();
  storage.toggleFavorite(favs, "2315178");
  storage.toggleFavorite(favs, "2306163");
  // Reload from storage
  const reloaded = storage.loadFavorites();
  assert.equal(reloaded.size, 2);
  assert.ok(storage.isFavorite(reloaded, "2315178"));
  assert.ok(storage.isFavorite(reloaded, "2306163"));
});

test("loadFavorites survives corrupt JSON gracefully", () => {
  const { storage, ls } = load();
  ls.api.setItem("mpsa2026-favorites", "{not json");
  const favs = storage.loadFavorites();
  assert.ok(favs instanceof Set);
  assert.equal(favs.size, 0);
});

test("toggleFavorite coerces session IDs to strings", () => {
  const { storage } = load();
  const favs = storage.loadFavorites();
  storage.toggleFavorite(favs, 2315178);  // pass as number
  assert.ok(storage.isFavorite(favs, "2315178"));  // query as string
  assert.ok(storage.isFavorite(favs, 2315178));    // query as number
});
