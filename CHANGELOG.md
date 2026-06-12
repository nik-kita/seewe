# Changelog

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
