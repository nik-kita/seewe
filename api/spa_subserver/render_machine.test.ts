import { assertEquals } from "@std/assert"
import { createActor, toPromise } from "xstate"
import {
  decide_render,
  render_machine,
  type RenderInput,
} from "./render_machine.ts"
import type { PagePdf } from "../dto/page.dto.ts"

const a_pdf: PagePdf = {
  page_id: 1,
  bytes: new Uint8Array([1, 2, 3]),
  filename: "cv.pdf",
  size: 3,
  uploaded_at: 0,
}

// load_pdf spy: records calls and returns a scripted result.
const spy = (result: PagePdf | null | Error) => {
  const calls: number[] = []
  const load_pdf: RenderInput["load_pdf"] = (page_id) => {
    calls.push(page_id)
    if (result instanceof Error) return Promise.reject(result)
    return Promise.resolve(result)
  }
  return { calls, load_pdf }
}

Deno.test("md page renders in the site layout (fallback), no blob read", async () => {
  const { calls, load_pdf } = spy(a_pdf)
  const decision = await decide_render({ kind: "md", page_id: 1, load_pdf })
  assertEquals(decision.mode, "site")
  assertEquals(calls, []) // md path must not touch the pdf store
})

Deno.test("pdf page with a blob serves the artifact", async () => {
  const { calls, load_pdf } = spy(a_pdf)
  const decision = await decide_render({ kind: "pdf", page_id: 1, load_pdf })
  assertEquals(decision.mode, "artifact")
  if (decision.mode === "artifact") assertEquals(decision.pdf.bytes, a_pdf.bytes)
  assertEquals(calls, [1]) // loaded exactly once
})

Deno.test("pdf page with a missing blob degrades to the site layout", async () => {
  const { load_pdf } = spy(null)
  const decision = await decide_render({ kind: "pdf", page_id: 1, load_pdf })
  assertEquals(decision.mode, "site")
})

Deno.test("pdf page whose blob load errors degrades to the site layout", async () => {
  const { load_pdf } = spy(new Error("kv down"))
  const decision = await decide_render({ kind: "pdf", page_id: 1, load_pdf })
  assertEquals(decision.mode, "site")
})

// --- white-box: assert the machine settles in the expected final STATE --------
const settle_state = async (input: RenderInput) => {
  const actor = createActor(render_machine, { input }).start()
  await toPromise(actor)
  return actor.getSnapshot().value
}

Deno.test("machine settles in `artifact_ready` for a pdf with a blob", async () => {
  const { load_pdf } = spy(a_pdf)
  assertEquals(await settle_state({ kind: "pdf", page_id: 7, load_pdf }), "artifact_ready")
})

Deno.test("machine settles in `render_md` for an md page", async () => {
  const { load_pdf } = spy(a_pdf)
  assertEquals(await settle_state({ kind: "md", page_id: 7, load_pdf }), "render_md")
})

Deno.test("machine settles in `render_md` when the pdf blob is missing (degrade)", async () => {
  const { load_pdf } = spy(null)
  assertEquals(await settle_state({ kind: "pdf", page_id: 7, load_pdf }), "render_md")
})

// --- payload + input plumbing -------------------------------------------------
Deno.test("artifact decision carries the full pdf (filename + size, not just bytes)", async () => {
  const { load_pdf } = spy(a_pdf)
  const d = await decide_render({ kind: "pdf", page_id: 1, load_pdf })
  assertEquals(d.mode, "artifact")
  if (d.mode === "artifact") {
    assertEquals(d.pdf.filename, "cv.pdf")
    assertEquals(d.pdf.size, 3)
  }
})

Deno.test("load_pdf is invoked with the page's own id", async () => {
  const { calls, load_pdf } = spy(a_pdf)
  await decide_render({ kind: "pdf", page_id: 42, load_pdf })
  assertEquals(calls, [42])
})

Deno.test("concurrent decisions do not interfere", async () => {
  const [md, pdf] = await Promise.all([
    decide_render({ kind: "md", page_id: 1, load_pdf: spy(a_pdf).load_pdf }),
    decide_render({ kind: "pdf", page_id: 2, load_pdf: spy(a_pdf).load_pdf }),
  ])
  assertEquals(md.mode, "site")
  assertEquals(pdf.mode, "artifact")
})
