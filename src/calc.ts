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
  autoHit: false,
  hitsOnSixes: false,
  rapidFire: false,
  rapidFireX: 1,
  woundingHits: null,
  bypassingWounds: false,
  exploding: false,
  explodingX: 1,
  hitReroll: "none",
  woundReroll: "none",
  antiWound: null,
  antiKeyword: null,
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
  // Torrent-style auto-hit needs no roll; hits-on-6s ignores To-Hit and modifiers.
  if (mods.autoHit) return 2;
  if (mods.hitsOnSixes) return 6;
  const net = clamp((mods.aimed ? -1 : 0) + (mods.minusOneHit ? 1 : 0), -1, 1);
  return Math.max(2, toHit + net);
}

export function rawHitProbability(toHit: number, mods: Modifiers): number {
  if (mods.autoHit) return 1;
  const tEff = effectiveHitTarget(toHit, mods);
  return clamp((7 - tEff) / 6, 1 / 6, 5 / 6);
}

/** Rapid Fire X multiplies the shot count: X=1 doubles, X=2 triples, etc. */
export function effectiveNumDice(weapon: WeaponProfile, mods: Modifiers): number {
  return mods.rapidFire ? weapon.numDice * (1 + mods.rapidFireX) : weapon.numDice;
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
  const N = effectiveNumDice(weapon, mods);
  const tEff = effectiveHitTarget(weapon.toHit, mods);
  const pHitRaw = rawHitProbability(weapon.toHit, mods);
  const missRaw = 1 - pHitRaw;

  // Auto-hit: no dice are rolled, so re-rolls, exploding 6s, and crit (auto-wound
  // on a nat roll) effects have nothing to trigger on — every die is simply a hit.
  if (mods.autoHit) {
    return {
      result: {
        stage: "hit",
        diceIn: N,
        needed: "Auto",
        rollProbability: 1,
        contributions: [{ label: "Automatic hits", value: N }],
        total: N,
      },
      hitsToWound: N,
      autoWounds: 0,
    };
  }

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
  // Anti-* only applies when the weapon's keyword matches the target's unit type.
  const w =
    mods.antiWound !== null &&
    mods.antiKeyword !== null &&
    mods.antiKeyword === target.unitType
      ? Math.min(baseW, mods.antiWound)
      : baseW;
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

function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let c = 1;
  for (let i = 1; i <= k; i++) {
    c = (c * (n - i + 1)) / i;
  }
  return c;
}

export function computeFnpStage(
  fnp: number,
  finalUnsaved: number,
  damage: number,
  wounds: number,
): StageResult {
  const pFnp = clamp((7 - fnp) / 6, 0, 5 / 6);
  const pFail = 1 - pFnp;
  
  // FNP is rolled per point of damage, not per wound.
  const totalDamage = finalUnsaved * damage;
  
  const calcForInt = (d: number) => {
    let expected = 0;
    for (let k = 0; k <= d; k++) {
      const prob = binomialCoefficient(d, k) * Math.pow(pFail, k) * Math.pow(pFnp, d - k);
      expected += Math.min(k, wounds) * prob;
    }
    return expected;
  };

  const dFloor = Math.floor(damage);
  const dCeil = Math.ceil(damage);
  let effDmgPerSave = 0;
  if (dFloor === dCeil) {
    effDmgPerSave = calcForInt(dFloor);
  } else {
    effDmgPerSave = calcForInt(dFloor) * (1 - (damage - dFloor)) + calcForInt(dCeil) * (damage - dFloor);
  }

  const effectiveTaken = finalUnsaved * effDmgPerSave;
  const rawTaken = totalDamage * pFail;
  const lost = rawTaken - effectiveTaken;

  const contributions: { label: string; value: number }[] = [
    { label: "Damage ignored by FNP", value: totalDamage * pFnp },
  ];
  if (lost > 0.001) {
    contributions.push({ label: "Damage lost to rollover cap", value: lost });
  }
  contributions.push({ label: "Effective damage taken", value: effectiveTaken });

  return {
    stage: "fnp",
    diceIn: totalDamage,
    needed: fmtNeed(fnp),
    rollProbability: pFnp,
    contributions,
    total: effectiveTaken,
  };
}

/**
 * Returns true when the weapon fires a single shot (numDice=1, no Rapid Fire, no exploding 6s),
 * deals more than 1 damage per unsaved wound, and there is no FNP active.
 * In this case the outcome is binary (full damage or nothing), so displaying
 * "X (Y%)" is more informative than the expected-value average.
 */
export function isSingleShotMultiDamage(weapon: WeaponProfile, computation: Computation): boolean {
  return (
    weapon.numDice === 1 &&
    !weapon.modifiers.rapidFire &&
    !weapon.modifiers.exploding &&
    weapon.damage > 1 &&
    computation.fnp === null
  );
}

/**
 * Formats the "Total damage" summary value.
 * For single-shot multi-damage weapons (no FNP), shows "X (Y%)" where
 * Y% is the probability the single die results in an unsaved wound.
 * Otherwise returns the expected-value average as a two-decimal string.
 */
export function fmtDamageResult(weapon: WeaponProfile, computation: Computation): string {
  if (isSingleShotMultiDamage(weapon, computation)) {
    return `${weapon.damage} (${(computation.save.total * 100).toFixed(1)}%)`;
  }
  return computation.finalDamage.toFixed(2);
}

export function computeAll(weapon: WeaponProfile, target: TargetProfile): Computation {
  const mods = combineModifiers(weapon.modifiers, target.modifiers);
  const hit = computeHitStage(weapon, mods);
  const wound = computeWoundStage(weapon, target, mods, hit.hitsToWound, hit.autoWounds);
  const save = computeSaveStage(weapon, target, wound.woundsToSave, wound.bypassWounds);
  const fnp =
    mods.fnp !== null ? computeFnpStage(mods.fnp, save.finalUnsaved, weapon.damage, target.wounds) : null;
  // Pooled damage: total damage carried over into the target's wounds pool.
  const effectiveDamagePerAttack = Math.min(weapon.damage, target.wounds);
  const finalDamage = fnp ? fnp.total : save.finalUnsaved * effectiveDamagePerAttack;
  const modelsDestroyed = target.wounds > 0 ? finalDamage / target.wounds : 0;
  return {
    hit: hit.result,
    wound: wound.result,
    save: save.result,
    fnp,
    finalDamage,
    modelsDestroyed,
  };
}
