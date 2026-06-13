import { createRoute } from "@hono/zod-openapi"
import { z } from "zod"
import { PageEntityDto } from "../../dto/page.dto.ts"
import { authenticated_only_wrapper } from "../../middlewares/authenticated_only.wrapper.ts"

export const get_page = authenticated_only_wrapper(createRoute({
  method: "get",
  path: "/:page_id",
  request: {
    params: z.object({
      page_id: z.number({ coerce: true }),
    }),
  },
  responses: {
    200: {
      description: "Page for owner",
      content: {
        "application/json": {
          schema: PageEntityDto,
        },
      },
    },
  },
}))
