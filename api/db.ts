import { collection, kvdex } from "jsr:@olli/kvdex"
import { z } from "zod"
import { PageDto, PagePdfDto } from "./dto/page.dto.ts"
import { UserDto } from "./dto/user.dto.ts"

// kvdex validates the WHOLE value on update; the compound routing key is a
// fixed-length tuple, so relax it to a plain optional array for partial updates
// (e.g. clearing/rewriting it on a nik rename).
const PageDtoForPartialUpdate = PageDto.omit({
  by_username_and_name: true,
}).merge(z.object({
  by_username_and_name: z.array(z.string()).optional(),
}))

// The schema is built by a factory so dev tooling (e.g. dev/kv_transform.ts) can
// open the SAME collections over a throwaway kv without duplicating — and drifting
// from — this definition. The app uses the default-kv instance exported below.
export const make_db = (kv: Deno.Kv) =>
  kvdex(kv, {
    _dev_users: collection(UserDto, {
      indices: {
        email: "primary",
        _id: "primary",
        // `nik` is the raw-case display username; `nik_lc` (lowercased) is the
        // case-insensitive lookup + uniqueness key the link resolution uses.
        nik: "primary",
        nik_lc: "primary",
      },
    }),
    // the `page` domain — the generic share-link unit (the CV-era `_dev_md_cv*`
    // collections were dropped; their data moves over via dev/kv_transform.ts).
    _dev_page: collection(PageDtoForPartialUpdate, {
      indices: {
        _id: "primary",
        user_id: "secondary",
        is_published: "secondary",
        // direct link lookups (all lowercased): /id/:user_id, /:username,
        // /:username/:name respectively.
        default_by_user_id: "primary",
        default_by_username: "primary",
        by_username_and_name: "primary",
      },
    }),
    _dev_page_pdf: collection(PagePdfDto, {
      serialize: "v8",
      indices: {
        page_id: "primary",
      },
    }),
  })

const kv = await Deno.openKv()
export const db = make_db(kv)
