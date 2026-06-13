import { assertEquals } from "@std/assert"
import { createActor, toPromise } from "xstate"
import {
  decide_serve,
  serving_machine,
  type ServeInput,
} from "./serving_machine.ts"
import type { PageEntity, PagePdf } from "../dto/page.dto.ts"

const a_pdf: PagePdf = {
  page_id: 1,
  bytes: new Uint8Array([1, 2, 3]),
  filename: "cv.pdf",
  size: 3,
  uploaded_at: 0,
}

// a named page served at /NikKita/My-Page (display). The machine only reads kind
// + the display selector; lc index keys are irrelevant to it.
const page = (over: Partial<PageEntity> = {}): PageEntity => ({
  _id: 1,
  user_id: 9,
  kind: "md",
  is_published: true,
  display_username: "NikKita",
  display_name: "My-Page",
  ...over,
})

// load_pdf spy: records calls; returns a scripted result or throws.
const pdf_spy = (result: PagePdf | null | Error) => {
  const calls: number[] = []
  const load_pdf: ServeInput["load_pdf"] = (id) => {
    calls.push(id)
    return result instanceof Error
      ? Promise.reject(result)
      : Promise.resolve(result)
  }
  return { calls, load_pdf }
}

// default display selector: a named page -> [username, name].
const named_display = (p: PageEntity) => [p.display_username!, p.display_name!]

const base = (over: Partial<ServeInput>): ServeInput => ({
  incoming: ["NikKita", "My-Page"],
  resolve: () => Promise.resolve(page()),
  display_of: named_display,
  load_pdf: pdf_spy(a_pdf).load_pdf,
  ...over,
})

// --- resolve / fallback -------------------------------------------------------
Deno.test("no page resolved -> fallback (serve site)", async () => {
  const d = await decide_serve(base({ resolve: () => Promise.resolve(null) }))
  assertEquals(d.mode, "fallback")
})

Deno.test("resolve error -> fallback (never a 500 on the link path)", async () => {
  const d = await decide_serve(
    base({ resolve: () => Promise.reject(new Error("kv down")) }),
  )
  assertEquals(d.mode, "fallback")
})

// --- canonical display / lowercase redirect -----------------------------------
Deno.test("incoming casing differs from display -> redirect to canonical", async () => {
  const d = await decide_serve(base({ incoming: ["nikkita", "my-page"] }))
  assertEquals(d.mode, "redirect")
  if (d.mode === "redirect") assertEquals(d.to, "/NikKita/My-Page")
})

Deno.test("incoming already canonical -> no redirect, renders", async () => {
  const d = await decide_serve(base({ incoming: ["NikKita", "My-Page"] }))
  assertEquals(d.mode, "site")
})

Deno.test("only the name segment differs in casing -> redirect", async () => {
  const d = await decide_serve(base({ incoming: ["NikKita", "MY-PAGE"] }))
  assertEquals(d.mode, "redirect")
  if (d.mode === "redirect") assertEquals(d.to, "/NikKita/My-Page")
})

Deno.test("redirect short-circuits before any blob read", async () => {
  const spy = pdf_spy(a_pdf)
  const d = await decide_serve(base({
    incoming: ["nikkita", "my-page"],
    resolve: () => Promise.resolve(page({ kind: "pdf" })),
    load_pdf: spy.load_pdf,
  }))
  assertEquals(d.mode, "redirect")
  assertEquals(spy.calls, []) // don't fetch the artifact just to throw it away
})

// --- /id/:user_id style: incoming [] + display_of yields the username ----------
Deno.test("/id of a named user's default -> redirect to /username", async () => {
  const d = await decide_serve(base({
    incoming: [],
    display_of: (p) => p.display_username ? [p.display_username] : [],
  }))
  assertEquals(d.mode, "redirect")
  if (d.mode === "redirect") assertEquals(d.to, "/NikKita")
})

Deno.test("/id of a nik-less default (no username) -> render, no redirect", async () => {
  const d = await decide_serve(base({
    incoming: [],
    resolve: () => Promise.resolve(page({ display_username: undefined })),
    display_of: (p) => p.display_username ? [p.display_username] : [],
  }))
  assertEquals(d.mode, "site")
})

// --- render leaf (canonical): artifact vs site vs degrade ---------------------
Deno.test("canonical md page -> site", async () => {
  const d = await decide_serve(base({}))
  assertEquals(d.mode, "site")
})

Deno.test("canonical pdf page with a blob -> artifact", async () => {
  const spy = pdf_spy(a_pdf)
  const d = await decide_serve(base({
    resolve: () => Promise.resolve(page({ kind: "pdf" })),
    load_pdf: spy.load_pdf,
  }))
  assertEquals(d.mode, "artifact")
  if (d.mode === "artifact") {
    assertEquals(d.pdf.filename, "cv.pdf")
    assertEquals(spy.calls, [1]) // loaded once, by page id
  }
})

Deno.test("canonical pdf page with a missing blob -> degrade to site", async () => {
  const d = await decide_serve(base({
    resolve: () => Promise.resolve(page({ kind: "pdf" })),
    load_pdf: pdf_spy(null).load_pdf,
  }))
  assertEquals(d.mode, "site")
})

Deno.test("canonical pdf page whose blob load errors -> degrade to site", async () => {
  const d = await decide_serve(base({
    resolve: () => Promise.resolve(page({ kind: "pdf" })),
    load_pdf: pdf_spy(new Error("kv down")).load_pdf,
  }))
  assertEquals(d.mode, "site")
})

Deno.test("md page never reads the pdf store", async () => {
  const spy = pdf_spy(a_pdf)
  await decide_serve(base({ load_pdf: spy.load_pdf }))
  assertEquals(spy.calls, [])
})

// --- white-box: final state names ---------------------------------------------
const settle = async (input: ServeInput) => {
  const actor = createActor(serving_machine, { input }).start()
  await toPromise(actor)
  return actor.getSnapshot().value
}

Deno.test("final states map to the decision", async () => {
  assertEquals(
    await settle(base({ resolve: () => Promise.resolve(null) })),
    "fallback",
  )
  assertEquals(await settle(base({ incoming: ["x"] })), "redirect")
  assertEquals(await settle(base({})), "render_md")
  assertEquals(
    await settle(base({
      resolve: () => Promise.resolve(page({ kind: "pdf" })),
      load_pdf: pdf_spy(a_pdf).load_pdf,
    })),
    "artifact_ready",
  )
})
