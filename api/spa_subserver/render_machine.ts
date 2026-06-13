import { assign, createActor, fromPromise, setup, toPromise } from "xstate"
import type { PagePdf } from "../dto/page.dto.ts"

// The page render decision, modelled as an xstate machine (the artifact-vs-
// fallback logic the rebrand must preserve — see task pivot-share-link-service):
//
//   resolve --(kind==="pdf")--> serve_artifact --(blob found)--> artifact_ready
//      |                              |
//      | (else)                       | (no blob / error: degrade)
//      v                              v
//   render_md <---------------------- +
//
// `artifact_ready` -> serve the uploaded file; `render_md` -> render markdown in
// our site layout (the fallback). The machine output tells the caller which.

export type RenderDecision =
  | { mode: "artifact"; pdf: PagePdf }
  | { mode: "site" }

export type RenderInput = {
  kind: "md" | "pdf"
  page_id: number
  // injected so the machine stays pure/testable (no direct db import).
  load_pdf: (page_id: number) => Promise<PagePdf | null>
}

type LoadPdfInput = { page_id: number; load_pdf: RenderInput["load_pdf"] }

export const render_machine = setup({
  types: {
    input: {} as RenderInput,
    context: {} as RenderInput & { pdf: PagePdf | null },
    output: {} as RenderDecision,
  },
  actors: {
    load_pdf: fromPromise(({ input }: { input: LoadPdfInput }) =>
      input.load_pdf(input.page_id)
    ),
  },
  guards: {
    is_pdf: ({ context }) => context.kind === "pdf",
    blob_found: (_, params: { pdf: PagePdf | null }) => params.pdf !== null,
  },
}).createMachine({
  context: ({ input }) => ({ ...input, pdf: null }),
  initial: "resolve",
  states: {
    resolve: {
      always: [
        { guard: "is_pdf", target: "serve_artifact" },
        { target: "render_md" },
      ],
    },
    serve_artifact: {
      invoke: {
        src: "load_pdf",
        input: ({ context }) => ({
          page_id: context.page_id,
          load_pdf: context.load_pdf,
        }),
        onDone: [
          {
            guard: { type: "blob_found", params: ({ event }) => ({ pdf: event.output }) },
            target: "artifact_ready",
            actions: assign({ pdf: ({ event }) => event.output }),
          },
          // marked pdf but the blob is gone -> degrade to markdown.
          { target: "render_md" },
        ],
        onError: { target: "render_md" },
      },
    },
    artifact_ready: { type: "final" },
    render_md: { type: "final" },
  },
  output: ({ context }): RenderDecision =>
    context.pdf ? { mode: "artifact", pdf: context.pdf } : { mode: "site" },
})

// Run the machine to its final state and return the decision.
export const decide_render = (input: RenderInput): Promise<RenderDecision> =>
  toPromise(createActor(render_machine, { input }).start())
