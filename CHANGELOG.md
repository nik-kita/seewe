# Changelog

## 2026-06-13

- Reserve usernames: a user can no longer take a `nik` that collides with the
  site's own routes, infra/role/brand names, or offensive words. Added
  `api/dev/gen_reserved_usernames.ts` (generates a committed
  `api/utils/reserved_usernames.gen.ts` from our `src/pages` route slugs + a
  curated set + The Big Username Blacklist + LDNOOBW), `is_reserved_username`
  (exact, case-insensitive), enforced in `users_service.add_nik`/`update_nik`.
- Add `api/spa_subserver/serving_machine.ts` (share-link rebrand): an xstate
  (`npm:xstate@5`) machine encoding the whole public-page serving decision —
  resolve the link, redirect to the canonical display casing when the incoming
  path differs, then serve the uploaded artifact for a `pdf` page or render
  markdown in the site layout (with a degrade edge when a pdf blob is missing);
  an unresolved link yields a `fallback` decision the handler turns into the
  site. IO (lookup, pdf load) is injected so the machine stays pure. Not wired to
  routes yet. Covered by `serving_machine.test.ts` (14 cases); adds backend test
  tooling (`deno task test` / `just test`, `@std/assert` pinned) — the api had
  none before.
- Add `api/services/page_service.ts` (share-link rebrand): the `page` equivalent
  of the CV service, writing `_dev_page` with the new identity model — lowercased
  routing keys plus raw-case `display_username`/`display_name`. Not wired to
  routes yet.
- Begin the share-link rebrand (`mdcv` -> `page`): add `api/dto/page.dto.ts` and
  the `_dev_page` / `_dev_page_pdf` kvdex collections, alongside the existing
  `_dev_md_cv*` (migrated + dropped at cutover). The page record drops the
  vestigial `html`, splits identity into raw `display_username`/`display_name`
  plus lowercased indexed routing keys (`default_by_username`,
  `by_username_and_name`), and keys the pdf blob by `page_id`. Not served yet.

- Add `api/dev/kv_dump.ts`: dumps the live Deno KV to a local v8-serialized file
  as a backup before the planned share-link rebrand. Connects via env
  (`KV_CONNECT_URL` + `DENO_KV_ACCESS_TOKEN`, or local kv when the url is
  omitted), dumps at the raw kv level (`kv.list({ prefix: [] })`) so kvdex index
  entries and chunked `_dev_md_cv_pdf` blobs are captured verbatim, and writes a
  timestamped file under `api/dev/kv-dumps/` (gitignored — holds real user data).
- Add `api/dev/kv_restore.ts`: restores a `kv_dump.ts` v8 dump back into KV.
  Currently a verbatim restore (raw `kv.set` per entry, rebuilding kvdex records,
  indices and chunked blobs exactly), with a `transform_entry` seam reserved for
  the future old→new schema migration. Target via `KV_RESTORE_TARGET` (remote
  url, local path, or default local kv); refuses a non-empty target unless
  `RESTORE_FORCE=1`.
- Add `api/dev/schema_snapshot.ts`: freezes a committed "photo" of the current
  stored KV schema (`db.ts` + the stored DTOs) under `api/dev/schema-snapshots/
  <label>/`, before the share-link rebrand mutates it. Took the `pre-pivot`
  snapshot. Re-run post-rebrand with a new label and diff to author the restore
  transform.

## 2026-06-12

- New `/pdf-cv` page (linked from the header next to "Markdown CV"): without
  `?id` it creates a CV from an uploaded PDF, with the name pre-filled from the
  filename and editable before creating; with `?id=<mdcv_id>` it manages an
  existing CV's PDF (replace file, rename, remove PDF to revert to markdown).
- Dashboard: "Edit" is now representation-aware — markdown CVs open the markdown
  editor, PDF CVs open `/pdf-cv?id=...`; the "New CV from PDF" button navigates
  to the new page instead of an inline picker.
- Dashboard: the Published/Default switches carry small captions ("public link
  works / is off", "shown at /username") so their effect is visible without
  hovering.
- `PUT /v1/mdcv/:mdcv_id` with a new `name` now also updates the public slug
  (`as_regulary_by_name_username`) for named CVs, so renaming moves the link
  instead of leaving it on the old name.

- Dashboard: replace the bare Published/Default checkboxes with PrimeVue
  ToggleSwitch controls (Aura theme); each flip now asks for confirmation via an
  anchored ConfirmPopup before the request is sent, and the rows carry tooltips
  explaining what each switch does. `ConfirmationService` is now registered in
  `src/main.ts`.
- Dashboard: add "New CV from PDF" button — creates a CV record (empty markdown)
  and uploads the file in one flow, so a PDF-only CV no longer requires going
  through the markdown editor first. No backend change: `POST /v1/mdcv` +
  `PUT /v1/mdcv/:id/pdf`.
- Dashboard: per-row Upload/Replace PDF is now a proper button (was an
  underlined text link, easy to miss); all PDF controls share one hidden file
  picker and disable while an upload is in flight.

- Add uploadable PDF representation for CVs. A CV is now either `kind: "md"`
  (markdown rendered to HTML, the legacy default) or `kind: "pdf"` (an uploaded
  file). The two are mutually exclusive per slug, but the markdown is kept on
  switch so reverting is non-destructive.
- `PUT /v1/mdcv/:mdcv_id/pdf` stores the uploaded file (raw `application/pdf`
  body, `%PDF-` magic check, 5MB cap) and flips the CV to `kind: "pdf"`;
  `DELETE /v1/mdcv/:mdcv_id/pdf` removes it and reverts to markdown.
- PDF bytes live in a separate serialized KV collection (`_dev_md_cv_pdf`,
  chunked via kvdex `serialize: "v8"`), keyed by CV id, so the blob is never
  read while rendering the CV record.
- Public serving: for a `pdf` CV, `/slug` shows the file inline and `/slug.pdf`
  downloads it; `md` CVs are unchanged (HTML render, `.pdf` still triggers
  browser print-to-PDF as the fallback).
- PDF responses are read-through cached via the Deno Web Cache API, keyed by
  `id/pdf_version/variant`, so hits skip the KV blob read and re-uploads orphan
  stale entries automatically.
- Dashboard CV list shows an MD/PDF badge and Upload/Replace/Remove PDF
  controls.

- Add `just check`: type-checks frontend with `vue-tsc` and backend with
  `deno check mod.ts`, each in its correct scope. Do not run `deno check .`
  repo-wide — Deno cannot parse Vue SFCs (`primePlugin` loses its `as const`
  tuple) and does not resolve `vite/client` ambient types (`import.meta.url`),
  producing false errors on frontend files that `vue-tsc` checks correctly.

- Fix `deno check` (5 pre-existing type errors): openapi router now imports
  `DotenvFile` from the api-local `env.d.ts` instead of the root frontend one
  (which pulls unresolvable `vite/client` types); add `deno.unstable` to the api
  `lib` so `Deno.openKv` types resolve; `convert_crypto_key.util` returns
  `Uint8Array<ArrayBuffer>` to satisfy `crypto.subtle.importKey`.

### Notes

- Legacy CV records have no `kind`; they are read as `"md"` defensively, so no
  data migration is required.
- The new endpoints are not in the generated typed client yet — run
  `just gen-types` (against a running server) to include them.
