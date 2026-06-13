# Schema snapshot: pre-pivot

Frozen copy of the stored Deno KV schema as of 2026-06-13T01:10:45.449Z.
Taken before / during the share-link rebrand (see task
pivot-share-link-service) so the old shape can be diffed against the new one to
author kv_restore.ts's `transform_entry`.

Stored collections at snapshot time: `_dev_users`, `_dev_md_cv`,
`_dev_md_cv_pdf` (blob, serialized v8 + chunked).

Files (verbatim copies, relative to api/):
- db.ts
- dto/user.dto.ts
- dto/md-cv.dto.ts
