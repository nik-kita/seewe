// The single normalization for usernames (and page names): the form used for the
// `nik_lc` / page index keys, the reserved-name check, and link resolution. They
// MUST agree, or a name could be reserved/looked-up inconsistently with how it is
// stored (see seewe-core-link-concept).
export const normalize_username = (raw: string): string => raw.trim().toLowerCase()
