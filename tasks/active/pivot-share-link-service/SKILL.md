---
name: pivot-share-link-service
description: Pivot seewe from a CV-specific host to a generic share-page-via-link service (API-first, full rename). Load when reworking the mdcv domain, public serving, or the render machine toward generic shareable links.
created: 2026-06-13
updated: 2026-06-13
tags: [product, architecture, pivot]
relates: [kv-dump-script, kv-restore-migrate]
---

Reframe the product: today everything is CV-shaped (`mdcv` records, `/v1/mdcv`,
"Markdown CV" / "PDF CV"). The pivot makes the core unit a generic **page
reachable by a link**; a CV becomes one content type.

Decided: **full rebrand** ([[002.decision]]), **API-only** scope (UI deferred),
gated behind a KV backup. New noun = **`page`** ([[004.decision]]):
`_dev_md_cv`→`_dev_page`, `/v1/mdcv`→`/v1/page`, `MdCvDto`→`PageDto`,
`mdCv_service`→`page_service`, etc. (full table in 004).

Storage: **keep kvdex** ([[007.decision]], reverses 006). Simplify at the
DATA-MODEL level — explicit collections/indices/record shape tuned to the real
queries, dropping CV-era cruft — not by replacing the library. Zod stays.

Backup subtasks PAUSED (fully specified; do not resurface until resumed or all
else done): [[kv-dump-script]] (data dump + pre-pivot schema photo, done),
[[kv-restore-migrate]] (verbatim restore done; transform deferred).

Concept locked [[008.analysis]] + memory [[seewe-core-link-concept]]: link =
domain/username(/name), resolved first in ONE direct lc-index get; site is
fallback. "Any sacrifice for that link."

Design decided:
- Link cache = Deno Deploy CDN + `Deno-Cache-Tag` (`page-<id>`, `user-<id>`),
  global purge on write; `s-maxage` from `CACHE_S_MAXAGE` env, long default
  ([[011.decision]], supersedes the regional Web-Cache [[010.decision]]).
- Case handling: indexed lowercased `username`/`name` + raw `display_*`; canonical
  302/307 redirect when incoming != display ([[010.decision]]).
- Reserved usernames: generated Set (our slugs + Big Username Blacklist + LDNOOBW),
  exact lc match in nik create/update.

Build order in [[012.plan]]. DONE: slice 1 `page` schema [[013.log]]; slice 2
reserved-usernames guard [[014.log]]; slice 3 `page_service` [[015.log]]
(save/default/named/pdf, 12/12 smoke); slice 4a render machine (xstate) +
tests [[016.log]] [[017.log]] (4/4, `deno task test`). CURRENT: slice 4 remainder — 4b user nik lc/display split (correctness
prereq), 4c page_subserver (resolve + canonical redirect + wire decide_render),
4d CDN cache headers.
Open sub-decision (non-blocking): generalize `kind` beyond md/pdf.
CONFIRMED: the new version deploys on current Deno Deploy (not Classic) -> CDN
cache-tag layer locked, no fallback branch.

Carry-over to preserve in the rename:
- The render-decision logic in `render_cv` (api/spa_subserver/spa_subserver.tsx)
  — `pdf` → serve artifact; else render md→html in `SimpleLayout` (our site);
  missing blob → degrade to md. To be re-expressed as an **xstate machine**:
  resolve → serve_artifact | fallback_to_site (+ degrade edge).
- Custom md renderer, no library [[seewe-custom-markdown-renderer]]; blobs stay
  in serialized collections, KV 64KiB cap [[seewe-kvdex-write-only-validation-and-kv-limits]].

Next: complete the two subtasks, then unblock and decompose the rename
(collection/routes/DTO/service rename + render machine + migration apply).
