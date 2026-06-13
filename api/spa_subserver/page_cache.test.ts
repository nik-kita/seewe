import { assertEquals } from "@std/assert"
import {
  cache_headers,
  DEFAULT_S_MAXAGE,
  purge_page,
  purge_tags,
  purge_user,
  resolve_s_maxage,
} from "./page_cache.ts"

Deno.test("resolve_s_maxage: unset -> default", () => {
  assertEquals(resolve_s_maxage(undefined), DEFAULT_S_MAXAGE)
  assertEquals(resolve_s_maxage(""), DEFAULT_S_MAXAGE)
})

Deno.test("resolve_s_maxage: a valid number overrides", () => {
  assertEquals(resolve_s_maxage("60"), 60)
  assertEquals(resolve_s_maxage("0"), 0)
})

Deno.test("resolve_s_maxage: junk / negative / float -> default", () => {
  assertEquals(resolve_s_maxage("abc"), DEFAULT_S_MAXAGE)
  assertEquals(resolve_s_maxage("-5"), DEFAULT_S_MAXAGE)
  assertEquals(resolve_s_maxage("1.5"), DEFAULT_S_MAXAGE)
})

Deno.test("cache_headers: CDN directive + per-page/per-user tags", () => {
  const h = cache_headers({ _id: 7, user_id: 42 }, 60)
  assertEquals(h["Deno-CDN-Cache-Control"], "public, s-maxage=60")
  assertEquals(h["Deno-Cache-Tag"], "page-7,user-42")
})

// stub global fetch, capturing the purge request(s).
const with_stub_fetch = async (
  impl: (url: string, init?: RequestInit) => Promise<Response>,
  body: () => Promise<void>,
) => {
  const calls: { url: string; body: unknown }[] = []
  const orig = globalThis.fetch
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null })
    return impl(String(url), init)
  }) as typeof fetch
  try {
    await body()
  } finally {
    globalThis.fetch = orig
  }
  return calls
}

const okFetch = () => Promise.resolve(new Response(null, { status: 200 }))

Deno.test("purge_page POSTs the page tag to the invalidate endpoint", async () => {
  const calls = await with_stub_fetch(okFetch, () => purge_page(7))
  assertEquals(calls.length, 1)
  assertEquals(calls[0]?.url, "http://cache.localhost/invalidate/http")
  assertEquals(calls[0]?.body, { tags: ["page-7"] })
})

Deno.test("purge_user POSTs the user tag", async () => {
  const calls = await with_stub_fetch(okFetch, () => purge_user(42))
  assertEquals(calls[0]?.body, { tags: ["user-42"] })
})

Deno.test("purge_tags is a no-op for an empty tag list (no request)", async () => {
  const calls = await with_stub_fetch(okFetch, () => purge_tags([]))
  assertEquals(calls.length, 0)
})

Deno.test("purge_tags swallows fetch failures (never breaks a write)", async () => {
  // must not throw
  await with_stub_fetch(
    () => Promise.reject(new Error("cache.localhost unreachable")),
    () => purge_tags(["page-1"]),
  )
})
