import { v4 as uuidv4 } from "uuid";
import type { SessionData, Language, ConversationStep } from "../types";
import { env } from "../config/env";

// In-memory store for MVP (replace with Redis/DB in production)
const sessions = new Map<string, SessionData>();

function isExpired(session: SessionData): boolean {
  const ttlMs = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - session.created_at > ttlMs;
}

export const sessionService = {
  create(language: Language, clickIds?: { session_id?: string; gclid?: string; fbclid?: string; ttclid?: string }): SessionData {
    const now = Date.now();
    const session: SessionData = {
      session_id: clickIds?.session_id ?? uuidv4(),
      language,
      step: "greeting",
      history: [],
      created_at: now,
      updated_at: now,
      ...clickIds,
    };
    sessions.set(session.session_id, session);
    return session;
  },

  get(session_id: string): SessionData | null {
    const session = sessions.get(session_id);
    if (!session) return null;
    if (isExpired(session)) {
      sessions.delete(session_id);
      return null;
    }
    return session;
  },

  update(session_id: string, patch: Partial<SessionData>): SessionData | null {
    const session = sessions.get(session_id);
    if (!session) return null;
    const updated = { ...session, ...patch, updated_at: Date.now() };
    sessions.set(session_id, updated);
    return updated;
  },

  buildApplyUrl(baseUrl: string, session: SessionData): string {
    const url = new URL(baseUrl);
    url.searchParams.set("utm_source", "finai");
    url.searchParams.set("utm_medium", "chat");
    url.searchParams.set("session_id", session.session_id);
    if (session.gclid) url.searchParams.set("gclid", session.gclid);
    if (session.fbclid) url.searchParams.set("fbclid", session.fbclid);
    if (session.ttclid) url.searchParams.set("ttclid", session.ttclid);
    return url.toString();
  },

  listAll(): SessionData[] {
    const now = Date.now();
    const ttlMs = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
    const result: SessionData[] = [];
    for (const [id, session] of sessions) {
      if (now - session.created_at > ttlMs) {
        sessions.delete(id);
        continue;
      }
      result.push(session);
    }
    return result.sort((a, b) => b.updated_at - a.updated_at);
  },
};
