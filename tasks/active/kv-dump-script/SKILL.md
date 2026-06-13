---
name: kv-dump-script
description: Script to dump the live Deno KV (remote, via ACCESS_TOKEN) to a local file before the share-link rebrand. Load when writing/running the KV backup or connecting to remote KV.
created: 2026-06-13
updated: 2026-06-13
tags: [ops, kv, migration]
relates: [pivot-share-link-service, kv-restore-migrate]
---

Backup gate for the rebrand ([[pivot-share-link-service]]); produces the input
for [[kv-restore-migrate]].

DONE — script `api/dev/kv_dump.ts` implemented + validated locally ([[002.log]]):
- Env-driven connect: `KV_CONNECT_URL` + `DENO_KV_ACCESS_TOKEN` (remote), or
  omit url for local kv. No secrets/DB id hardcoded.
- v8 binary dump via `node:v8` (lossless incl. `Uint8Array` blob chunks).
- Raw-level (`kv.list({ prefix: [] })`) — captures everything under kvdex's
  `__kvdex__` namespace incl. index entries + chunked `_dev_md_cv_pdf` blobs.
- Output `api/dev/kv-dumps/*.v8` (gitignored). `deno check` clean; 26-entry
  local dump round-tripped via `deserialize`.

Remaining: the user runs it against the real remote KV (supply `KV_CONNECT_URL`
+ `DENO_KV_ACCESS_TOKEN`). Once a remote dump exists, this is `done` and
[[kv-restore-migrate]] can consume the v8 format.
