import { assertEquals } from "@std/assert"
import { cache_headers, DEFAULT_S_MAXAGE, resolve_s_maxage } from "./page_cache.ts"

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
