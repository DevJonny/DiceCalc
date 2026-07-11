import type {
  Computation,
  Modifiers,
  RerollMode,
  StageResult,
  TargetModifiers,
  TargetProfile,
  WeaponModifiers,
  WeaponProfile,
} from "./types";

export const defaultWeaponModifiers = (): WeaponModifiers => ({
  aimed: false,
  woundingHits: null,
  bypassingWounds: false,
  exploding: false,
  explodingX: 1,
  hitReroll: "none",
  woundReroll: "none",
  antiWound: null,
});

export const defaultTargetModifiers = (): TargetModifiers => ({
  minusOneHit: false,
  fnp: null,
});

export const combineModifiers = (
  w: WeaponModifiers,
  t: TargetModifiers,
): Modifiers => ({ ...w, ...t });

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function woundTarget(strength: number, toughness: number): number {
  if (strength >= 2 * toughness) return 2;
  if (strength > toughness) return 3;
  if (strength === toughness) return 4;
  if (strength * 2 <= toughness) return 6;
  return 5;
}

export function effectiveHitTarget(toHit: number, mods: Modifiers): number {
  const net = clamp((mods.aimed ? -1 : 0) + (mods.minusOneHit ? 1 : 0), -1, 1);
  return Math.max(2, toHit + net);
}

export function rawHitProbability(toHit: number, mods: Modifiers): number {
  const tEff = effectiveHitTarget(toHit, mods);
  return clamp((7 - tEff) / 6, 1 / 6, 5 / 6);
}

export function applyReroll(p: number, missProb: number, mode: RerollMode): number {
  switch (mode) {
    case "none":
      return p;
    case "ones":
      return p + (1 / 6) * p;
    case "misses":
      return p + missProb * p;
  }
}

function fmtNeed(n: number): string {
  if (n <= 1) return "2+";
  if (n > 6) return "7+";
  return `${n}+`;
}

export function computeHitStage(
  weapon: WeaponProfile,
  mods: Modifiers,
): { result: StageResult; hitsToWound: number; autoWounds: number } {
  const N = weapon.numDice;
  const tEff = effectiveHitTarget(weapon.toHit, mods);
  const pHitRaw = rawHitProbability(weapon.toHit, mods);
  const missRaw = 1 - pHitRaw;
  const pHit = applyReroll(pHitRaw, missRaw, mods.hitReroll);
  const p6 = applyReroll(1 / 6, missRaw, mods.hitReroll);

  const baseHits = N * pHit;
  const explodingExtras = mods.exploding ? N * p6 * mods.explodingX : 0;
  const pCrit =
    mods.woundingHits !== null
      ? applyReroll((7 - mods.woundingHits) / 6, missRaw, mods.hitReroll)
      : 0;
  const autoWounds = mods.woundingHits !== null ? Math.min(N * pCrit, baseHits) : 0;
  const hitsToWound = baseHits - autoWounds + explodingExtras;

  const contributions = [{ label: "Successful hits", value: baseHits }];
  if (mods.exploding) {
    contributions.push({ label: `Exploding 6s (×${mods.explodingX})`, value: explodingExtras });
  }
  if (mods.woundingHits !== null) {
    contributions.push({
      label: `→ Auto-wounds on ${mods.woundingHits}+ (skip wound roll)`,
      value: -autoWounds,
    });
  }

  const total = hitsToWound + autoWounds;

  return {
    result: {
      stage: "hit",
      diceIn: N,
      needed: fmtNeed(tEff),
      rollProbability: pHit,
      contributions,
      total,
    },
    hitsToWound,
    autoWounds,
  };
}

export function computeWoundStage(
  weapon: WeaponProfile,
  target: TargetProfile,
  mods: Modifiers,
  hitsToWound: number,
  autoWounds: number,
): { result: StageResult; woundsToSave: number; bypassWounds: number } {
  const baseW = woundTarget(weapon.strength, target.toughness);
  const w = mods.antiWound !== null ? Math.min(baseW, mods.antiWound) : baseW;
  const pWoundRaw = clamp((7 - w) / 6, 1 / 6, 5 / 6);
  const missRaw = 1 - pWoundRaw;
  const pWound = applyReroll(pWoundRaw, missRaw, mods.woundReroll);
  const p6w = applyReroll(1 / 6, missRaw, mods.woundReroll);

  const woundsTotal = hitsToWound * pWound;
  const bypassWounds = mods.bypassingWounds ? hitsToWound * p6w : 0;
  const woundsToSave = woundsTotal - bypassWounds + autoWounds;

  const contributions: { label: string; value: number }[] = [
    { label: "Successful wounds", value: woundsTotal },
  ];
  if (autoWounds > 0) {
    contributions.push({ label: "Auto-wounds carried in", value: autoWounds });
  }
  if (mods.bypassingWounds) {
    contributions.push({ label: "→ Bypass save (nat 6)", value: -bypassWounds });
  }

  return {
    result: {
      stage: "wound",
      diceIn: hitsToWound,
      needed: fmtNeed(w),
      rollProbability: pWound,
      contributions,
      total: woundsToSave + bypassWounds,
    },
    woundsToSave,
    bypassWounds,
  };
}

export function effectiveSave(weapon: WeaponProfile, target: TargetProfile): number {
  const modSave = target.armour + weapon.armourMod;
  if (target.unmodifiable !== null) return Math.min(modSave, target.unmodifiable);
  return modSave;
}

export function computeSaveStage(
  weapon: WeaponProfile,
  target: TargetProfile,
  woundsToSave: number,
  bypassWounds: number,
): { result: StageResult; finalUnsaved: number } {
  const saveEff = effectiveSave(weapon, target);
  const pFail = clamp((saveEff - 1) / 6, 1 / 6, 1);
  const unsavedFromNormal = woundsToSave * pFail;
  const finalUnsaved = unsavedFromNormal + bypassWounds;

  const contributions: { label: string; value: number }[] = [
    { label: "Failed saves", value: unsavedFromNormal },
  ];
  if (bypassWounds > 0) {
    contributions.push({ label: "Bypass wounds (skip save)", value: bypassWounds });
  }

  return {
    result: {
      stage: "save",
      diceIn: woundsToSave,
      needed: fmtNeed(saveEff),
      rollProbability: 1 - pFail,
      contributions,
      total: finalUnsaved,
    },
    finalUnsaved,
  };
}

export function computeFnpStage(fnp: number, finalUnsaved: number): StageResult {
  const pFnp = clamp((7 - fnp) / 6, 0, 5 / 6);
  const damage = finalUnsaved * (1 - pFnp);
  return {
    stage: "fnp",
    diceIn: finalUnsaved,
    needed: fmtNeed(fnp),
    rollProbability: pFnp,
    contributions: [
      { label: "Wounds ignored", value: finalUnsaved * pFnp },
      { label: "Damage taken", value: damage },
    ],
    total: damage,
  };
}

export function computeAll(weapon: WeaponProfile, target: TargetProfile): Computation {
  const mods = combineModifiers(weapon.modifiers, target.modifiers);
  const hit = computeHitStage(weapon, mods);
  const wound = computeWoundStage(weapon, target, mods, hit.hitsToWound, hit.autoWounds);
  const save = computeSaveStage(weapon, target, wound.woundsToSave, wound.bypassWounds);
  const fnp = mods.fnp !== null ? computeFnpStage(mods.fnp, save.finalUnsaved) : null;
  return {
    hit: hit.result,
    wound: wound.result,
    save: save.result,
    fnp,
    finalDamage: fnp ? fnp.total : save.finalUnsaved,
  };
}
