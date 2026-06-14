import { collection, kvdex } from "jsr:@olli/kvdex"
import { z } from "zod"
import { MdCvDto, MdCvPdfDto } from "./dto/md-cv.dto.ts"
import { PageDto, PagePdfDto } from "./dto/page.dto.ts"
import { UserDto } from "./dto/user.dto.ts"

const MdCvDtoWithPossibilityToUpdateUsernameCvNamePair = MdCvDto.omit({
  as_regulary_by_name_username: true,
}).merge(z.object({
  as_regulary_by_name_username: z.array(z.string()).optional(),
}))

// kvdex validates the WHOLE value on update; the compound routing key is a
// fixed-length tuple, so relax it to a plain optional array for partial updates
// (e.g. clearing/rewriting it on a nik rename). Mirrors the mdcv handling above.
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
        // `nik` (raw) stays indexed for the still-running old domain; `nik_lc`
        // (lowercased) is the new case-insensitive lookup + uniqueness key.
        nik: "primary",
        nik_lc: "primary",
      },
    }),
    _dev_md_cv: collection(MdCvDtoWithPossibilityToUpdateUsernameCvNamePair, {
      indices: {
        _id: "primary",
        user_id: "secondary",
        is_published: "secondary",
        as_default_by_user_id: "primary",
        as_default_by_username: "primary",
        as_regulary_by_name_username: "primary",
      },
    }),
    // serialized so the pdf bytes are v8-encoded + chunked across kv entries,
    // bypassing the 64KiB per-value limit.
    _dev_md_cv_pdf: collection(MdCvPdfDto, {
      serialize: "v8",
      indices: {
        mdcv_id: "primary",
      },
    }),
    // --- new `page` domain (share-link rebrand). Lives alongside `_dev_md_cv*`
    // during the build; the old collections are migrated + dropped at cutover. ---
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
