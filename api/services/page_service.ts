import { db } from "../db.ts"
import { Page } from "../dto/page.dto.ts"
import { UserEntity } from "../dto/user.dto.ts"
import { unique_incremental_timestamp } from "../utils/ui/utils/random.util.ts"

// Service for the `page` domain (rename of md-cv_service). Identity is stored
// twice: lowercased routing keys (`default_by_username`, `by_username_and_name`)
// that back the direct link lookups, and raw-case `display_*` labels used for the
// canonical redirect + rendering (see seewe-core-link-concept). `display_*` is
// only ever read after a routing index matches, so it is set alongside its key
// and left untouched (harmless dead data) when a key is cleared.

const lc = (s: string) => s.trim().toLowerCase()

const ok = <T>(data: T) => ({ ok: true, data }) as const
const fail = () => ({ ok: false, data: null }) as const

// content a caller may set; identity/routing fields are derived here, never taken
// from the caller.
type PageContent = {
  kind?: Page["kind"]
  md?: string
  css?: string
  is_published?: boolean
  name?: string // raw display name (for a named user's named page)
}

const content_of = (input: PageContent): Pick<
  Page,
  "kind" | "md" | "css" | "is_published"
> => ({
  kind: input.kind ?? "md",
  md: input.md,
  css: input.css,
  is_published: input.is_published ?? false,
})

// unset the default markers on the user's current default page (if any). Leaves
// `display_username` in place (dead data unless a key points at it again).
const clear_current_default = async (user_id: number) => {
  await db._dev_page.updateByPrimaryIndex("default_by_user_id", user_id, {
    default_by_user_id: undefined,
    default_by_username: undefined,
  })
}

// Save `input` as the user's single default page (served at /:username for a
// named user, /id/:user_id otherwise). Reuses the user's default slot.
const save_as_default = async (input: PageContent, user: UserEntity) => {
  const _id = unique_incremental_timestamp()

  if (user.nik) {
    await clear_current_default(user._id)
    const record: Page = {
      ...content_of(input),
      _id,
      user_id: user._id,
      default_by_user_id: user._id,
      default_by_username: lc(user.nik),
      display_username: user.nik,
    }
    const { _id: _omit, ...update } = record
    const res = await db._dev_page.upsertByPrimaryIndex({
      index: ["_id", _id],
      update,
      set: record,
    })
    return res.ok ? ok(_id) : fail()
  }

  const record: Page = {
    ...content_of(input),
    _id,
    user_id: user._id,
    default_by_user_id: user._id,
  }
  const { default_by_user_id: _omit, ...update } = record
  const res = await db._dev_page.upsertByPrimaryIndex({
    index: ["default_by_user_id", user._id],
    update,
    set: record,
  })
  return res.ok ? ok(_id) : fail()
}

// Save `input` as a page. A named user creates a NAMED page (needs a name); a
// nik-less user can only have the single default page.
const save = async (input: PageContent, user: UserEntity) => {
  if (!user.nik) return save_as_default(input, user)

  if (!input.name) return fail()

  const _id = unique_incremental_timestamp()
  const record: Page = {
    ...content_of(input),
    _id,
    user_id: user._id,
    display_username: user.nik,
    display_name: input.name,
    by_username_and_name: [lc(user.nik), lc(input.name)],
  }
  // primary index on the compound => add fails if [username, name] is taken.
  const res = await db._dev_page.add(record)
  return res.ok ? ok(_id) : fail()
}

// content-only update (md/css/kind/is_published); never touches identity/routing.
const update = async (_id: number, patch: PageContent) => {
  const res = await db._dev_page.updateByPrimaryIndex("_id", _id, content_of({
    kind: patch.kind,
    md: patch.md,
    css: patch.css,
    is_published: patch.is_published,
  }))
  return res.ok ? ok(null) : fail()
}

// Make `page_id` the user's default, or remove it as default. Clears the user's
// previous default first when turning on.
const toggle_default = async (is_default: boolean, { page_id, user }: {
  page_id: number
  user: UserEntity
}) => {
  const target = await db._dev_page.findByPrimaryIndex("_id", page_id)
  if (!target?.id || target.value.user_id !== user._id) return fail()

  if (is_default) {
    if (target.value.default_by_user_id) return ok(null) // already default
    await clear_current_default(user._id)
  }

  const patch: Partial<Page> = {
    default_by_user_id: is_default ? user._id : undefined,
    default_by_username: is_default && user.nik ? lc(user.nik) : undefined,
  }
  if (is_default && user.nik) patch.display_username = user.nik

  const res = await db._dev_page.updateByPrimaryIndex("_id", page_id, patch)
  return res.ok ? ok(null) : fail()
}

// store (or replace) the uploaded pdf and flip the page to "pdf" kind.
// `pdf_version` is bumped to the upload time so the public-page cache key changes.
const set_pdf = async ({ page_id, bytes, filename }: {
  page_id: number
  bytes: Uint8Array<ArrayBuffer>
  filename?: string
}) => {
  const uploaded_at = Date.now()
  const doc = { page_id, bytes, filename, size: bytes.byteLength, uploaded_at }
  const res = await db._dev_page_pdf.upsertByPrimaryIndex({
    index: ["page_id", page_id],
    update: doc,
    set: doc,
  })
  if (!res.ok) return fail()
  await db._dev_page.updateByPrimaryIndex("_id", page_id, {
    kind: "pdf",
    pdf_version: uploaded_at,
  })
  return ok(null)
}

const get_pdf = async (page_id: number) => {
  const res = await db._dev_page_pdf.findByPrimaryIndex("page_id", page_id)
  return res?.value ?? null
}

// drop the pdf and revert to markdown rendering; the original `md` is untouched.
const remove_pdf = async (page_id: number) => {
  await db._dev_page_pdf.deleteByPrimaryIndex("page_id", page_id)
  await db._dev_page.updateByPrimaryIndex("_id", page_id, {
    kind: "md",
    pdf_version: undefined,
  })
  return ok(null)
}

export const page_service = {
  save,
  save_as_default,
  update,
  toggle_default,
  set_pdf,
  get_pdf,
  remove_pdf,
}
