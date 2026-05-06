// Ported from TurdTracker's google-auth.js — Google Identity Services token flow.
const CLIENT_ID = "101133685796-p43f4uqejgt9lgce4lvibrnoam8oegb1.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const PERSISTED_FLAG = "google-auth-connected";

type TokenResponse = { access_token?: string; error?: string };
type TokenClient = {
  callback: (resp: TokenResponse) => void;
  error_callback?: (err: { message?: string }) => void;
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;
let pending: Promise<string | null> | null = null;
let scriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

let initialized = false;
async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await loadGisScript();
  if (!window.google?.accounts) throw new Error("GIS not available");
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: () => {
      /* overridden per-request */
    },
  });
  initialized = true;
}

function requestToken(prompt: "" | "consent" | undefined): Promise<string | null> {
  if (pending) return pending;
  pending = new Promise<string | null>((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error("Google Auth not initialized"));
      return;
    }
    tokenClient.callback = (resp) => {
      pending = null;
      if (resp.error) {
        if (prompt === "") {
          resolve(null);
        } else {
          reject(new Error(resp.error));
        }
        return;
      }
      accessToken = resp.access_token ?? null;
      if (accessToken) localStorage.setItem(PERSISTED_FLAG, "true");
      resolve(accessToken);
    };
    tokenClient.error_callback = (err) => {
      pending = null;
      if (prompt === "") resolve(null);
      else reject(new Error(err?.message || "Sign-in failed"));
    };
    tokenClient.requestAccessToken(prompt !== undefined ? { prompt } : undefined);
  });
  return pending;
}

export const googleAuth = {
  async signIn(): Promise<string | null> {
    await ensureInitialized();
    return requestToken(undefined);
  },
  async trySilentSignIn(): Promise<string | null> {
    await ensureInitialized();
    return requestToken("");
  },
  signOut(): void {
    if (accessToken && window.google?.accounts) {
      window.google.accounts.oauth2.revoke(accessToken);
    }
    accessToken = null;
    localStorage.removeItem(PERSISTED_FLAG);
  },
  getAccessToken(): string | null {
    return accessToken;
  },
  isSignedIn(): boolean {
    return accessToken !== null;
  },
  hasPreviousSession(): boolean {
    return localStorage.getItem(PERSISTED_FLAG) === "true";
  },
  /** Drop the in-memory token (e.g. on 401) without revoking — forces a fresh request next time. */
  invalidateToken(): void {
    accessToken = null;
  },
};
