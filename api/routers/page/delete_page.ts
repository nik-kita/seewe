import { createRoute } from "@hono/zod-openapi"
import { z } from "zod"
import { authenticated_only_wrapper } from "../../middlewares/authenticated_only.wrapper.ts"

export const delete_page = authenticated_only_wrapper(createRoute({
  method: "delete",
  path: "/:page_id",
  request: {
    params: z.object({
      page_id: z.number({ coerce: true }),
    }),
  },
  responses: {
    204: {
      description: "Page deleted (no content)",
    },
  },
}))
