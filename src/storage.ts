import { defaultTargetModifiers, defaultWeaponModifiers } from "./calc";
import type {
  Scenario,
  TargetPreset,
  TargetProfile,
  WeaponPreset,
  WeaponProfile,
} from "./types";

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

export const now = (): string => new Date().toISOString();

function migrateWeaponProfile(w: any, legacyMods?: any): WeaponProfile {
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
      woundingHits:
        src.woundingHits === 5 || src.woundingHits === 6
          ? src.woundingHits
          : src.woundingHits === true
            ? 6
            : null,
      bypassingWounds: src.bypassingWounds ?? false,
      exploding: src.exploding ?? false,
      explodingX: src.explodingX ?? 1,
      hitReroll: src.hitReroll ?? "none",
      woundReroll: src.woundReroll ?? "none",
      antiWound:
        src.antiWound === 2 || src.antiWound === 3 || src.antiWound === 4 || src.antiWound === 5
          ? src.antiWound
          : null,
    },
  };
}

function migrateTargetProfile(t: any, legacyMods?: any): TargetProfile {
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
  const legacy = s?.modifiers ?? s?.weapon?.modifiers;
  return {
    id: s?.id ?? Math.random().toString(36).slice(2, 9),
    name: s?.name ?? "",
    weapon: migrateWeaponProfile(s?.weapon, legacy),
    target: migrateTargetProfile(s?.target, legacy),
    lastModified: s?.lastModified ?? now(),
    isDeleted: s?.isDeleted,
  };
}

export const loadScenarios = (): Scenario[] =>
  read<unknown[]>(KEY_SCENARIOS, []).map(migrateScenario);
export const saveScenarios = (s: Scenario[]) => write(KEY_SCENARIOS, s);

export const loadActiveId = (): string | null => read<string | null>(KEY_ACTIVE, null);
export const saveActiveId = (id: string) => write(KEY_ACTIVE, id);

function migrateWeaponPreset(v: any): WeaponPreset {
  // Legacy shape: WeaponProfile directly. New shape: { profile, lastModified, isDeleted? }.
  if (v && typeof v === "object" && "profile" in v && "lastModified" in v) {
    return {
      profile: migrateWeaponProfile(v.profile),
      lastModified: v.lastModified,
      isDeleted: v.isDeleted,
    };
  }
  return { profile: migrateWeaponProfile(v), lastModified: now() };
}

function migrateTargetPreset(v: any): TargetPreset {
  if (v && typeof v === "object" && "profile" in v && "lastModified" in v) {
    return {
      profile: migrateTargetProfile(v.profile),
      lastModified: v.lastModified,
      isDeleted: v.isDeleted,
    };
  }
  return { profile: migrateTargetProfile(v), lastModified: now() };
}

export const loadWeaponPresets = (): Record<string, WeaponPreset> => {
  const raw = read<Record<string, unknown>>(KEY_PRESETS_WEAPON, {});
  const out: Record<string, WeaponPreset> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = migrateWeaponPreset(v);
  return out;
};
export const saveWeaponPresets = (m: Record<string, WeaponPreset>) =>
  write(KEY_PRESETS_WEAPON, m);

export const loadTargetPresets = (): Record<string, TargetPreset> => {
  const raw = read<Record<string, unknown>>(KEY_PRESETS_TARGET, {});
  const out: Record<string, TargetPreset> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = migrateTargetPreset(v);
  return out;
};
export const saveTargetPresets = (m: Record<string, TargetPreset>) =>
  write(KEY_PRESETS_TARGET, m);
