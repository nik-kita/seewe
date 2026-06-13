import { createRoute } from "@hono/zod-openapi"
import { z } from "zod"
import { authenticated_only_wrapper } from "../../middlewares/authenticated_only.wrapper.ts"

// Remove the pdf and revert the page to markdown rendering. The stored `md` is
// kept, so this is a non-destructive switch back.
export const delete_page_pdf = authenticated_only_wrapper(createRoute({
  method: "delete",
  path: "/:page_id/pdf",
  request: {
    params: z.object({
      page_id: z.number({ coerce: true }),
    }),
  },
  responses: {
    204: { description: "PDF removed; page reverted to markdown" },
  },
}))
