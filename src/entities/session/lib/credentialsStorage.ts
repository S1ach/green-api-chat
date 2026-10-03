import type { Credentials } from '@/shared/api';
import { isRecord, readString } from '@/shared/lib/guards';
import { loadJson, removeKey, saveJson } from '@/shared/lib/storage';

const STORAGE_KEY = 'greenapi.credentials';

export function loadCredentials(): Credentials | null {
  const raw = loadJson<unknown>(STORAGE_KEY);
  if (!isRecord(raw)) {
    return null;
  }
  const apiUrl = readString(raw, 'apiUrl');
  const idInstance = readString(raw, 'idInstance');
  const apiTokenInstance = readString(raw, 'apiTokenInstance');
  if (!apiUrl || !idInstance || !apiTokenInstance) {
    return null;
  }
  const mediaUrl = readString(raw, 'mediaUrl');
  return { apiUrl, idInstance, apiTokenInstance, ...(mediaUrl ? { mediaUrl } : {}) };
}

export function saveCredentials(credentials: Credentials): void {
  saveJson(STORAGE_KEY, credentials);
}

export function clearCredentials(): void {
  removeKey(STORAGE_KEY);
}
