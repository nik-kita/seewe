import { OpenAPIHono } from "@hono/zod-openapi"
import { z } from "zod"
import type { Context } from "hono"
import { config } from "../config.ts"
import { db } from "../db.ts"
import type { PageEntity, PagePdf } from "../dto/page.dto.ts"
import { page_service } from "../services/page_service.ts"
import { users_service } from "../services/users_service.ts"
import { normalize_username } from "../utils/normalize_username.ts"
import { serve_static } from "../utils/serve_static.ts"
import { SimpleLayout } from "../utils/SimpleLayout.tsx"
import { md_to_html } from "../utils/ui/utils/md-to-html.ts"
import { decide_serve, type ServeDecision } from "./serving_machine.ts"

// Public serving for the `page` domain (rename/rework of spa_subserver). The
// serving DECISION is the xstate `serving_machine`; this module owns only request
// parsing, turning the decision into a Response, and the deep not-found nuances
// behind the machine's single `fallback` outcome. CDN cache headers are added in
// a later slice (4d). Mounted at cutover — not wired into mod.ts yet.

// A trailing `.pdf` means "serve and let the browser print to PDF": strip it and
// flip auto_print.
const parse_pdf = (raw: string) => {
  const auto_print = raw.endsWith(".pdf")
  return { value: auto_print ? raw.slice(0, -4) : raw, auto_print }
}

const sanitize_filename = (name: string) => {
  const base = name.replace(/\.pdf$/i, "").replace(/[^a-z0-9._-]/gi, "_")
  return (base || "page") + ".pdf"
}

const serve_artifact = (pdf: PagePdf, auto_print: boolean): Response => {
  const filename = sanitize_filename(pdf.filename || `page-${pdf.page_id}`)
  return new Response(pdf.bytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": auto_print
        ? `attachment; filename="${filename}"`
        : "inline",
    },
  })
}

const render_site = (
  ctx: Context,
  page: PageEntity,
  opts: { link: string; auto_print: boolean },
): Response | Promise<Response> =>
  ctx.html(
    <SimpleLayout link={opts.link} css={page.css} auto_print={opts.auto_print}>
      <div
        class="cv"
        dangerouslySetInnerHTML={{ __html: md_to_html(page.md ?? "") }}
      />
    </SimpleLayout>,
  )

// Translate the machine's decision into a Response. Returns null for `fallback`
// so the route can apply its own not-found handling.
const respond = (
  ctx: Context,
  decision: ServeDecision,
  opts: { link: string; auto_print: boolean },
): Response | Promise<Response> | null => {
  switch (decision.mode) {
    case "redirect":
      // keep the .pdf variant on the canonical URL too.
      return ctx.redirect(decision.to + (opts.auto_print ? ".pdf" : ""), 307)
    case "artifact":
      return serve_artifact(decision.pdf, opts.auto_print)
    case "site":
      return render_site(ctx, decision.page, opts)
    case "fallback":
      return null
  }
}

const page_by = (
  resolve: () => Promise<PageEntity | null>,
  ctx: Context,
  input: {
    incoming: string[]
    display_of: (p: PageEntity) => string[]
    link: string
    auto_print: boolean
  },
) =>
  decide_serve({
    incoming: input.incoming,
    resolve,
    display_of: input.display_of,
    load_pdf: page_service.get_pdf,
  }).then((decision) =>
    respond(ctx, decision, { link: input.link, auto_print: input.auto_print })
  )

export const page_subserver = new OpenAPIHono()
  .get("/id/:user_id", async (ctx) => {
    const { value: raw, auto_print } = parse_pdf(ctx.req.param("user_id"))
    const parsed = z.number({ coerce: true }).safeParse(raw)
    if (!parsed.success) return ctx.notFound()
    const user_id = parsed.data

    const res = await page_by(
      async () =>
        ((await db._dev_page.findByPrimaryIndex("default_by_user_id", user_id))
          ?.value ?? null) as PageEntity | null,
      ctx,
      {
        incoming: [],
        display_of: (p) => p.display_username ? [p.display_username] : [],
        link: config.VITE_API_URL + "/id/" + user_id,
        auto_print,
      },
    )
    if (res) return res

    // fallback: no default page for this id -> if the user has a nik, send them
    // to its canonical username; otherwise nothing to show.
    const user = (await users_service.find_by_id(user_id)).data
    if (user?.nik) {
      return ctx.redirect("/" + user.nik + (auto_print ? ".pdf" : ""), 307)
    }
    return ctx.notFound()
  })
  .get("/:username/:cv_name", async (ctx) => {
    const username_raw = ctx.req.param("username")
    const { value: name_raw, auto_print } = parse_pdf(ctx.req.param("cv_name"))
    const lc_user = normalize_username(username_raw)
    const lc_name = normalize_username(name_raw)

    const res = await page_by(
      async () =>
        ((await db._dev_page.findByPrimaryIndex("by_username_and_name", [
          lc_user,
          lc_name,
        ]))?.value ?? null) as PageEntity | null,
      ctx,
      {
        incoming: [username_raw, name_raw],
        display_of: (p) => [
          p.display_username ?? username_raw,
          p.display_name ?? name_raw,
        ],
        link: config.VITE_API_URL + "/" + username_raw + "/" + name_raw,
        auto_print,
      },
    )
    if (res) return res

    // fallback: named page not found -> if the user exists, go to their default.
    const user = (await users_service.find_by_nik_lc(lc_user)).data
    if (user?.nik) return ctx.redirect("/" + user.nik, 307)
    return ctx.notFound()
  })
  .get("/:username", async (ctx) => {
    const { value: username_raw, auto_print } = parse_pdf(
      ctx.req.param("username"),
    )
    const lc_user = normalize_username(username_raw)

    const res = await page_by(
      async () =>
        ((await db._dev_page.findByPrimaryIndex("default_by_username", lc_user))
          ?.value ?? null) as PageEntity | null,
      ctx,
      {
        incoming: [username_raw],
        display_of: (p) => p.display_username ? [p.display_username] : [
          username_raw,
        ],
        link: config.VITE_API_URL + "/" + username_raw,
        auto_print,
      },
    )
    if (res) return res

    // fallback: no default page -> if the user exists, list their published pages.
    const user = (await users_service.find_by_nik_lc(lc_user)).data
    if (user) {
      const { result } = await db._dev_page.findBySecondaryIndex(
        "user_id",
        user._id,
        { filter: ({ value }) => value.is_published },
      )
      if (result.length > 0) {
        return render_profile(
          ctx,
          user.nik!,
          result.map((r) => r.value as PageEntity),
        )
      }
    }
    return ctx.notFound()
  })
  .get("*", serve_static)

// A user's public landing: their published pages, when they have no default page.
const render_profile = (
  ctx: Context,
  nik: string,
  pages: PageEntity[],
): Response | Promise<Response> =>
  ctx.html(
    <SimpleLayout link={config.VITE_API_URL + "/" + nik} print_pdf={false}>
      <h1>{nik}</h1>
      <ol>
        {pages.map((p) => (
          <li key={p._id}>
            <a
              href={config.VITE_API_URL + "/" + nik + "/" +
                encodeURIComponent(p.display_name ?? String(p._id))}
            >
              <h4>{p.display_name ?? `no. ${p._id}`}</h4>
            </a>
          </li>
        ))}
      </ol>
    </SimpleLayout>,
  )
