// Dump the live Deno KV to a local v8-serialized file, as a restore point
// before the share-link rebrand (see task pivot-share-link-service) and as the
// input for the kv-restore-migrate task.
//
// Dumps at the RAW kv level (`kv.list({ prefix: [] })`), NOT through kvdex, so
// index entries and the chunked/serialized `_dev_md_cv_pdf` blob parts are
// captured byte-for-byte. node:v8 serialize is lossless for the value types KV
// stores (string, number, bigint, boolean, Uint8Array, Map, plain objects).
//
// Env (put in api/.env or the shell):
//   KV_CONNECT_URL          remote connect url, e.g.
//                           https://api.deno.com/databases/<DB_ID>/connect
//                           (omit to dump the local kv via Deno.openKv())
//   DENO_KV_ACCESS_TOKEN    Deno Deploy access token; read automatically by
//                           Deno.openKv when connecting to a remote url
//
// Run (from api/):
//   deno run -A dev/kv_dump.ts

import { serialize } from "node:v8"
import { join } from "@std/path"
import { load_env } from "../utils/load_env.util.ts"

await load_env({ make_export_to_Deno_env: true })

type DumpEntry = {
  key: Deno.KvKey
  value: unknown
  versionstamp: string
}

const connect_url = Deno.env.get("KV_CONNECT_URL")?.trim() || undefined

if (connect_url && !Deno.env.get("DENO_KV_ACCESS_TOKEN")) {
  console.error(
    "KV_CONNECT_URL is set but DENO_KV_ACCESS_TOKEN is missing; " +
      "remote connect will fail.",
  )
  Deno.exit(1)
}

const kv = await Deno.openKv(connect_url)

const entries: DumpEntry[] = []
const counts_by_prefix = new Map<string, number>()

for await (const entry of kv.list({ prefix: [] })) {
  entries.push({
    key: entry.key,
    value: entry.value,
    versionstamp: entry.versionstamp,
  })
  const prefix = String(entry.key[0] ?? "<root>")
  counts_by_prefix.set(prefix, (counts_by_prefix.get(prefix) ?? 0) + 1)
}

kv.close()

const out_dir = join(import.meta.dirname ?? ".", "kv-dumps")
await Deno.mkdir(out_dir, { recursive: true })

const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const target = connect_url ? "remote" : "local"
const out_path = join(out_dir, `kv-dump.${target}.${stamp}.v8`)

// node:v8 returns a Buffer (SharedArrayBuffer-backed in the type); re-wrap into
// a plain ArrayBuffer-backed Uint8Array for Deno.writeFile.
await Deno.writeFile(out_path, new Uint8Array(serialize(entries)))

console.log(`dumped ${entries.length} entries from ${target} kv -> ${out_path}`)
for (const [prefix, count] of [...counts_by_prefix].sort()) {
  console.log(`  ${prefix}: ${count}`)
}
