import { OpenAPIHono } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import { db } from "../../db.ts"
import { PageEntity } from "../../dto/page.dto.ts"
import { AuthenticatedHono } from "../../middlewares/authenticated_only.wrapper.ts"
import { page_service } from "../../services/page_service.ts"
import { delete_page } from "./delete_page.ts"
import { delete_page_pdf } from "./delete_page_pdf.ts"
import { get_my_pages } from "./get_my_pages.ts"
import { get_page } from "./get_page.ts"
import { post_page } from "./post_page.ts"
import { put_page } from "./put_page.ts"
import { put_page_default } from "./put_page_default.ts"
import { put_page_pdf } from "./put_page_pdf.ts"

const MAX_PDF_BYTES = 5 * 1024 * 1024
// %PDF- magic header
const is_pdf = (b: Uint8Array) =>
  b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 &&
  b[4] === 0x2d

// load an owned page or throw the right HTTP error.
const owned_page = async (page_id: number, user_id: number) => {
  const found = await db._dev_page.findByPrimaryIndex("_id", page_id)
  const page = found?.value as PageEntity | undefined
  if (!page) throw new HTTPException(404, { message: "Page not found" })
  if (page.user_id !== user_id) {
    throw new HTTPException(403, { message: "Forbidden" })
  }
  return page
}

export const page_router = new OpenAPIHono<AuthenticatedHono>()
  .openapi(post_page, async (ctx) => {
    const user = ctx.get("user")
    const input = ctx.req.valid("json")

    if (input.make_default) {
      const res = await page_service.save_as_default(input, user)
      if (!res.ok) throw new HTTPException(500, { message: "Failed to save" })
      return ctx.json({ _id: res.data })
    }

    if (!user.nik) {
      throw new HTTPException(400, {
        message: "User has no nik, so can only have a single default page",
      })
    }
    if (!input.name) {
      throw new HTTPException(400, {
        message: "To save a non-default page, name is required",
      })
    }
    const res = await page_service.save(input, user)
    if (!res.ok) throw new HTTPException(500, { message: "Failed to save" })
    return ctx.json({ _id: res.data })
  })
  .openapi(put_page, async (ctx) => {
    const user = ctx.get("user")
    const { page_id } = ctx.req.valid("param")
    const page = await owned_page(page_id, user._id)

    const patch = ctx.req.valid("json")
    await page_service.update(page_id, patch)
    // a named page's public slug is [username, name]; keep it in sync on rename.
    if (patch.name && user.nik && page.by_username_and_name) {
      await page_service.rename(page_id, user, patch.name)
    }
    return ctx.json({ ok: true, data: null })
  })
  .openapi(put_page_default, async (ctx) => {
    const user = ctx.get("user")
    const { page_id } = ctx.req.valid("param")
    const { is_default } = ctx.req.valid("json")

    if (!user.nik) {
      throw new HTTPException(400, {
        message: "User without a username can only have a single default page",
      })
    }
    const res = await page_service.toggle_default(is_default, { page_id, user })
    if (!res.ok) throw new HTTPException(404, { message: "Page not found" })
    return ctx.json({ ok: true, data: null })
  })
  .openapi(get_page, async (ctx) => {
    const user = ctx.get("user")
    const { page_id } = ctx.req.valid("param")
    const page = await owned_page(page_id, user._id)
    return ctx.json(page)
  })
  .openapi(delete_page, async (ctx) => {
    const user = ctx.get("user")
    const { page_id } = ctx.req.valid("param")
    await owned_page(page_id, user._id)
    await page_service.remove(page_id, user)
    return ctx.newResponse(null, 204)
  })
  .openapi(get_my_pages, async (ctx) => {
    const user = ctx.get("user")
    const pages = await db._dev_page.findBySecondaryIndex("user_id", user._id)
    return ctx.json({
      items: pages.result.map((p) => p.value as PageEntity),
    })
  })
  .openapi(put_page_pdf, async (ctx) => {
    const user = ctx.get("user")
    const { page_id } = ctx.req.valid("param")
    await owned_page(page_id, user._id)

    const bytes = new Uint8Array(await ctx.req.arrayBuffer())
    if (bytes.byteLength === 0) {
      throw new HTTPException(400, { message: "Empty body" })
    }
    if (bytes.byteLength > MAX_PDF_BYTES) {
      throw new HTTPException(413, { message: "PDF too large (max 5MB)" })
    }
    if (!is_pdf(bytes)) {
      throw new HTTPException(400, { message: "Not a PDF file" })
    }

    const res = await page_service.set_pdf({
      page_id,
      bytes,
      filename: ctx.req.header("x-filename"),
    })
    if (!res.ok) throw new HTTPException(500, { message: "Failed to store PDF" })
    return ctx.json({ ok: true })
  })
  .openapi(delete_page_pdf, async (ctx) => {
    const user = ctx.get("user")
    const { page_id } = ctx.req.valid("param")
    await owned_page(page_id, user._id)
    await page_service.remove_pdf(page_id)
    return ctx.newResponse(null, 204)
  })
