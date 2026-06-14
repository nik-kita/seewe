// deno-lint-ignore-file require-await
import { db } from "../db.ts"
import { User, UserEntity } from "../dto/user.dto.ts"
import { is_reserved_username } from "../utils/is_reserved_username.ts"
import { normalize_username } from "../utils/normalize_username.ts"
import { page_service } from "./page_service.ts"
import { unique_incremental_timestamp } from "../utils/ui/utils/random.util.ts"

const find_by = async <T extends ("_id" | "email" | "nik" | "nik_lc")>(
  by: T,
  value: T extends "_id" ? number : string,
) => {
  const find_result = await db._dev_users.findByPrimaryIndex(
    ...([by, value] as ["email" | "nik" | "nik_lc", string]),
  )

  if (!find_result?.id) {
    return {
      ok: false,
      data: null,
    } as const
  }

  return {
    ok: true,
    data: find_result.value as UserEntity,
  } as const
}

const insert = async (user: User) => {
  const _id = unique_incremental_timestamp()
  const full_user = {
    ...user,
    _id,
  }
  const add_result = db._dev_users.add(full_user)

  if (!(await add_result).ok) {
    return {
      ok: false,
      data: null,
    } as const
  }

  return {
    ok: true,
    data: _id,
  } as const
}

const update = async (
  _id: number,
  user: Omit<User, keyof Pick<User, "nik">>,
) => {
  const update_result = await db._dev_users.updateByPrimaryIndex(
    "_id",
    _id,
    user,
  )

  if (!update_result.ok) {
    return {
      ok: false,
      data: null,
    } as const
  }

  return {
    ok: true,
    data: null,
  } as const
}

const list = async () => {
  const users = [] as UserEntity[]
  await db._dev_users.forEach((u) => users.push(u.value as UserEntity))

  return {
    ok: true,
    data: users,
  } as const
}

const add_nik = async (nik: string, user: UserEntity) => {
  if (user.nik) {
    return {
      ok: false,
      data: "User already has nik",
    } as const
  }

  if (is_reserved_username(nik)) {
    return {
      ok: false,
      data: "This nik is reserved",
    } as const
  }

  // uniqueness on the lowercased key, so "Alice" and "alice" can't both exist.
  const nik_lc = normalize_username(nik)
  const already = await db._dev_users.findByPrimaryIndex("nik_lc", nik_lc)

  if (already?.value) {
    return {
      ok: false,
      data: "This nik is already taken",
    } as const
  }

  const db_res = await db._dev_users.updateByPrimaryIndex("_id", user._id, {
    nik,
    nik_lc,
  })

  if (db_res.ok) {
    // a previously nik-less user can only have the single default page; cascade
    // the new nik onto it (sets default_by_username + display_username) so
    // /:username resolves. Mirrors update_nik.
    await page_service.cascade_user_rename(user, nik)

    return {
      ok: true,
      data: null,
    } as const
  }

  return {
    ok: false,
    data: null,
  } as const
}
const update_nik = async (nik: string, user: UserEntity) => {
  const prev_nik = user.nik
  if (!prev_nik) {
    return {
      ok: false,
      data: "User should create nik and then update it",
    } as const
  }

  if (is_reserved_username(nik)) {
    return {
      ok: false,
      data: "This nik is reserved",
    } as const
  }

  const nik_lc = normalize_username(nik)
  const already = await db._dev_users.findByPrimaryIndex("nik_lc", nik_lc)

  if (already?.value) {
    return {
      ok: false,
      data: "This nik is already taken",
    } as const
  }

  const db_res = await db._dev_users.updateByPrimaryIndex("_id", user._id, {
    nik,
    nik_lc,
  })

  if (db_res.ok) {
    // cutover: pages live in `_dev_page` now — cascade the rename there so every
    // page's link + display label follows the new nik (purges the user tag).
    await page_service.cascade_user_rename(user, nik)

    return {
      ok: true,
      data: null,
    } as const
  }

  return {
    ok: false,
    data: null,
  } as const
}

export const users_service = {
  add_nik,
  update_nik,
  find_by_nik: (nik: string) => find_by("nik", nik),
  // case-insensitive lookup for the new page domain (lowercases before matching).
  find_by_nik_lc: (nik: string) => find_by("nik_lc", normalize_username(nik)),
  find_by_id: (_id: number) => find_by("_id", _id),
  find_by_email: (email: string) => find_by("email", email),
  insert,
  update,
  upsert: async (user: Omit<User, keyof Pick<User, "nik">>) => {
    if (user._id) {
      return update(user._id, user)
    }

    return insert(user)
  },
  finsert_by_email: async (
    user: User,
  ) => {
    const found = await users_service.find_by_email(user.email)

    if (found.ok) {
      return {
        ok: true,
        data: found.data as UserEntity,
      }
    }

    const inserted = await users_service.insert(user)

    if (inserted.ok) {
      return {
        ok: true,
        data: {
          ...user,
          _id: inserted.data,
        } as UserEntity,
      } as const
    }

    return {
      ok: false,
      data: null,
    } as const
  },
  list,
}
