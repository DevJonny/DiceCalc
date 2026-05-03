import { defaultTargetModifiers, defaultWeaponModifiers } from "./calc";
import type { Scenario, TargetProfile, WeaponProfile } from "./types";

const KEY_SCENARIOS = "dicecalc.v1.scenarios";
const KEY_ACTIVE = "dicecalc.v1.activeId";
const KEY_PRESETS_WEAPON = "dicecalc.v1.presets.weapon";
const KEY_PRESETS_TARGET = "dicecalc.v1.presets.target";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

function migrateWeapon(w: any, legacyMods?: any): WeaponProfile {
  const src = { ...(legacyMods ?? {}), ...(w?.modifiers ?? {}) };
  return {
    name: w?.name ?? "Weapon",
    toHit: w?.toHit ?? 3,
    strength: w?.strength ?? 4,
    armourMod: w?.armourMod ?? 0,
    numDice: w?.numDice ?? 10,
    modifiers: {
      ...defaultWeaponModifiers(),
      aimed: src.aimed ?? false,
      woundingHits: src.woundingHits ?? false,
      bypassingWounds: src.bypassingWounds ?? false,
      exploding: src.exploding ?? false,
      explodingX: src.explodingX ?? 1,
      hitReroll: src.hitReroll ?? "none",
      woundReroll: src.woundReroll ?? "none",
    },
  };
}

function migrateTarget(t: any, legacyMods?: any): TargetProfile {
  const src = { ...(legacyMods ?? {}), ...(t?.modifiers ?? {}) };
  return {
    name: t?.name ?? "Target",
    toughness: t?.toughness ?? 4,
    armour: t?.armour ?? 4,
    unmodifiable: t?.unmodifiable ?? null,
    modifiers: {
      ...defaultTargetModifiers(),
      minusOneHit: src.minusOneHit ?? false,
      fnp: src.fnp ?? null,
    },
  };
}

function migrateScenario(s: any): Scenario {
  // Legacy data stored modifiers at scenario level OR all together on weapon.
  const legacy = s?.modifiers ?? s?.weapon?.modifiers;
  return {
    id: s?.id ?? Math.random().toString(36).slice(2, 9),
    name: s?.name ?? "Scenario",
    weapon: migrateWeapon(s?.weapon, legacy),
    target: migrateTarget(s?.target, legacy),
  };
}

export const loadScenarios = (): Scenario[] =>
  read<unknown[]>(KEY_SCENARIOS, []).map(migrateScenario);
export const saveScenarios = (s: Scenario[]) => write(KEY_SCENARIOS, s);

export const loadActiveId = (): string | null => read<string | null>(KEY_ACTIVE, null);
export const saveActiveId = (id: string) => write(KEY_ACTIVE, id);

type PresetMap<T> = Record<string, T>;

export const loadWeaponPresets = (): PresetMap<WeaponProfile> => {
  const raw = read<Record<string, unknown>>(KEY_PRESETS_WEAPON, {});
  const out: PresetMap<WeaponProfile> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = migrateWeapon(v);
  return out;
};
export const saveWeaponPresets = (m: PresetMap<WeaponProfile>) => write(KEY_PRESETS_WEAPON, m);

export const loadTargetPresets = (): PresetMap<TargetProfile> => {
  const raw = read<Record<string, unknown>>(KEY_PRESETS_TARGET, {});
  const out: PresetMap<TargetProfile> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = migrateTarget(v);
  return out;
};
export const saveTargetPresets = (m: PresetMap<TargetProfile>) => write(KEY_PRESETS_TARGET, m);
