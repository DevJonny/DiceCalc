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
  damage: 1,
  ...over,
  modifiers: {
    ...defaultWeaponModifiers(),
    aimed: mods.aimed ?? false,
    autoHit: mods.autoHit ?? false,
    hitsOnSixes: mods.hitsOnSixes ?? false,
    rapidFire: mods.rapidFire ?? false,
    rapidFireX: mods.rapidFireX ?? 1,
    woundingHits: mods.woundingHits ?? null,
    bypassingWounds: mods.bypassingWounds ?? false,
    exploding: mods.exploding ?? false,
    explodingX: mods.explodingX ?? 1,
    hitReroll: mods.hitReroll ?? "none",
    woundReroll: mods.woundReroll ?? "none",
    antiWound: mods.antiWound ?? null,
    antiKeyword: mods.antiKeyword ?? null,
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
  unitType: null,
  wounds: 1,
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
    const w = weapon({ numDice: 6 }, { woundingHits: 6, exploding: true, explodingX: 1 });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    approx(r.hitsToWound, 4);
    approx(r.autoWounds, 1);
  });
  it("Auto-wound on 5+ sends nat 5s and 6s straight to auto-wounds", () => {
    const w = weapon({ numDice: 6 }, { woundingHits: 5 });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    approx(r.autoWounds, 6 * (2 / 6));
    approx(r.hitsToWound, 6 * (4 / 6) - 6 * (2 / 6));
  });
});

describe("auto-hit", () => {
  it("every die hits regardless of To-Hit, ignoring re-rolls and exploding", () => {
    const w = weapon({ numDice: 10, toHit: 5 }, { autoHit: true, hitReroll: "misses", exploding: true });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    expect(r.result.needed).toBe("Auto");
    approx(r.result.total, 10);
    approx(r.hitsToWound, 10);
    approx(r.autoWounds, 0);
  });
});

describe("hits on 6s only", () => {
  it("fixed 1/6 hit chance, ignoring To-Hit and +1 to hit", () => {
    const w = weapon({ numDice: 6, toHit: 2 }, { hitsOnSixes: true, aimed: true });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    expect(r.result.needed).toBe("6+");
    approx(r.result.total, 6 * (1 / 6));
  });
  it("exploding 6s still layer onto the natural 6s", () => {
    const w = weapon({ numDice: 6 }, { hitsOnSixes: true, exploding: true, explodingX: 1 });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    // 1 hit on the 6s + 1 exploding extra
    approx(r.hitsToWound, 2);
    approx(r.autoWounds, 0);
  });
  it("auto-wound on 6 sends every 6-hit straight to auto-wounds", () => {
    const w = weapon({ numDice: 6 }, { hitsOnSixes: true, woundingHits: 6 });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    approx(r.autoWounds, 1);
    approx(r.hitsToWound, 0);
  });
});

describe("rapid fire", () => {
  it("X=1 doubles the dice count", () => {
    const w = weapon({ numDice: 5, toHit: 3 }, { rapidFire: true, rapidFireX: 1 });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    approx(r.result.diceIn, 10);
    approx(r.result.total, 10 * (4 / 6));
  });
  it("X=2 triples the dice count", () => {
    const w = weapon({ numDice: 5, toHit: 3 }, { rapidFire: true, rapidFireX: 2 });
    const r = computeHitStage(w, combineModifiers(w.modifiers, defaultTargetModifiers()));
    approx(r.result.diceIn, 15);
    approx(r.result.total, 15 * (4 / 6));
  });
});

describe("anti-wound (keyword-gated, complementary)", () => {
  it("Anti-Infantry 4+ improves a 6+ wound to 4+ when target is Infantry", () => {
    const out = computeAll(
      weapon({ numDice: 6, toHit: 2, strength: 2 }, { antiWound: 4, antiKeyword: "Infantry" }),
      target({ toughness: 8, armour: 7, unmodifiable: null, unitType: "Infantry" }),
    );
    const hits = 6 * (5 / 6);
    const wounds = hits * (3 / 6);
    approx(out.finalDamage, wounds);
  });
  it("Anti-* 4+ does not worsen a 3+ wound", () => {
    const out = computeAll(
      weapon({ numDice: 6, toHit: 2, strength: 8 }, { antiWound: 4, antiKeyword: "Infantry" }),
      target({ toughness: 4, armour: 7, unmodifiable: null, unitType: "Infantry" }),
    );
    const hits = 6 * (5 / 6);
    const wounds = hits * (5 / 6);
    approx(out.finalDamage, wounds);
  });
  it("Anti-* 2+ improves a 6+ wound to 2+ on a keyword match", () => {
    const out = computeAll(
      weapon({ numDice: 6, toHit: 2, strength: 2 }, { antiWound: 2, antiKeyword: "Vehicle" }),
      target({ toughness: 8, armour: 7, unmodifiable: null, unitType: "Vehicle" }),
    );
    const hits = 6 * (5 / 6);
    const wounds = hits * (5 / 6);
    approx(out.finalDamage, wounds);
  });
  it("Anti-Infantry does NOT apply against a Vehicle target", () => {
    const out = computeAll(
      weapon({ numDice: 6, toHit: 2, strength: 2 }, { antiWound: 2, antiKeyword: "Infantry" }),
      target({ toughness: 8, armour: 7, unmodifiable: null, unitType: "Vehicle" }),
    );
    const hits = 6 * (5 / 6);
    const wounds = hits * (1 / 6); // falls back to the 6+ S-vs-T roll
    approx(out.finalDamage, wounds);
  });
  it("Anti-* does NOT apply when the target has no unit type", () => {
    const out = computeAll(
      weapon({ numDice: 6, toHit: 2, strength: 2 }, { antiWound: 2, antiKeyword: "Infantry" }),
      target({ toughness: 8, armour: 7, unmodifiable: null, unitType: null }),
    );
    const hits = 6 * (5 / 6);
    const wounds = hits * (1 / 6);
    approx(out.finalDamage, wounds);
  });
});

describe("damage & models destroyed", () => {
  it("pooled damage divides total damage by target wounds", () => {
    const out = computeAll(
      weapon({ numDice: 6, toHit: 2, strength: 8, damage: 3 }),
      target({ toughness: 4, armour: 7, unmodifiable: null, wounds: 2 }),
    );
    const hits = 6 * (5 / 6);
    const wounds = hits * (5 / 6); // S8 vs T4 -> 2+
    const totalDamage = wounds * 2; // Sv7 always fails, D3 capped at W2 -> 2
    approx(out.finalDamage, totalDamage);
    approx(out.modelsDestroyed, totalDamage / 2);
  });
  it("FNP is applied per damage point before pooling", () => {
    const out = computeAll(
      weapon({ numDice: 6, toHit: 2, strength: 8, damage: 2 }),
      target({ toughness: 4, armour: 7, unmodifiable: null, wounds: 3 }, { fnp: 5 }),
    );
    const hits = 6 * (5 / 6);
    const wounds = hits * (5 / 6);
    const totalDamage = wounds * 2 * (1 - 2 / 6);
    approx(out.finalDamage, totalDamage);
    approx(out.modelsDestroyed, totalDamage / 3);
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
