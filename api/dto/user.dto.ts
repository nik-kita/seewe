import { z } from "zod"

export const UserDto = z.object({
  _id: z.number().int().optional(),
  email: z.string().email(),
  name: z.string().optional(),
  // raw-case display username; what links redirect to and what we show.
  nik: z.string().min(3).max(32).optional(),
  // lowercased `nik`, the indexed key for case-insensitive lookup + uniqueness
  // (see normalize_username / seewe-core-link-concept).
  nik_lc: z.string().optional(),
})

export const UserEntityDto = UserDto.pick({
  _id: true,
  email: true,
}).required().merge(UserDto.pick({
  name: true,
  nik: true,
  nik_lc: true,
}))

export type UserEntity = z.infer<typeof UserEntityDto>
export type User = z.infer<typeof UserDto>
