import { normalize_username } from "./normalize_username.ts"
import { RESERVED_USERNAMES } from "./reserved_usernames.gen.ts"

// True if `candidate` may NOT be taken as a nik. Matches the generated set on the
// normalized form — the same normalization used when a nik is stored (`nik_lc`)
// and when a link is resolved (see seewe-core-link-concept). Exact match only: we
// deliberately do not substring/leet match, to avoid the Scunthorpe problem
// (blocking legitimate names that merely contain a bad word).
export const is_reserved_username = (candidate: string): boolean =>
  RESERVED_USERNAMES.has(normalize_username(candidate))
