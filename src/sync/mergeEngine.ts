import type { Scenario, SyncMeta, TargetPreset, WeaponPreset } from "../types";

const TOMBSTONE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type MergeResult<T> = {
  merged: T;
  localChanged: boolean;
  remoteChanged: boolean;
};

const isNewer = (a: SyncMeta, b: SyncMeta) => Date.parse(a.lastModified) > Date.parse(b.lastModified);

function pickByMeta<T extends SyncMeta>(
  local: T | undefined,
  remote: T | undefined,
): { winner: T; localChanged: boolean; remoteChanged: boolean } {
  if (local && remote) {
    if (isNewer(local, remote)) return { winner: local, localChanged: false, remoteChanged: true };
    if (isNewer(remote, local)) return { winner: remote, localChanged: true, remoteChanged: false };
    return { winner: local, localChanged: false, remoteChanged: false };
  }
  if (local) return { winner: local, localChanged: false, remoteChanged: true };
  return { winner: remote!, localChanged: true, remoteChanged: false };
}

export function mergeScenarios(
  local: Scenario[],
  remote: Scenario[],
): MergeResult<Scenario[]> {
  const localById = new Map(local.map((s) => [s.id, s]));
  const remoteById = new Map(remote.map((s) => [s.id, s]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);

  const merged: Scenario[] = [];
  let localChanged = false;
  let remoteChanged = false;

  for (const id of ids) {
    const r = pickByMeta(localById.get(id), remoteById.get(id));
    merged.push(r.winner);
    localChanged = localChanged || r.localChanged;
    remoteChanged = remoteChanged || r.remoteChanged;
  }

  // GC tombstones older than 90 days
  const cutoff = Date.now() - TOMBSTONE_MAX_AGE_MS;
  const filtered = merged.filter((s) => !(s.isDeleted && Date.parse(s.lastModified) < cutoff));
  if (filtered.length !== merged.length) {
    localChanged = true;
    remoteChanged = true;
  }

  return { merged: filtered, localChanged, remoteChanged };
}

export function mergePresetMap<P extends WeaponPreset | TargetPreset>(
  local: Record<string, P>,
  remote: Record<string, P>,
): MergeResult<Record<string, P>> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const merged: Record<string, P> = {};
  let localChanged = false;
  let remoteChanged = false;

  for (const k of keys) {
    const r = pickByMeta(local[k], remote[k]);
    merged[k] = r.winner;
    localChanged = localChanged || r.localChanged;
    remoteChanged = remoteChanged || r.remoteChanged;
  }

  // GC tombstones
  const cutoff = Date.now() - TOMBSTONE_MAX_AGE_MS;
  for (const [k, v] of Object.entries(merged)) {
    if (v.isDeleted && Date.parse(v.lastModified) < cutoff) {
      delete merged[k];
      localChanged = true;
      remoteChanged = true;
    }
  }

  return { merged, localChanged, remoteChanged };
}
