---
name: pivot-share-link-service
description: Pivot seewe from a CV-specific host to a generic share-page-via-link service (API-first, full rename). Load when reworking the mdcv domain, public serving, or the render machine toward generic shareable links.
created: 2026-06-13
updated: 2026-06-13
tags: [product, architecture, pivot]
relates: [kv-dump-script, kv-restore-migrate]
---

Reframe the product: today everything is CV-shaped (`mdcv` records, `/v1/mdcv`,
"Markdown CV" / "PDF CV"). The pivot makes the core unit a generic **shared page
reachable by a link**; a CV becomes one content type.

Decided ([[002.decision]]): **full rebrand**, **API-only** scope (UI rebrand
deferred, taken as given), gated behind a **KV backup + forward migration**.

BLOCKED on subtasks (must land before any `mdcv` rename):
- [[kv-dump-script]] — dump live KV via `ACCESS_TOKEN` (remote connect).
- [[kv-restore-migrate]] — restore a dump into the new generic schema, mapping
  old CV records → new page shape.

Carry-over to preserve in the rename:
- The render-decision logic in `render_cv` (api/spa_subserver/spa_subserver.tsx)
  — `pdf` → serve artifact; else render md→html in `SimpleLayout` (our site);
  missing blob → degrade to md. To be re-expressed as an **xstate machine**:
  resolve → serve_artifact | fallback_to_site (+ degrade edge).
- Custom md renderer, no library [[seewe-custom-markdown-renderer]]; blobs stay
  in serialized collections, KV 64KiB cap [[seewe-kvdex-write-only-validation-and-kv-limits]].

Next: complete the two subtasks, then unblock and decompose the rename
(collection/routes/DTO/service rename + render machine + migration apply).
