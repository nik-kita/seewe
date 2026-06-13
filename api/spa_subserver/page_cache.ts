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

// --- invalidation on write ----------------------------------------------------
// Deno Deploy's internal purge endpoint; a tag purge propagates globally within
// seconds. Only resolves on Deploy, so purges are best-effort: a failure (e.g.
// local dev, where this host does not exist) must never break a write.
const PURGE_ENDPOINT = "http://cache.localhost/invalidate/http"

export const purge_tags = async (tags: string[]): Promise<void> => {
  if (tags.length === 0) return
  try {
    await fetch(PURGE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tags }),
    })
  } catch { /* best-effort: Deploy-only, never block a write on it */ }
}

// invalidate one page's cached responses (content edits, pdf changes, delete).
export const purge_page = (page_id: number) => purge_tags([`page-${page_id}`])

// invalidate ALL of a user's pages at once (default toggle, nik rename) — one
// call covers every URL the user answers.
export const purge_user = (user_id: number) => purge_tags([`user-${user_id}`])
