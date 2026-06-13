// Restore a v8 dump produced by dev/kv_dump.ts back into a Deno KV. For now this
// is a VERBATIM restore: it writes every dumped entry back unchanged, rebuilding
// kvdex's exact state (records, indices, chunked `_dev_md_cv_pdf` blob parts).
//
// The old -> new schema transformation for the share-link rebrand is NOT done
// here yet: it plugs into `transform_entry` below, which is currently identity.
// See task kv-restore-migrate / pivot-share-link-service.
//
// Args:
//   <dump-file>   path to a .v8 dump; defaults to the newest file in
//                 dev/kv-dumps/
//
// Env:
//   KV_RESTORE_TARGET     target kv: a Deno Deploy connect url, a local sqlite
//                         path, or omitted to use the default local kv
//   DENO_KV_ACCESS_TOKEN  required when KV_RESTORE_TARGET is a remote url
//   RESTORE_FORCE=1       allow restoring into a target that is not empty
//
// Run (from api/):
//   deno run -A dev/kv_restore.ts [dump-file]

import { deserialize } from "node:v8"
import { join } from "@std/path"
import { load_env } from "../utils/load_env.util.ts"

await load_env({ make_export_to_Deno_env: true })

type DumpEntry = {
  key: Deno.KvKey
  value: unknown
  versionstamp: string
}

// Seam for the future old->new schema migration. Return the entry to write, or
// null to drop it. Identity today (verbatim restore).
const transform_entry = (entry: DumpEntry): DumpEntry | null => entry

const newest_dump = async (): Promise<string> => {
  const dir = join(import.meta.dirname ?? ".", "kv-dumps")
  let latest = ""
  for await (const f of Deno.readDir(dir)) {
    if (f.isFile && f.name.endsWith(".v8") && f.name > latest) latest = f.name
  }
  if (!latest) throw new Error(`no .v8 dump found in ${dir}`)
  return join(dir, latest)
}

const dump_path = Deno.args[0] ?? await newest_dump()
const bytes = await Deno.readFile(dump_path)
const entries = deserialize(bytes) as DumpEntry[]

const target = Deno.env.get("KV_RESTORE_TARGET")?.trim() || undefined
const is_remote = !!target && /^https?:\/\//.test(target)

if (is_remote && !Deno.env.get("DENO_KV_ACCESS_TOKEN")) {
  console.error(
    "KV_RESTORE_TARGET is a remote url but DENO_KV_ACCESS_TOKEN is missing.",
  )
  Deno.exit(1)
}

const kv = await Deno.openKv(target)

// Guard: refuse to write into a non-empty target unless forced, so a restore
// can't silently merge on top of live data.
if (Deno.env.get("RESTORE_FORCE") !== "1") {
  let existing = 0
  for await (const _ of kv.list({ prefix: [] }, { limit: 1 })) existing++
  if (existing > 0) {
    kv.close()
    console.error(
      `target kv is not empty; refusing to restore. Set RESTORE_FORCE=1 to ` +
        `override, or point KV_RESTORE_TARGET at a fresh kv.`,
    )
    Deno.exit(1)
  }
}

let written = 0
let dropped = 0
for (const entry of entries) {
  const out = transform_entry(entry)
  if (!out) {
    dropped++
    continue
  }
  await kv.set(out.key, out.value)
  written++
}

kv.close()

const where = target ?? "default local"
console.log(
  `restored ${written} entries into ${where} kv from ${dump_path}` +
    (dropped ? ` (${dropped} dropped by transform)` : ""),
)
