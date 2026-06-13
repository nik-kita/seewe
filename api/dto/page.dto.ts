import { z } from "zod"

// A `page` is the generic unit of the share-link service (rename of the CV-era
// `mdcv`). It is reachable by a link that is nothing more than
// `domain/username(/name)`; that link must resolve in ONE direct index get
// (see task pivot-share-link-service / memory seewe-core-link-concept).
//
// Identity segments are stored TWICE: a lowercased, INDEXED form that backs the
// routing lookups (and uniqueness/reserved checks), and a raw-case `display_*`
// form (unindexed) that is rendered and used for the canonical redirect.
export const PageDto = z.object({
  _id: z.number().optional(),
  user_id: z.number(),

  // --- representation ---
  // "md" renders markdown->html (legacy default); "pdf" serves an uploaded file
  // from `_dev_page_pdf`. `md` is kept on switch so reverting is non-destructive.
  kind: z.enum(["md", "pdf"]).default("md"),
  // optional: a "pdf" page may have no markdown. read as `md ?? ""`.
  md: z.string().optional(),
  // free-form CSS provided by the user; applied as-is on the public page.
  css: z.string().optional(),
  // upload timestamp of the current pdf; doubles as a cache-busting version.
  pdf_version: z.number().optional(),

  is_published: z.boolean(),

  // --- display values (raw case, NOT indexed, NOT searched) ---
  // what we render and what the canonical link redirects to.
  display_username: z.string().optional(),
  display_name: z.string().optional(),

  // --- routing keys (all LOWERCASED; these are the kvdex indices) ---
  // present on the single page a nik-less user serves at `/id/:user_id`.
  default_by_user_id: z.number().optional(),
  // present on the page a named user serves at `/:username` (lc nik).
  default_by_username: z.string().optional(),
  // present on a named page served at `/:username/:name` ([lc nik, lc name]).
  by_username_and_name: z.array(z.string()).length(2).optional(),
})

export const PageEntityDto = PageDto.omit({ _id: true }).extend({
  _id: z.number(),
})

// what a caller may send when creating/updating a page. Identity/routing fields
// are derived server-side from the user + name, never accepted from the client.
export const PageInputDto = z.object({
  md: z.string().optional(),
  css: z.string().optional(),
  is_published: z.boolean(),
  // a named page's name (raw display); only meaningful for a user with a nik.
  name: z.string().optional(),
})

// the uploaded pdf blob, in its own serialized (v8 + chunked) collection keyed by
// page id, so the large bytes are never read while reading the page record.
export const PagePdfDto = z.object({
  page_id: z.number(),
  bytes: z.instanceof(Uint8Array),
  filename: z.string().optional(),
  size: z.number(),
  uploaded_at: z.number(),
})

export type Page = z.infer<typeof PageDto>
export type PageEntity = z.infer<typeof PageEntityDto>
export type PagePdf = z.infer<typeof PagePdfDto>
