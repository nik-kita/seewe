import { createRoute } from "@hono/zod-openapi"
import { z } from "zod"
import { authenticated_only_wrapper } from "../../middlewares/authenticated_only.wrapper.ts"

export const put_page_default = authenticated_only_wrapper(createRoute({
  method: "put",
  path: "/:page_id/default",
  request: {
    params: z.object({
      page_id: z.number({ coerce: true }),
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            is_default: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Default flag toggled for the page",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.boolean(),
            data: z.null(),
          }),
        },
      },
    },
  },
}))
