/**
 * FINAI – Tracking parameter utilities
 *
 * Captures ALL query parameters from the landing URL and appends them to
 * offer apply URLs so every ad network (TikTok, Meta, Google, etc.) can
 * attribute the conversion correctly — regardless of which custom params
 * each network injects (e.g. cpid, oid, aff_sub1, campaign_id, creative_id,
 * placement, gclid, fbclid, ttclid, utm_*, msclkid, …).
 */

// Well-known click-ID keys forwarded to the backend for session-level tracking.
export const CLICK_ID_PARAMS = ["gclid", "fbclid", "ttclid", "msclkid"] as const;
export type ClickIdParam = (typeof CLICK_ID_PARAMS)[number];

/** All URL params captured from the landing page — keyed by param name. */
export type TrackingParams = Record<string, string>;

/**
 * Capture ALL query parameters from window.location.search at page load.
 * Every param present in the URL is stored, so custom affiliate params
 * (cpid, oid, aff_sub1, campaign_id, creative_id, placement, …) are
 * automatically included alongside standard utm_* and click-ID fields.
 */
export function getTrackingParams(): TrackingParams {
  const params: TrackingParams = {};
  try {
    const search = new URLSearchParams(window.location.search);
    search.forEach((value, key) => {
      if (value) params[key] = value;
    });
  } catch {
    // Non-browser environment — return empty object
  }
  return params;
}

/**
 * Append tracking parameters to a URL string.
 * Existing values in the URL are preserved; tracking params are only added,
 * never overwritten, so lender-set parameters are not corrupted.
 *
 * @param url            The apply URL (already includes session_id from backend)
 * @param trackingParams Object returned by getTrackingParams()
 */
export function appendTrackingParams(url: string, trackingParams: TrackingParams): string {
  if (Object.keys(trackingParams).length === 0) return url;
  try {
    const parsed = new URL(url);
    for (const [key, value] of Object.entries(trackingParams)) {
      if (value && !parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, value);
      }
    }
    return parsed.toString();
  } catch {
    // Malformed or relative URL — fallback to string concat
    const sep = url.includes("?") ? "&" : "?";
    const qs = Object.entries(trackingParams)
      .filter(([, v]) => v)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
      .join("&");
    return qs ? `${url}${sep}${qs}` : url;
  }
}
