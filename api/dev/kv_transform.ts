// Transform a verbatim KV dump (old `_dev_md_cv*` / pre-`nik_lc` schema, produced
// by dev/kv_dump.ts) into a NEW-schema fixture file, WITHOUT touching any live KV.
// The fixture is the intended post-rebrand KV state — `_dev_users` (with `nik_lc`
// backfilled) + `_dev_page` + `_dev_page_pdf` — and is restored later, after the
// rebranding is shipped + deployed, via dev/kv_restore.ts.
//
// How it works (replay through kvdex, not raw key surgery): the dump is restored
// into a THROWAWAY local kv, read back through the real kvdex schema (make_db), and
// re-written as `page` docs via the same write paths the app uses — so the new
// indices and the v8-chunked pdf segments are produced exactly as production would.
// Then only the new-schema collections are raw-dumped as the fixture.
//
// Derivation rules (faithful to the OLD reachability — see md-cv_service.ts):
//   * Routing keys come ONLY from the old index markers that are actually present
//     (`as_regulary_by_name_username`, `as_default_by_*`), never re-derived from
//     `name` — otherwise the several unindexed same-name records (legacy dupes)
//     would collide on the new compound primary key.
//   * Username/name casing: lowercased forms back the new indices; the user's
//     current raw `nik` + the record's `name` become the `display_*` labels.
//   * `html` is dropped; `kind` defaults to "md".
//   * Every user with a `nik` gets `nik_lc = normalize_username(nik)` backfilled,
//     or `/:username` cannot resolve in the new domain.
//
// Args:
//   <dump-file>   path to a .v8 dump; defaults to the newest in dev/kv-dumps/
//
// Run (from api/):
//   deno run -A dev/kv_transform.ts [dump-file]

import { deserialize, serialize } from "node:v8"
import { collection, kvdex } from "jsr:@olli/kvdex"
import { join } from "@std/path"
import { make_db } from "../db.ts"
import { MdCv, MdCvDto, MdCvPdfDto } from "./legacy_md-cv.dto.ts"
import { Page } from "../dto/page.dto.ts"
import { User } from "../dto/user.dto.ts"
import { normalize_username as lc } from "../utils/normalize_username.ts"

type DumpEntry = { key: Deno.KvKey; value: unknown; versionstamp: string }

// The OLD CV-era schema lives ONLY here now (removed from production db.ts). A
// throwaway second kvdex over the same temp kv reads the dumped `_dev_md_cv*`
// records; the new `page`/`users` collections are read+written via make_db.
const make_legacy_db = (kv: Deno.Kv) =>
  kvdex(kv, {
    _dev_md_cv: collection(MdCvDto, {
      indices: {
        _id: "primary",
        user_id: "secondary",
        is_published: "secondary",
        as_default_by_user_id: "primary",
        as_default_by_username: "primary",
        as_regulary_by_name_username: "primary",
      },
    }),
    _dev_md_cv_pdf: collection(MdCvPdfDto, {
      serialize: "v8",
      indices: { mdcv_id: "primary" },
    }),
  })

// collections that make up the new-schema fixture (old `_dev_md_cv*` is dropped).
const FIXTURE_COLLECTIONS = [
  "_dev_users",
  "_dev_page",
  "_dev_page_pdf",
] as const

const newest_dump = async (): Promise<string> => {
  const dir = join(import.meta.dirname ?? ".", "kv-dumps")
  let latest = ""
  for await (const f of Deno.readDir(dir)) {
    // only verbatim dumps (kv-dump.*), never our own kv-fixture.* output.
    if (f.isFile && f.name.startsWith("kv-dump.") && f.name.endsWith(".v8")) {
      if (f.name > latest) latest = f.name
    }
  }
  if (!latest) throw new Error(`no kv-dump.*.v8 found in ${dir}`)
  return join(dir, latest)
}

// Map one old cv record to a new page record. `user` is its owner (for nik casing).
const to_page = (old: MdCv, user: User | undefined): Page => {
  const page: Page = {
    _id: old._id!,
    user_id: old.user_id,
    kind: old.kind ?? "md",
    is_published: !!old.is_published,
  }
  if (old.md !== undefined) page.md = old.md
  if (old.css !== undefined) page.css = old.css
  if (old.pdf_version !== undefined) page.pdf_version = old.pdf_version

  const nik = user?.nik
  const reg = old.as_regulary_by_name_username
  const name = old.name?.trim() ? old.name : reg?.[1]

  // named page: reachable at /:username/:name. Keep the routing key ONLY when the
  // old compound index existed, to avoid colliding legacy same-name dupes.
  if (reg) {
    const uname = nik ?? reg[0]!
    const pname = old.name?.trim() ? old.name : reg[1]!
    page.display_username = uname
    page.display_name = pname
    page.by_username_and_name = [lc(uname), lc(pname)]
  } else if (name) {
    // unindexed named content (legacy/dupe): keep the label, no routing key.
    page.display_name = name
    if (nik) page.display_username = nik
  }

  // default markers (a record may be BOTH a named page and the user's default).
  if (old.as_default_by_user_id !== undefined) {
    page.default_by_user_id = old.as_default_by_user_id
  }
  if (old.as_default_by_username !== undefined) {
    const uname = nik ?? old.as_default_by_username
    page.default_by_username = lc(uname)
    page.display_username = uname
  }
  return page
}

// --- load the dump ------------------------------------------------------------
const dump_path = Deno.args[0] ?? await newest_dump()
const entries = deserialize(await Deno.readFile(dump_path)) as DumpEntry[]

// --- replay into a throwaway kv ----------------------------------------------
const tmp = await Deno.makeTempFile({ suffix: ".kv.sqlite" })
const kv = await Deno.openKv(tmp)
for (const e of entries) await kv.set(e.key, e.value)
const db = make_db(kv)
const legacy = make_legacy_db(kv)

// --- read old, write new ------------------------------------------------------
const { result: users } = await db._dev_users.getMany()
const user_by_id = new Map<number, User>(
  users.map((u) => [u.value._id!, u.value]),
)

const { result: cvs } = await legacy._dev_md_cv.getMany()
let pages = 0
for (const c of cvs) {
  const res = await db._dev_page.add(
    to_page(c.value, user_by_id.get(c.value.user_id)),
  )
  if (!res.ok) throw new Error(`failed to write page for cv ${c.value._id}`)
  pages++
}

const { result: pdfs } = await legacy._dev_md_cv_pdf.getMany()
let pdf_count = 0
for (const p of pdfs) {
  const v = p.value
  const res = await db._dev_page_pdf.add({
    page_id: v.mdcv_id,
    bytes: v.bytes,
    filename: v.filename,
    size: v.size,
    uploaded_at: v.uploaded_at,
  })
  if (!res.ok) throw new Error(`failed to write pdf for cv ${v.mdcv_id}`)
  pdf_count++
}

let backfilled = 0
for (const u of users) {
  if (u.value.nik && !u.value.nik_lc) {
    const res = await db._dev_users.updateByPrimaryIndex("_id", u.value._id!, {
      nik_lc: lc(u.value.nik),
    })
    if (!res.ok) {
      throw new Error(`failed to backfill nik_lc for user ${u.value._id}`)
    }
    backfilled++
  }
}

// --- raw-dump only the new-schema collections as the fixture ------------------
const fixture: DumpEntry[] = []
const counts_by_coll = new Map<string, number>()
for (const coll of FIXTURE_COLLECTIONS) {
  for await (const e of kv.list({ prefix: ["__kvdex__", coll] })) {
    fixture.push({ key: e.key, value: e.value, versionstamp: e.versionstamp })
    counts_by_coll.set(coll, (counts_by_coll.get(coll) ?? 0) + 1)
  }
}

kv.close()
await Deno.remove(tmp).catch(() => {})

const out_dir = join(import.meta.dirname ?? ".", "kv-dumps")
await Deno.mkdir(out_dir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const out_path = join(out_dir, `kv-fixture.page.${stamp}.v8`)
await Deno.writeFile(out_path, new Uint8Array(serialize(fixture)))

console.log(`transformed ${dump_path}`)
console.log(`  pages written:    ${pages} (from ${cvs.length} cvs)`)
console.log(`  pdfs written:     ${pdf_count}`)
console.log(`  users nik_lc'd:   ${backfilled} / ${users.length}`)
console.log(`fixture -> ${out_path} (${fixture.length} raw entries)`)
for (const [coll, n] of [...counts_by_coll].sort()) {
  console.log(`  ${coll}: ${n}`)
}
