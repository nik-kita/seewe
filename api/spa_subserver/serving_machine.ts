import { assign, createActor, fromPromise, setup, toPromise } from "xstate"
import type { PageEntity, PagePdf } from "../dto/page.dto.ts"

// The public-page serving decision, modelled as an xstate machine (the
// link-resolution + artifact-vs-fallback logic the rebrand must preserve — see
// task pivot-share-link-service / memory seewe-core-link-concept):
//
//   resolve --(no page / error)----------------------------------> fallback
//      |                                                              (serve site)
//      | (page found)
//      v
//   canonicalize --(incoming != display casing)-----------------> redirect
//      |                                                              (/Display/Url)
//      | (already canonical)
//      +--(kind==="pdf")--> serve_artifact --(blob)--> artifact_ready
//      |                          |
//      | (else)                   | (no blob / error: degrade)
//      v                          v
//   render_md <--------------------+
//
// The machine owns the DECISIONS (resolve, canonical display/lowercase, render);
// IO (the lc-index lookup, the pdf load) is injected so it stays pure/testable.
// The HTTP handler owns request parsing, Response building, and the deep
// not-found nuances behind the single `fallback` decision.

export type ServeDecision =
  | { mode: "fallback" }
  | { mode: "redirect"; to: string }
  | { mode: "artifact"; page: PageEntity; pdf: PagePdf }
  | { mode: "site"; page: PageEntity }

export type ServeInput = {
  // raw incoming path segments used for the canonical compare; [] for /id/:user_id.
  incoming: string[]
  // route-specific lookup (handler lowercases when building the index key).
  resolve: () => Promise<PageEntity | null>
  // the page's canonical display segments (e.g. [display_username, display_name]).
  display_of: (page: PageEntity) => string[]
  load_pdf: (page_id: number) => Promise<PagePdf | null>
}

type Ctx = ServeInput & {
  page: PageEntity | null
  redirect_to: string | null
  pdf: PagePdf | null
}

export const serving_machine = setup({
  types: {
    input: {} as ServeInput,
    context: {} as Ctx,
    output: {} as ServeDecision,
  },
  actors: {
    resolve: fromPromise(
      ({ input }: { input: { resolve: ServeInput["resolve"] } }) =>
        input.resolve(),
    ),
    load_pdf: fromPromise(
      ({ input }: {
        input: { page_id: number; load_pdf: ServeInput["load_pdf"] }
      }) => input.load_pdf(input.page_id),
    ),
  },
  guards: {
    page_found: (_, params: { page: PageEntity | null }) => params.page !== null,
    blob_found: (_, params: { pdf: PagePdf | null }) => params.pdf !== null,
    needs_redirect: ({ context }) => context.redirect_to !== null,
    is_pdf: ({ context }) => context.page?.kind === "pdf",
  },
}).createMachine({
  context: ({ input }) => ({
    ...input,
    page: null,
    redirect_to: null,
    pdf: null,
  }),
  initial: "resolve",
  states: {
    resolve: {
      invoke: {
        src: "resolve",
        input: ({ context }) => ({ resolve: context.resolve }),
        onDone: [
          {
            guard: {
              type: "page_found",
              params: ({ event }) => ({ page: event.output }),
            },
            actions: assign({ page: ({ event }) => event.output }),
            target: "canonicalize",
          },
          { target: "fallback" },
        ],
        // a resolve failure degrades to the site, never a 500 on the link path.
        onError: { target: "fallback" },
      },
    },
    canonicalize: {
      // compute the canonical redirect (if the incoming casing differs from the
      // stored display value) before deciding how to render.
      entry: assign({
        redirect_to: ({ context }) => {
          if (!context.page) return null
          const canonical = context.display_of(context.page)
          return canonical.join("/") !== context.incoming.join("/")
            ? "/" + canonical.map(encodeURIComponent).join("/")
            : null
        },
      }),
      always: [
        { guard: "needs_redirect", target: "redirect" },
        { guard: "is_pdf", target: "serve_artifact" },
        { target: "render_md" },
      ],
    },
    serve_artifact: {
      invoke: {
        src: "load_pdf",
        input: ({ context }) => ({
          page_id: context.page!._id,
          load_pdf: context.load_pdf,
        }),
        onDone: [
          {
            guard: {
              type: "blob_found",
              params: ({ event }) => ({ pdf: event.output }),
            },
            actions: assign({ pdf: ({ event }) => event.output }),
            target: "artifact_ready",
          },
          // marked pdf but the blob is gone -> degrade to markdown.
          { target: "render_md" },
        ],
        onError: { target: "render_md" },
      },
    },
    redirect: { type: "final" },
    artifact_ready: { type: "final" },
    render_md: { type: "final" },
    fallback: { type: "final" },
  },
  output: ({ context }): ServeDecision => {
    if (!context.page) return { mode: "fallback" }
    if (context.redirect_to) return { mode: "redirect", to: context.redirect_to }
    if (context.pdf) {
      return { mode: "artifact", page: context.page, pdf: context.pdf }
    }
    return { mode: "site", page: context.page }
  },
})

// Run the machine to its final state and return the serving decision.
export const decide_serve = (input: ServeInput): Promise<ServeDecision> =>
  toPromise(createActor(serving_machine, { input }).start())
