---
name: kv-restore-migrate
description: Restore a KV dump into the new generic share-page schema, mapping old CV-shaped records to the new shape. Load when writing the forward migration / restore for the share-link rebrand.
created: 2026-06-13
updated: 2026-06-13
tags: [ops, kv, migration]
relates: [pivot-share-link-service, kv-dump-script]
---

The forward half of the backup gate for [[pivot-share-link-service]]: load a
dump from [[kv-dump-script]] back into KV. Per the user's decision, build it in
two phases — verbatim restore now, schema transform later.

DONE — `api/dev/kv_restore.ts`, verbatim restore, validated locally ([[002.log]]):
- Reads a v8 dump (arg or newest in `dev/kv-dumps/`), `kv.set`s every entry raw
  → kvdex records/indices/chunked blobs rebuilt exactly.
- `transform_entry()` seam (identity today) = where old(CV)→new(page) mapping
  plugs in later.
- Target env-driven `KV_RESTORE_TARGET` (remote | local path | default local);
  `RESTORE_FORCE=1` to allow a non-empty target (else refuses).
- E2E: dump 26 → restore into fresh kv → 26, counts match; guard works.

TODO (deferred, blocked on the new schema in [[pivot-share-link-service]]):
- Fill `transform_entry` with the old→new mapping. Noun decided = `page`
  ([[pivot-share-link-service]] 004.decision): `_dev_users` carries as-is,
  `_dev_md_cv` → `_dev_page`, `_dev_md_cv_pdf` → `_dev_page_pdf` (bytes
  unchanged, re-keyed). Field-for-field since schema is preserved; the rename
  changes kvdex key prefixes, so the transform rewrites `entry.key`, not fields.
- Verify a transformed record still serves via the (new) render machine.
