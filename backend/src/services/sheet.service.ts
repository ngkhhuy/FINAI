/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FINAI – Sheet Service
 * Connects to Google Sheets using the google-spreadsheet library (v5) with
 * Service Account authentication.
 *
 * Required env vars:
 *   SPREADSHEET_ID               – Google Spreadsheet ID
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL – service account email
 *   GOOGLE_PRIVATE_KEY           – service account private key (PEM string)
 *
 * Public exports:
 *   init()            – initialise connection (called automatically on first use)
 *   fetchConfig()     – read CONFIG tab, return key-value Record
 *   fetchOffers()     – read OFFERS tab, return active Offer[]
 *   getOffersData()   – cache-aware wrapper around fetchOffers()
 *   getConfigData()   – cache-aware wrapper around fetchConfig()
 *   invalidateCache() – force next call to re-fetch from Sheet
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GoogleSpreadsheet, type GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { logger } from "../utils/logger";
import type { Offer } from "../types";

// ── Env vars ──────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.SPREADSHEET_ID ?? "";
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
// PEM key may be stored with literal \n — convert to real newlines
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
const FEATURED_DEFAULT_WEIGHT = parseFloat(process.env.FEATURED_DEFAULT_WEIGHT ?? "0.6");

// ── Sheet tab names ───────────────────────────────────────────────────────────

const OFFERS_TAB = "OFFERS";
const CONFIG_TAB  = "CONFIG";

// ── In-memory cache ───────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

let offersCache: CacheEntry<Offer[]> | null = null;
let configCache: CacheEntry<Record<string, string | number>> | null = null;

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

// ── Spreadsheet instance (singleton) ─────────────────────────────────────────

let doc: GoogleSpreadsheet | null = null;
let initPromise: Promise<GoogleSpreadsheet> | null = null;

/**
 * Initialise the Google Spreadsheet connection.
 * Safe to call multiple times and concurrently — all callers share the same
 * in-flight loadInfo() promise so it is never called more than once.
 */
export async function init(): Promise<GoogleSpreadsheet> {
  if (doc) return doc;

  // Return the in-flight promise so concurrent callers don't race
  if (initPromise) return initPromise;

  if (!SPREADSHEET_ID) throw new Error("[sheet.service] Missing env: SPREADSHEET_ID");
  if (!SERVICE_ACCOUNT_EMAIL) throw new Error("[sheet.service] Missing env: GOOGLE_SERVICE_ACCOUNT_EMAIL");
  if (!PRIVATE_KEY) throw new Error("[sheet.service] Missing env: GOOGLE_PRIVATE_KEY");

  initPromise = (async () => {
    const auth = new JWT({
      email: SERVICE_ACCOUNT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const spreadsheet = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    await spreadsheet.loadInfo();
    logger.info(`[sheet.service] Connected: "${spreadsheet.title}"`);
    doc = spreadsheet;
    return doc;
  })().catch((err) => {
    // Reset so the next call retries
    doc = null;
    initPromise = null;
    logger.error("[sheet.service] init() failed:", { message: err instanceof Error ? err.message : String(err) });
    throw err;
  });

  return initPromise;
}

// ── CONFIG tab ────────────────────────────────────────────────────────────────

/**
 * Read the CONFIG tab and return a typed key-value object.
 *
 * Expected sheet columns: key | value
 * Numeric strings are automatically coerced to numbers.
 *
 * Example return value:
 *   { max_offers_shown: 3, featured_default_weight: 0.6 }
 */
export async function fetchConfig(): Promise<Record<string, string | number>> {
  try {
    const spreadsheet = await init();
    const sheet = spreadsheet.sheetsByTitle[CONFIG_TAB];
    if (!sheet) throw new Error(`[sheet.service] Tab "${CONFIG_TAB}" not found in spreadsheet`);

    const rows: GoogleSpreadsheetRow[] = await sheet.getRows();
    const config: Record<string, string | number> = {};

    for (const row of rows) {
      const key = row.get("Key")?.toString().trim();
      const raw = row.get("Value")?.toString().trim();
      if (!key || raw === undefined || raw === "") continue;

      // Coerce to number if the value looks numeric, keep as string otherwise
      const num = Number(raw);
      config[key] = isNaN(num) ? raw : num;
    }

    logger.info(`[sheet.service] fetchConfig: ${Object.keys(config).length} entries loaded`);
    return config;
  } catch (err) {
    logger.error("[sheet.service] fetchConfig() error:", { message: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ── OFFERS tab ────────────────────────────────────────────────────────────────

function rowToOffer(row: GoogleSpreadsheetRow): Offer {
  const str  = (col: string): string  => row.get(col)?.toString().trim() ?? "";
  const num  = (col: string): number  => parseFloat(str(col)) || 0;
  const bool = (col: string): boolean => str(col).toLowerCase() === "true";

  const featuredWeight = num("featured_weight");

  return {
    offer_id:         str("offer_id"),
    brand_name:       str("brand_name"),
    loan_type:        str("loan_type") as Offer["loan_type"],
    apply_url:        str("apply_url"),
    amount_min:       num("amount_min"),
    amount_max:       num("amount_max"),
    term_min:         num("term_min"),
    term_max:         num("term_max"),
    apr_min:          num("apr_min"),
    apr_max:          num("apr_max"),
    speed_label:      str("speed_label"),
    conditions_short: str("conditions_short"),
    pros_1:           str("pros_1"),
    pros_2:           str("pros_2"),
    pros_3:           str("pros_3"),
    is_active:        bool("is_active"),
    is_featured:      bool("is_featured"),
    // Fall back to env default when the sheet cell is empty / zero
    featured_weight:  featuredWeight > 0 ? featuredWeight : FEATURED_DEFAULT_WEIGHT,
  };
}

/**
 * Fetch ALL active offers from the OFFERS tab.
 * Rows where is_active is not "TRUE" are silently skipped.
 * Numeric columns (amount_min, apr_max, featured_weight …) are coerced to numbers.
 */
export async function fetchOffers(): Promise<Offer[]> {
  try {
    const spreadsheet = await init();
    const sheet = spreadsheet.sheetsByTitle[OFFERS_TAB];
    if (!sheet) throw new Error(`[sheet.service] Tab "${OFFERS_TAB}" not found in spreadsheet`);

    const rows: GoogleSpreadsheetRow[] = await sheet.getRows();
    const offers: Offer[] = [];

    for (const row of rows) {
      const isActive = row.get("is_active")?.toString().trim().toLowerCase();
      if (isActive !== "true") continue; // skip inactive

      try {
        offers.push(rowToOffer(row));
      } catch (parseErr) {
        // Skip the malformed row but keep processing the rest
        logger.warn(
          "[sheet.service] Skipping malformed offer row:",
          { message: parseErr instanceof Error ? parseErr.message : String(parseErr) },
        );
      }
    }

    logger.info(`[sheet.service] fetchOffers: ${offers.length} active offers loaded`);
    return offers;
  } catch (err) {
    logger.error("[sheet.service] fetchOffers() error:", { message: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ── Cache-aware public API ────────────────────────────────────────────────────

/**
 * Return active offers, served from in-memory cache for up to 5 minutes.
 * On cache miss or TTL expiry, re-fetches from Google Sheets and updates the cache.
 */
export async function getOffersData(): Promise<Offer[]> {
  if (isFresh(offersCache)) {
    logger.debug("[sheet.service] getOffersData: cache hit");
    return offersCache.data;
  }

  logger.debug("[sheet.service] getOffersData: cache miss — fetching from Sheet");
  const data = await fetchOffers();
  offersCache = { data, fetchedAt: Date.now() };
  return data;
}

/**
 * Return config key-value map, served from in-memory cache for up to 5 minutes.
 * On cache miss or TTL expiry, re-fetches from Google Sheets and updates the cache.
 */
export async function getConfigData(): Promise<Record<string, string | number>> {
  if (isFresh(configCache)) {
    logger.debug("[sheet.service] getConfigData: cache hit");
    return configCache.data;
  }

  logger.debug("[sheet.service] getConfigData: cache miss — fetching from Sheet");
  const data = await fetchConfig();
  configCache = { data, fetchedAt: Date.now() };
  return data;
}

/**
 * Manually invalidate both caches.
 * Call this after an admin write operation so the next request gets fresh data.
 */
export function invalidateCache(): void {
  offersCache = null;
  configCache = null;
  logger.info("[sheet.service] Cache invalidated");
}
