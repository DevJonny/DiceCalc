import { describe, expect, it } from "vitest";
import { mergePresetMap, mergeScenarios } from "./mergeEngine";
import type { Scenario, WeaponPreset } from "../types";
import { defaultTargetModifiers, defaultWeaponModifiers } from "../calc";

const scn = (id: string, lastModified: string, isDeleted = false): Scenario => ({
  id,
  name: id,
  weapon: { name: id, toHit: 3, strength: 4, armourMod: 0, numDice: 10, damage: 1, modifiers: defaultWeaponModifiers() },
  target: { name: id, toughness: 4, armour: 4, unmodifiable: null, unitType: null, wounds: 1, modifiers: defaultTargetModifiers() },
  lastModified,
  isDeleted: isDeleted || undefined,
});

describe("mergeScenarios", () => {
  it("local-only entry → remote needs it", () => {
    const r = mergeScenarios([scn("a", "2026-05-01T00:00:00Z")], []);
    expect(r.merged).toHaveLength(1);
    expect(r.remoteChanged).toBe(true);
    expect(r.localChanged).toBe(false);
  });

  it("remote-only entry → local needs it", () => {
    const r = mergeScenarios([], [scn("a", "2026-05-01T00:00:00Z")]);
    expect(r.merged).toHaveLength(1);
    expect(r.localChanged).toBe(true);
    expect(r.remoteChanged).toBe(false);
  });

  it("both have entry, newer local wins", () => {
    const r = mergeScenarios(
      [scn("a", "2026-05-02T00:00:00Z")],
      [scn("a", "2026-05-01T00:00:00Z")],
    );
    expect(r.merged[0].lastModified).toBe("2026-05-02T00:00:00Z");
    expect(r.remoteChanged).toBe(true);
    expect(r.localChanged).toBe(false);
  });

  it("both have entry, newer remote wins", () => {
    const r = mergeScenarios(
      [scn("a", "2026-05-01T00:00:00Z")],
      [scn("a", "2026-05-02T00:00:00Z")],
    );
    expect(r.merged[0].lastModified).toBe("2026-05-02T00:00:00Z");
    expect(r.localChanged).toBe(true);
    expect(r.remoteChanged).toBe(false);
  });

  it("equal timestamps → no change", () => {
    const r = mergeScenarios(
      [scn("a", "2026-05-01T00:00:00Z")],
      [scn("a", "2026-05-01T00:00:00Z")],
    );
    expect(r.localChanged).toBe(false);
    expect(r.remoteChanged).toBe(false);
  });

  it("tombstone retained when fresh", () => {
    const r = mergeScenarios([scn("a", new Date().toISOString(), true)], []);
    expect(r.merged.find((s) => s.id === "a")?.isDeleted).toBe(true);
  });

  it("tombstone GC'd when older than 90 days", () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const r = mergeScenarios([scn("a", oldDate, true)], []);
    expect(r.merged).toHaveLength(0);
    expect(r.localChanged).toBe(true);
    expect(r.remoteChanged).toBe(true);
  });
});

describe("mergePresetMap", () => {
  const preset = (lm: string, isDeleted = false): WeaponPreset => ({
    profile: { name: "p", toHit: 3, strength: 4, armourMod: 0, numDice: 10, damage: 1, modifiers: defaultWeaponModifiers() },
    lastModified: lm,
    isDeleted: isDeleted || undefined,
  });

  it("merges by key, newer wins", () => {
    const r = mergePresetMap(
      { p: preset("2026-05-02T00:00:00Z") },
      { p: preset("2026-05-01T00:00:00Z") },
    );
    expect(r.merged.p.lastModified).toBe("2026-05-02T00:00:00Z");
    expect(r.remoteChanged).toBe(true);
  });

  it("tombstone deleted preset is GC'd after 90 days", () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const r = mergePresetMap({ p: preset(oldDate, true) }, {});
    expect(r.merged.p).toBeUndefined();
  });
});
