import { googleAuth } from "./googleAuth";
import {
  DriveHttpError,
  downloadSyncFile,
  findSyncFile,
  uploadSyncFile,
} from "./googleDrive";
import { mergePresetMap, mergeScenarios } from "./mergeEngine";
import type { Scenario, SyncEnvelope, SyncStatus, TargetPreset, WeaponPreset } from "../types";

export type LocalState = {
  scenarios: Scenario[];
  weaponPresets: Record<string, WeaponPreset>;
  targetPresets: Record<string, TargetPreset>;
  activeScenarioId: string | null;
};

type Listeners = {
  onStatusChange: (s: SyncStatus, error: string | null) => void;
  onMerged: (state: LocalState) => void;
  getState: () => LocalState;
};

const DEBOUNCE_MS = 2000;
const MAX_RETRIES = 3;

export class SyncService {
  private status: SyncStatus = "not-signed-in";
  private error: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private listeners: Listeners;

  constructor(listeners: Listeners) {
    this.listeners = listeners;
  }

  async initialize(): Promise<void> {
    if (googleAuth.hasPreviousSession()) {
      const tok = await googleAuth.trySilentSignIn();
      if (tok) {
        this.setStatus("idle");
        await this.syncNow();
        return;
      }
      // Previous session, but silent sign-in didn't return a token —
      // mark idle so a manual sync will prompt.
      this.setStatus("idle");
    } else {
      this.setStatus("not-signed-in");
    }
  }

  async signIn(): Promise<boolean> {
    const tok = await googleAuth.signIn();
    if (!tok) return false;
    this.setStatus("idle");
    await this.syncNow();
    return true;
  }

  signOut(): void {
    googleAuth.signOut();
    this.setStatus("not-signed-in");
  }

  /** Schedule a debounced sync after a local change. */
  scheduleSync(): void {
    if (this.status === "not-signed-in") return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.syncNow();
    }, DEBOUNCE_MS);
  }

  async syncNow(): Promise<void> {
    if (this.inFlight) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!googleAuth.isSignedIn()) {
      if (googleAuth.hasPreviousSession()) {
        const tok = await googleAuth.signIn();
        if (!tok) {
          this.setStatus("not-signed-in");
          return;
        }
      } else {
        this.setStatus("not-signed-in");
        return;
      }
    }

    this.inFlight = true;
    this.error = null;
    this.setStatus("syncing");

    try {
      await this.runWithRetry();
      this.setStatus("synced");
    } catch (err) {
      const e = err as Error;
      // Network failures (no status code) — silent revert
      if (err instanceof DriveHttpError && err.status === 401) {
        this.setStatus("not-signed-in");
      } else if (err instanceof TypeError) {
        // fetch network failure — keep previous state
        this.setStatus("idle");
      } else {
        this.error = e.message;
        this.setStatus("error");
      }
    } finally {
      this.inFlight = false;
    }
  }

  private async runWithRetry(): Promise<void> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await this.performSync();
        return;
      } catch (err) {
        if (err instanceof DriveHttpError && err.status === 412 && attempt < MAX_RETRIES - 1) {
          continue;
        }
        if (err instanceof DriveHttpError && err.status === 401 && attempt < MAX_RETRIES - 1) {
          const tok = await googleAuth.signIn();
          if (!tok) throw err;
          continue;
        }
        throw err;
      }
    }
  }

  private async performSync(): Promise<void> {
    const local = this.listeners.getState();
    const existing = await findSyncFile();
    const remote: SyncEnvelope | null = existing ? await downloadSyncFile(existing.id) : null;

    const remoteScenarios = remote?.scenarios ?? [];
    const remoteWeapons = remote?.weaponPresets ?? {};
    const remoteTargets = remote?.targetPresets ?? {};

    const sc = mergeScenarios(local.scenarios, remoteScenarios);
    const wp = mergePresetMap(local.weaponPresets, remoteWeapons);
    const tp = mergePresetMap(local.targetPresets, remoteTargets);

    const localChanged = sc.localChanged || wp.localChanged || tp.localChanged;
    const remoteChanged = sc.remoteChanged || wp.remoteChanged || tp.remoteChanged;

    // Active scenario id: prefer remote if its referenced scenario exists in merged set.
    let activeScenarioId = local.activeScenarioId;
    if (
      remote?.activeScenarioId &&
      sc.merged.find((s) => s.id === remote.activeScenarioId && !s.isDeleted)
    ) {
      if (activeScenarioId !== remote.activeScenarioId) {
        activeScenarioId = remote.activeScenarioId;
      }
    }

    if (localChanged || activeScenarioId !== local.activeScenarioId) {
      this.listeners.onMerged({
        scenarios: sc.merged,
        weaponPresets: wp.merged,
        targetPresets: tp.merged,
        activeScenarioId,
      });
    }

    if (remoteChanged || !existing) {
      const envelope: SyncEnvelope = {
        version: 1,
        lastSyncedUtc: new Date().toISOString(),
        scenarios: sc.merged,
        weaponPresets: wp.merged,
        targetPresets: tp.merged,
        activeScenarioId,
      };
      await uploadSyncFile(envelope, existing);
    }
  }

  private setStatus(s: SyncStatus): void {
    this.status = s;
    this.listeners.onStatusChange(s, this.error);
  }

  getStatus(): SyncStatus {
    return this.status;
  }
}
