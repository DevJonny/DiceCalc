import { googleAuth } from "./googleAuth";
import type { SyncEnvelope } from "../types";

const FILE_NAME = "dicecalc-sync.json";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export class DriveHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let token = googleAuth.getAccessToken();
  if (!token) {
    token = await googleAuth.signIn();
    if (!token) throw new DriveHttpError(401, "Not signed in");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const resp = await fetch(url, { ...init, headers });
  if (resp.status === 401) {
    googleAuth.invalidateToken();
  }
  if (!resp.ok && resp.status !== 412 && resp.status !== 304) {
    throw new DriveHttpError(resp.status, `${resp.status} ${resp.statusText}`);
  }
  return resp;
}

export async function findSyncFile(): Promise<{ id: string; etag: string | null } | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const url = `${API}/files?spaces=appDataFolder&q=${q}&fields=files(id)`;
  const resp = await authedFetch(url);
  const data = (await resp.json()) as { files?: { id: string }[] };
  const first = data.files?.[0];
  if (!first) return null;
  // Fetch ETag via HEAD-equivalent — Drive doesn't support HEAD on this resource,
  // so we GET the metadata and read the response ETag header.
  const meta = await authedFetch(`${API}/files/${first.id}?spaces=appDataFolder&fields=id`);
  return { id: first.id, etag: meta.headers.get("ETag") };
}

export async function downloadSyncFile(fileId: string): Promise<SyncEnvelope> {
  const resp = await authedFetch(`${API}/files/${fileId}?alt=media`);
  return (await resp.json()) as SyncEnvelope;
}

export async function uploadSyncFile(
  envelope: SyncEnvelope,
  existing: { id: string; etag: string | null } | null,
): Promise<{ id: string; etag: string | null }> {
  const body = JSON.stringify(envelope);
  if (existing) {
    return updateFile(existing.id, existing.etag, body);
  }
  return createFile(body);
}

async function createFile(body: string): Promise<{ id: string; etag: string | null }> {
  const boundary = `b${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: FILE_NAME, parents: ["appDataFolder"] });
  const multipart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${body}\r\n` +
    `--${boundary}--`;

  const resp = await authedFetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  const data = (await resp.json()) as { id: string };
  return { id: data.id, etag: resp.headers.get("ETag") };
}

async function updateFile(
  id: string,
  etag: string | null,
  body: string,
): Promise<{ id: string; etag: string | null }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (etag) headers["If-Match"] = etag;
  const resp = await authedFetch(`${UPLOAD}/files/${id}?uploadType=media&fields=id`, {
    method: "PATCH",
    headers,
    body,
  });
  if (resp.status === 412) {
    throw new DriveHttpError(412, "Precondition failed (etag mismatch)");
  }
  const data = (await resp.json()) as { id: string };
  return { id: data.id, etag: resp.headers.get("ETag") };
}
