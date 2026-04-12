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

test("exportAll captures presets, favorites, filters, and active preset", () => {
  const { storage } = load();
  // Seed some state
  const state = { dates: ["2026-04-23"], authors: ["Jane Smith"], divisions: [], sessionTypes: [], keyword: "democracy", favoritesOnly: true };
  storage.saveFilters(state);
  const p = storage.savePreset("Test", state);
  storage.saveActivePresetId(p.id);
  const favs = storage.loadFavorites();
  storage.toggleFavorite(favs, "2315178");
  storage.toggleFavorite(favs, "2306163");

  const backup = storage.exportAll();
  assert.equal(backup.app, "mpsa2026-viewer");
  assert.equal(backup.version, 1);
  assert.ok(backup.exported_at);
  assert.deepEqual(backup.filters, state);
  assert.equal(backup.active_preset_id, p.id);
  assert.equal(backup.presets.length, 1);
  assert.equal(backup.presets[0].name, "Test");
  assert.deepEqual(backup.favorites.sort(), ["2306163", "2315178"]);
});

test("importAll replaces existing state", () => {
  const { storage } = load();
  // Seed initial state that should be overwritten
  storage.savePreset("Old", storage.emptyFilters());
  const favs = storage.loadFavorites();
  storage.toggleFavorite(favs, "old-id");

  // Import a new backup
  const newBackup = {
    app: "mpsa2026-viewer",
    version: 1,
    exported_at: "2026-04-11T00:00:00Z",
    filters: { dates: ["2026-04-25"], authors: [], divisions: [], sessionTypes: [], keyword: "", favoritesOnly: false },
    active_preset_id: null,
    presets: [
      { id: "p_imported", name: "Imported", filters: storage.emptyFilters(), createdAt: 100, updatedAt: 200 },
    ],
    favorites: ["2315178", "2306163"],
  };
  const summary = storage.importAll(newBackup);
  assert.equal(summary.presets, 1);
  assert.equal(summary.favorites, 2);
  assert.equal(summary.filters, true);

  // Verify state was replaced
  const presets = storage.listPresets();
  assert.equal(presets.length, 1);
  assert.equal(presets[0].name, "Imported");

  const favsAfter = storage.loadFavorites();
  assert.equal(favsAfter.size, 2);
  assert.ok(favsAfter.has("2315178"));
  assert.ok(!favsAfter.has("old-id"));

  const filtersAfter = storage.loadFilters();
  assert.deepEqual(filtersAfter.dates, ["2026-04-25"]);
});

test("importAll accepts a JSON string", () => {
  const { storage } = load();
  const json = JSON.stringify({
    app: "mpsa2026-viewer",
    version: 1,
    filters: storage.emptyFilters(),
    presets: [],
    favorites: ["x"],
  });
  const summary = storage.importAll(json);
  assert.equal(summary.favorites, 1);
});

test("importAll rejects invalid payloads", () => {
  const { storage } = load();
  assert.throws(() => storage.importAll(null), /not a JSON object/i);
  assert.throws(() => storage.importAll({ app: "something-else", version: 1 }), /not an MPSA/i);
  assert.throws(() => storage.importAll({ app: "mpsa2026-viewer", version: 99 }), /unsupported/i);
  assert.throws(() => storage.importAll("{not json"), SyntaxError);
});

test("importAll backfills missing preset timestamps", () => {
  const { storage } = load();
  storage.importAll({
    app: "mpsa2026-viewer",
    version: 1,
    presets: [{ id: "p1", name: "NoDates", filters: storage.emptyFilters() }],
  });
  const p = storage.listPresets()[0];
  assert.equal(typeof p.createdAt, "number");
  assert.equal(typeof p.updatedAt, "number");
});

// ── Font scale preferences ──

test("loadFontScale returns 1.0 when nothing stored", () => {
  const { storage } = load();
  const val = storage.loadFontScale();
  assert.strictEqual(val, 1.0);
});

test("saveFontScale + loadFontScale round-trips", () => {
  const { storage } = load();
  storage.saveFontScale(1.3);
  assert.strictEqual(storage.loadFontScale(), 1.3);
  storage.saveFontScale(0.9);
  assert.strictEqual(storage.loadFontScale(), 0.9);
});

test("loadFontScale rejects invalid values", () => {
  const { storage, ls } = load();
  ls.api.setItem("mpsa2026-font-scale", "2.5");
  assert.strictEqual(storage.loadFontScale(), 1.0);
  ls.api.setItem("mpsa2026-font-scale", "garbage");
  assert.strictEqual(storage.loadFontScale(), 1.0);
});

// ── High contrast preferences ──

test("loadHighContrast returns false when nothing stored", () => {
  const { storage } = load();
  assert.strictEqual(storage.loadHighContrast(), false);
});

test("saveHighContrast + loadHighContrast round-trips", () => {
  const { storage } = load();
  storage.saveHighContrast(true);
  assert.strictEqual(storage.loadHighContrast(), true);
  storage.saveHighContrast(false);
  assert.strictEqual(storage.loadHighContrast(), false);
});
