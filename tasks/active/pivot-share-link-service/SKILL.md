---
name: pivot-share-link-service
description: Pivot seewe from a CV-specific host to a generic share-page-via-link service (API-first, full rename). Load when reworking the mdcv domain, public serving, or the render machine toward generic shareable links.
created: 2026-06-13
updated: 2026-06-14
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
(save/default/named/pdf, 12/12 smoke); 4a render machine [[016.log]] [[017.log]];
4c MACHINE rebuilt as the page-serving machine `serving_machine.ts` ([[018.log]],
14 tests) — owns resolve -> canonical display/lc redirect ->
render(artifact|site|degrade)|fallback, IO injected; 4b user nik lc/display split
[[019.log]] (`normalize_username`, `nik_lc` index, `find_by_nik_lc`, lc
uniqueness; 10/10 smoke); 4c handler `page_subserver.tsx` [[020.log]] (3 routes ->
serving_machine, ServeDecision->Response, not-found nuances; 12/12 integration
smoke; NOT mounted yet); 4d CDN cache headers `page_cache.ts` [[021.log]]
(`Deno-CDN-Cache-Control` s-maxage env + `Deno-Cache-Tag` page-/user- on
artifact/site only; 18 tests). SLICE 4 COMPLETE. Slice 5 invalidate-on-write
[[022.log]] — purge wired into all page_service mutations; slice 6 routers
[[023.log]] — `/v1/page` (8 routes) mounted alongside `/v1/mdcv`, +
page_service.rename/remove (fixed a kvdex array-merge slug-corruption bug). 22
tests. Slice 7 cutover CODE parts done [[024.log]]: mount swapped in mod.ts
(page_subserver replaces spa_subserver; legacy spa_subserver/md-cv_service left
in tree, dead on public path); nik-rename cascade moved off `_dev_md_cv` to
`page_service.cascade_user_rename` (rebuilds default + named lc keys w/
arrays:"replace", raw display_username, purge_user). check clean, 22/22 tests,
10/10 cascade smoke.

Slice 7 OPS — data move split into PRODUCE (now) + APPLY (deferred)
[[025.decision]]. PRODUCE done [[026.log]]: dumped live remote KV (181 entries,
gitignored), extracted `db.ts` into a `make_db(kv)` factory, added
`api/dev/kv_transform.ts` (replay dump through kvdex -> write `_dev_page`/
`_dev_page_pdf` + backfill `nik_lc` -> raw-dump new-schema collections as a
**fixture**). Produced + verified `kv-fixture.page.<stamp>.v8` (gitignored): 26
pages, 2 pdfs (blob reassembled), 6/11 users nik_lc'd; all default/named links +
case-insensitive lookups resolve, 3 legacy orphans preserved. 22/22 tests.

CURRENT: APPLY/restore deferred — `kv_restore.ts` the fixture into remote KV only
AFTER the rebrand (incl. UI) ships + deploys; until then `_dev_page` is empty in
prod. The verbatim dump is the old-schema backup; the fixture is the new-schema
target. Open sub-decision (non-blocking): generalize `kind` beyond md/pdf.
CONFIRMED: deploys on current Deno Deploy (not Classic) -> CDN cache-tag layer
locked, no fallback branch.

Carry-over to preserve in the rename:
- The render-decision logic in `render_cv` (api/spa_subserver/spa_subserver.tsx)
  — `pdf` → serve artifact; else render md→html in `SimpleLayout` (our site);
  missing blob → degrade to md. To be re-expressed as an **xstate machine**:
  resolve → serve_artifact | fallback_to_site (+ degrade edge).
- Custom md renderer, no library [[seewe-custom-markdown-renderer]]; blobs stay
  in serialized collections, KV 64KiB cap [[seewe-kvdex-write-only-validation-and-kv-limits]].

Next: the UI rebrand (frontend `/v1/mdcv` -> `/v1/page`, "CV" -> "page"
language), then deploy, then APPLY the fixture (restore into remote KV).
