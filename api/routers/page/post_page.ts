import { createRoute } from "@hono/zod-openapi"
import { z } from "zod"
import { PageInputDto } from "../../dto/page.dto.ts"
import { authenticated_only_wrapper } from "../../middlewares/authenticated_only.wrapper.ts"

export const post_page = authenticated_only_wrapper(createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: PageInputDto.merge(z.object({
            make_default: z.boolean(),
          })),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Page created",
      content: {
        "application/json": {
          schema: z.object({ _id: z.number() }),
        },
      },
    },
  },
}))
