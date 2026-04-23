import { google } from "googleapis";
import { env } from "../config/env";
import type { Offer, UpdateOfferBody } from "../types";
import { logger } from "../utils/logger";

const OFFERS_TAB = "OFFERS";
const CONFIG_TAB = "CONFIG";

// Simple TTL cache: re-fetch sheet every 5 minutes
let offersCache: Offer[] | null = null;
let offersCacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function getPrivateKey(): string {
  // Preferred: base64-encoded key (no newline issues with EB Console)
  if (env.GOOGLE_PRIVATE_KEY_BASE64) {
    const key = Buffer.from(env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
    logger.info("[sheets] Using GOOGLE_PRIVATE_KEY_BASE64");
    return key;
  }
  // Fallback: plain key with \n escape sequences
  const raw = env.GOOGLE_PRIVATE_KEY ?? "";
  if (raw.includes("\n")) return raw;
  if (raw.includes("\\n")) return raw.replace(/\\n/g, "\n");
  logger.error("[sheets] No valid GOOGLE_PRIVATE_KEY or GOOGLE_PRIVATE_KEY_BASE64 found");
  return raw;
}

function getAuthClient() {
  const key = getPrivateKey();
  return new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function rowToOffer(headers: string[], row: string[]): Offer {
  const cell = (col: string) => row[headers.indexOf(col)] ?? "";

  // offer_id: prefer explicit column, fallback to "oid" param in apply_url, then "cpid"
  const explicitId = cell("offer_id");
  const applyUrlRaw = cell("apply_url");
  let derivedOfferId = explicitId;
  if (!derivedOfferId) {
    try {
      const u = new URL(applyUrlRaw);
      derivedOfferId = u.searchParams.get("oid") ?? u.searchParams.get("cpid") ?? "";
    } catch {
      derivedOfferId = "";
    }
  }

  return {
    offer_id: derivedOfferId,
    brand_name: cell("brand_name"),
    loan_type: cell("loan_type") as Offer["loan_type"],
    apply_url: cell("apply_url"),
    amount_min: parseFloat(cell("amount_min")) || 0,
    amount_max: parseFloat(cell("amount_max")) || 0,
    term_min: parseFloat(cell("term_min")) || 0,
    term_max: parseFloat(cell("term_max")) || 0,
    apr_min: parseFloat(cell("apr_min")) || 0,
    apr_max: parseFloat(cell("apr_max")) || 0,
    speed_label: cell("speed_label"),
    conditions_short: cell("conditions_short"),
    pros_1: cell("pros_1"),
    pros_2: cell("pros_2"),
    pros_3: cell("pros_3"),
    is_active: cell("is_active").toLowerCase() === "true",
    is_featured: cell("is_featured").toLowerCase() === "true",
    featured_weight: parseFloat(cell("featured_weight")) || env.FEATURED_DEFAULT_WEIGHT,
  };
}

export const sheetsService = {
  async getAllOffers(): Promise<Offer[]> {
    if (offersCache && Date.now() - offersCacheAt < CACHE_TTL_MS) {
      return offersCache;
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: `${OFFERS_TAB}!A1:Z`,
    });

    const rows = response.data.values ?? [];
    if (rows.length < 2) {
      logger.warn("[sheets] Spreadsheet returned fewer than 2 rows — check OFFERS tab has data.");
      return [];
    }

    const [headers, ...dataRows] = rows as string[][];
    const offers = dataRows.map((row) => rowToOffer(headers, row));

    offersCache = offers;
    offersCacheAt = Date.now();
    logger.info(`[sheets] loaded ${offers.length} offers from spreadsheet`);
    return offers;
  },

  async getActiveOffers(): Promise<Offer[]> {
    try {
      const all = await this.getAllOffers();
      return all.filter((o) => o.is_active);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[sheets] getActiveOffers failed: ${msg}`);
      throw err;
    }
  },

  async updateOffer(offerId: string, patch: UpdateOfferBody): Promise<void> {
    // Invalidate cache so next request re-fetches
    offersCache = null;

    const auth = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: `${OFFERS_TAB}!A1:Z`,
    });
    const rows = response.data.values as string[][];
    if (!rows || rows.length < 2) throw new Error("Sheet is empty");

    const headers = rows[0];
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[headers.indexOf("offer_id")] === offerId);
    if (rowIndex === -1) throw new Error(`Offer ${offerId} not found`);

    const sheetRow = rowIndex + 1; // 1-indexed
    const updates: Array<{ col: string; value: string }> = [];
    if (patch.is_active !== undefined) updates.push({ col: "is_active", value: String(patch.is_active) });
    if (patch.is_featured !== undefined) updates.push({ col: "is_featured", value: String(patch.is_featured) });
    if (patch.featured_weight !== undefined) updates.push({ col: "featured_weight", value: String(patch.featured_weight) });

    for (const { col, value } of updates) {
      const colIndex = headers.indexOf(col);
      if (colIndex === -1) continue;
      const colLetter = String.fromCharCode(65 + colIndex);
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.SPREADSHEET_ID,
        range: `${OFFERS_TAB}!${colLetter}${sheetRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [[value]] },
      });
    }

    logger.info(`Sheets: updated offer ${offerId}`, patch);
  },

  async getConfig(): Promise<Record<string, string>> {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: `${CONFIG_TAB}!A1:B`,
    });
    const rows = (response.data.values ?? []) as string[][];
    const config: Record<string, string> = {};
    for (const [key, value] of rows) {
      if (key) config[key] = value ?? "";
    }
    return config;
  },
};
