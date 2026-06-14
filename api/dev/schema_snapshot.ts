// Freeze a "photo" of the current STORED kv schema (the source that defines the
// kvdex collections + their record shapes) into a committed snapshot folder,
// before the share-link rebrand changes it. This is the schema counterpart to
// kv_dump.ts (which photos the data): together they let kv_restore.ts's
// `transform_entry` be written by diffing the old schema photo against the new.
//
// Unlike kv-dumps/ (gitignored real data), schema snapshots ARE committed — git
// is the memory of "what the old shape was".
//
// After the rebrand, update SCHEMA_SOURCES below to the renamed files and run
// again with a new label (e.g. `post-pivot`); diff the two folders to drive the
// transform.
//
// Run (from api/):
//   deno run -A dev/schema_snapshot.ts [label]   # label defaults to a timestamp

import { dirname, join } from "@std/path"

// The files that define the stored kv schema: the kvdex collection/index config
// and the zod DTOs of every stored collection (_dev_users, _dev_page,
// _dev_page_pdf). Paths are relative to api/.
const SCHEMA_SOURCES = [
  "db.ts",
  "dto/user.dto.ts",
  "dto/page.dto.ts",
]

const api_root = join(import.meta.dirname ?? ".", "..")
const label = Deno.args[0] ?? new Date().toISOString().replace(/[:.]/g, "-")
const out_dir = join(import.meta.dirname ?? ".", "schema-snapshots", label)

await Deno.mkdir(out_dir, { recursive: true })

const copied: string[] = []
for (const rel of SCHEMA_SOURCES) {
  const src = join(api_root, rel)
  const dst = join(out_dir, rel)
  await Deno.mkdir(dirname(dst), { recursive: true })
  await Deno.copyFile(src, dst)
  copied.push(rel)
}

const manifest = `# Schema snapshot: ${label}

Frozen copy of the stored Deno KV schema as of ${new Date().toISOString()}.
Taken before / during the share-link rebrand (see task
pivot-share-link-service) so the old shape can be diffed against the new one to
author kv_restore.ts's \`transform_entry\`.

Stored collections at snapshot time: \`_dev_users\`, \`_dev_page\`,
\`_dev_page_pdf\` (blob, serialized v8 + chunked).

Files (verbatim copies, relative to api/):
${copied.map((f) => `- ${f}`).join("\n")}
`

await Deno.writeTextFile(join(out_dir, "MANIFEST.md"), manifest)

console.log(`schema photo "${label}" -> ${out_dir}`)
for (const f of copied) console.log(`  ${f}`)
