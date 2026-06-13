// CDN cache headers for public page responses (Deno Deploy CDN layer, see
// task pivot-share-link-service / 011.decision). The CDN caches globally; writes
// invalidate by tag (`page-<id>` / `user-<id>`) and the purge propagates globally
// within seconds, so a long `s-maxage` is safe — the value is "cache until
// purged", tunable via the CACHE_S_MAXAGE env var.

// 1 year. Long on purpose: invalidation is by tag on write, not by TTL.
export const DEFAULT_S_MAXAGE = 31_536_000

export const resolve_s_maxage = (raw: string | undefined): number => {
  if (raw === undefined || raw.trim() === "") return DEFAULT_S_MAXAGE
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_S_MAXAGE
}

export const cache_headers = (
  page: { _id: number; user_id: number },
  s_maxage: number,
): Record<string, string> => ({
  // `Deno-CDN-Cache-Control` is the highest-priority CDN directive; it does not
  // leak to the browser (unlike `Cache-Control`), so private browser caches keep
  // honouring the canonical link.
  "Deno-CDN-Cache-Control": `public, s-maxage=${s_maxage}`,
  // tags for targeted global purge on write.
  "Deno-Cache-Tag": `page-${page._id},user-${page.user_id}`,
})

// effective value resolved once at startup (CACHE_S_MAXAGE, defaulted).
export const S_MAXAGE = resolve_s_maxage(Deno.env.get("CACHE_S_MAXAGE") ?? undefined)
