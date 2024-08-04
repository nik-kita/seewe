import { createRoute } from "@hono/zod-openapi"
import { authenticated_only_wrapper } from "../../middlewares/authenticated_only.wrapper.ts"
import { z } from "zod"

export const post_add_nik = authenticated_only_wrapper(createRoute({
  method: "post",
  path: "/nik",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            nik: z.string().regex(/[a-z]{3, 16}/),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Successfully added nik to user to extend his possibilities",
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
