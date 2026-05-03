import { describe, expect, it } from "vitest";
import {
  applyReroll,
  combineModifiers,
  computeAll,
  computeHitStage,
  defaultTargetModifiers,
  defaultWeaponModifiers,
  effectiveHitTarget,
  effectiveSave,
  woundTarget,
} from "./calc";
import type { Modifiers, TargetProfile, WeaponProfile } from "./types";

const baseMods = (): Modifiers =>
  combineModifiers(defaultWeaponModifiers(), defaultTargetModifiers());

const weapon = (
  over: Partial<Omit<WeaponProfile, "modifiers">> = {},
  mods: Partial<Modifiers> = {},
): WeaponProfile => ({
  name: "W",
  toHit: 3,
  strength: 4,
  armourMod: 0,
  numDice: 10,
  ...over,
  modifiers: {
    ...defaultWeaponModifiers(),
    aimed: mods.aimed ?? false,
    woundingHits: mods.woundingHits ?? false,
    bypassingWounds: mods.bypassingWounds ?? false,
    exploding: mods.exploding ?? false,
    explodingX: mods.explodingX ?? 1,
    hitReroll: mods.hitReroll ?? "none",
    woundReroll: mods.woundReroll ?? "none",
  },
});

const target = (
  over: Partial<Omit<TargetProfile, "modifiers">> = {},
  mods: Partial<Modifiers> = {},
): TargetProfile => ({
  name: "T",
  toughness: 4,
  armour: 4,
  unmodifiable: null,
  ...over,
  modifiers: {
    ...defaultTargetModifiers(),
    minusOneHit: mods.minusOneHit ?? false,
    fnp: mods.fnp ?? null,
  },
});

const approx = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("woundTarget", () => {
  it("S>=2T → 2+", () => expect(woundTarget(8, 4)).toBe(2));
  it("S>T → 3+", () => expect(woundTarget(5, 4)).toBe(3));
  it("S=T → 4+", () => expect(woundTarget(4, 4)).toBe(4));
  it("S<T → 5+", () => expect(woundTarget(3, 4)).toBe(5));
  it("S*2<=T → 6+", () => expect(woundTarget(4, 8)).toBe(6));
});

describe("hit cap", () => {
  it("+1 to hit on a 2+ stays at 2+", () => {
    const m = { ...baseMods(), aimed: true };
    expect(effectiveHitTarget(2, m)).toBe(2);
  });
  it("modifier net capped at ±1 (both flags cancel)", () => {
    const m = { ...baseMods(), aimed: true, minusOneHit: true };
    expect(effectiveHitTarget(3, m)).toBe(3);
  });
});

describe("base expected hits", () => {
  it("10 dice 3+ no mods → 6.667 hits", () => {
    const r = computeHitStage(weapon(), baseMods());
    approx(r.result.total, 10 * (4 / 6));
  });
});

describe("re-rolls", () => {
  it("re-roll 1s on hits, 6 dice, 3+ → 7/9 prob → ~4.667", () => {
    const w = weapon({ numDice: 6 }, { hitReroll: "ones" });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    approx(r.result.total, 6 * ((4 / 6) * (7 / 6)));
  });
  it("re-roll misses on hits, 6 dice, 3+ → 8/9 prob → ~5.333", () => {
    const w = weapon({ numDice: 6 }, { hitReroll: "misses" });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    approx(r.result.total, 6 * (4 / 6 + (2 / 6) * (4 / 6)));
  });
  it("p6 scales under re-roll misses", () => {
    expect(applyReroll(1 / 6, 2 / 6, "misses")).toBeCloseTo(1 / 6 + (2 / 6) * (1 / 6));
  });
});

describe("exploding × wounding hits interaction", () => {
  it("N=6 t=3+, X=1, both on: 3 normal hits to wound + 1 extra + 1 auto-wound", () => {
    const w = weapon({ numDice: 6 }, { woundingHits: true, exploding: true, explodingX: 1 });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    approx(r.hitsToWound, 4);
    approx(r.autoWounds, 1);
  });
});

describe("effective save", () => {
  it("Sv 3 + AP-2 vs invuln 4 → effective 4+", () => {
    const w = weapon({ armourMod: 2 });
    const t = target({ armour: 3, unmodifiable: 4 });
    expect(effectiveSave(w, t)).toBe(4);
  });
});

describe("computeAll integration", () => {
  it("bypass wounds skip armour and invulnerable", () => {
    const out = computeAll(
      weapon({ numDice: 6, toHit: 4, strength: 4 }, { bypassingWounds: true }),
      target({ armour: 2, unmodifiable: 2 }),
    );
    approx(out.finalDamage, 1 / 6 + 0.5);
  });

  it("FNP 5+ on 6 unsaved → expected damage", () => {
    const out = computeAll(
      weapon({ numDice: 6, toHit: 2, strength: 8 }),
      target({ toughness: 4, armour: 7, unmodifiable: null }, { fnp: 5 }),
    );
    const expectedHits = 6 * (5 / 6);
    const expectedWounds = expectedHits * (5 / 6);
    const expectedDamage = expectedWounds * (1 - 2 / 6);
    approx(out.finalDamage, expectedDamage);
  });

  it("FNP applies to bypass wounds", () => {
    const out = computeAll(
      weapon({ numDice: 6, toHit: 2, strength: 8 }, { bypassingWounds: true }),
      target({ toughness: 4, armour: 2, unmodifiable: 2 }, { fnp: 6 }),
    );
    const hits = 6 * (5 / 6);
    const wounds = hits * (5 / 6);
    const bypass = hits * (1 / 6);
    const wts = wounds - bypass;
    const unsaved = wts * (1 / 6) + bypass;
    const damage = unsaved * (1 - 1 / 6);
    approx(out.finalDamage, damage);
  });
});
