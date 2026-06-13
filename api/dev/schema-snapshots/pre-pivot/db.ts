import { collection, kvdex } from "jsr:@olli/kvdex"
import { z } from "zod"
import { MdCvDto, MdCvPdfDto } from "./dto/md-cv.dto.ts"
import { UserDto } from "./dto/user.dto.ts"

const kv = await Deno.openKv()
const MdCvDtoWithPossibilityToUpdateUsernameCvNamePair = MdCvDto.omit({
  as_regulary_by_name_username: true,
}).merge(z.object({
  as_regulary_by_name_username: z.array(z.string()).optional(),
}))

export const db = kvdex(kv, {
  _dev_users: collection(UserDto, {
    indices: {
      email: "primary",
      _id: "primary",
      nik: "primary",
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
})
