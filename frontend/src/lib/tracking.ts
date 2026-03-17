/**
 * FINAI – Tracking parameter utilities
 *
 * Reads affiliate / ad-network click IDs from the current page URL and
 * appends them to offer apply URLs so the affiliate network correctly
 * attributes the conversion.
 *
 * Supported parameters: gclid (Google Ads), fbclid (Meta Ads), ttclid (TikTok Ads),
 * msclkid (Microsoft Ads), utm_source, utm_medium, utm_campaign, utm_content, utm_term.
 */

const TRACKED_PARAMS = [
  "gclid",
  "fbclid",
  "ttclid",
  "msclkid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type TrackingParams = Partial<Record<(typeof TRACKED_PARAMS)[number], string>>;

/**
 * Extract tracking parameters from the current window.location.search.
 * Returns only the params that are actually present in the URL.
 */
export function getTrackingParams(): TrackingParams {
  const params: TrackingParams = {};
  try {
    const search = new URLSearchParams(window.location.search);
    for (const key of TRACKED_PARAMS) {
      const val = search.get(key);
      if (val) params[key] = val;
    }
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
