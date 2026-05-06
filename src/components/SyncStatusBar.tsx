import type { SyncStatus } from "../types";

type Props = {
  status: SyncStatus;
  error: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onSyncNow: () => void;
};

const LABELS: Record<SyncStatus, string> = {
  "not-signed-in": "Not signed in",
  idle: "Idle",
  syncing: "Syncing…",
  synced: "Synced",
  error: "Error",
};

export function SyncStatusBar({ status, error, onSignIn, onSignOut, onSyncNow }: Props) {
  return (
    <div className={`sync-bar status-${status}`}>
      <span className="sync-label">
        <span className={`sync-dot status-${status}`} aria-hidden />
        {LABELS[status]}
        {status === "error" && error && <span className="sync-error">: {error}</span>}
      </span>
      <div className="sync-actions">
        {status === "not-signed-in" ? (
          <button type="button" onClick={onSignIn}>
            Sign in to Drive
          </button>
        ) : (
          <>
            <button type="button" onClick={onSyncNow} disabled={status === "syncing"}>
              Sync now
            </button>
            <button type="button" className="link" onClick={onSignOut}>
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
