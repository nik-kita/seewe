import { z } from "zod"

export const MdCvDto = z.object({
  user_id: z.number(),
  // which representation is served. "md" renders markdown->html (legacy
  // default). "pdf" serves an uploaded file from `_dev_md_cv_pdf`. Exclusive:
  // only one is served at a time, but `md` is kept so switching is reversible.
  kind: z.enum(["md", "pdf"]).default("md"),
  // upload timestamp of the current pdf; doubles as a cache-busting version so
  // the public-page pdf cache key changes whenever the file is replaced.
  pdf_version: z.number().optional(),
  // optional now: a "pdf" cv may have no markdown. read as `md ?? ""`.
  md: z.string().optional(),
  // free-form CSS provided by the user; applied as-is on the public page
  css: z.string().optional(),
  // vestigial: kept optional so legacy records still validate. Rendering now
  // uses `md` + `css`, not pre-generated html.
  html: z.string().optional(),
  _id: z.number().optional(),
  is_published: z.boolean(),
  // user with username can give names to own cv
  name: z.string().optional(),
  // user without username can have 1 default cv by his own user_id
  as_default_by_user_id: z.number().optional(),
  // user with username can have 1 default cv by his username (instead the list of his cvs will be shown)
  as_default_by_username: z.string().optional(),
  // user with username can have multyple cv with names with compound uniquness ([username, cv_name])
  as_regulary_by_name_username: z.array(z.string()).length(2).optional(),
})

export const MdCvEntityDto = MdCvDto.omit({ _id: true }).extend({
  _id: z.number(),
})

// the uploaded pdf blob, stored in its own collection (keyed by mdcv_id) so the
// large bytes are never dragged along when reading the cv record itself.
export const MdCvPdfDto = z.object({
  mdcv_id: z.number(),
  bytes: z.instanceof(Uint8Array),
  filename: z.string().optional(),
  size: z.number(),
  uploaded_at: z.number(),
})

export type MdCv = z.infer<typeof MdCvDto>
export type MdCvEntity = z.infer<typeof MdCvEntityDto>
export type MdCvPdf = z.infer<typeof MdCvPdfDto>
