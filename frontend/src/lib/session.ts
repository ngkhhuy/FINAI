/**
 * FINAI – Session ID management
 *
 * Session ID is ephemeral (in-memory only).
 * Every page load / F5 creates a fresh session automatically.
 * Use clearSession() + getSessionId() to start a new conversation manually.
 */

/** Cryptographically-random UUID v4 (uses Web Crypto API, available in all modern browsers). */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Return a fresh session ID. Each call always generates a new UUID. */
export function getSessionId(): string {
  return generateUUID();
}

/** No-op — session is not persisted, nothing to clear. */
export function clearSession(): void {
  // Clean up any stale localStorage keys from previous versions
  try {
    localStorage.removeItem("finai_session_id");
    localStorage.removeItem("finai_session_created_at");
  } catch {
    // ignore
  }
}
