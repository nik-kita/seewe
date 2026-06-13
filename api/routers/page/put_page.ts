import { createRoute } from "@hono/zod-openapi"
import { z } from "zod"
import { PageInputDto } from "../../dto/page.dto.ts"
import { authenticated_only_wrapper } from "../../middlewares/authenticated_only.wrapper.ts"

export const put_page = authenticated_only_wrapper(createRoute({
  method: "put",
  path: "/:page_id",
  request: {
    params: z.object({
      page_id: z.number({ coerce: true }),
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: PageInputDto.partial(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Page updated",
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
