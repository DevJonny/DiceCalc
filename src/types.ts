export type RerollMode = "none" | "ones" | "misses";

export type WeaponModifiers = {
  aimed: boolean;
  woundingHits: boolean;
  bypassingWounds: boolean;
  exploding: boolean;
  explodingX: number;
  hitReroll: RerollMode;
  woundReroll: RerollMode;
};

export type TargetModifiers = {
  minusOneHit: boolean;
  fnp: number | null;
};

/** Combined view used by the math layer. */
export type Modifiers = WeaponModifiers & TargetModifiers;

export type WeaponProfile = {
  name: string;
  toHit: number;
  strength: number;
  armourMod: number;
  numDice: number;
  modifiers: WeaponModifiers;
};

export type TargetProfile = {
  name: string;
  toughness: number;
  armour: number;
  unmodifiable: number | null;
  modifiers: TargetModifiers;
};

export type SyncMeta = {
  lastModified: string;
  isDeleted?: boolean;
};

export type Scenario = {
  id: string;
  name: string;
  weapon: WeaponProfile;
  target: TargetProfile;
} & SyncMeta;

export type WeaponPreset = { profile: WeaponProfile } & SyncMeta;
export type TargetPreset = { profile: TargetProfile } & SyncMeta;

export type SyncEnvelope = {
  version: 1;
  lastSyncedUtc: string;
  scenarios: Scenario[];
  weaponPresets: Record<string, WeaponPreset>;
  targetPresets: Record<string, TargetPreset>;
  activeScenarioId: string | null;
};

export type SyncStatus =
  | "not-signed-in"
  | "idle"
  | "syncing"
  | "synced"
  | "error";

export type StageRow = {
  label: string;
  value: number;
};

export type StageResult = {
  stage: "hit" | "wound" | "save" | "fnp";
  diceIn: number;
  needed: string;
  rollProbability: number;
  contributions: StageRow[];
  total: number;
};

export type Computation = {
  hit: StageResult;
  wound: StageResult;
  save: StageResult;
  fnp: StageResult | null;
  finalDamage: number;
};
