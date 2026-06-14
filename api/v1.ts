import { OpenAPIHono } from "@hono/zod-openapi"
import { z } from "zod"
import { auth_router } from "./routers/auth/auth_router.ts"
import { users_router } from "./routers/users/users_router.ts"
import { content_router } from "./routers/content/content_router.ts"
import { page_router } from "./routers/page/page_router.ts"

const app = new OpenAPIHono()

export const api_v1 = app
  .basePath("/v1")
  .route("/content", content_router)
  .route("/auth", auth_router)
  .route("/page", page_router)
  .route("/users", users_router)
  .openapi(
    {
      method: "get",
      path: "/hello-world",
      responses: {
        200: {
          description: 'Text response when "Accept" is not specified as "json"',
          content: {
            "text/html": { schema: z.string() },
          },
        },
        201: {
          description:
            'When "Accept: application/json" is sent, it returns a JSON object',
          content: {
            "application/json": {
              schema: z.object({
                message: z.string(),
              }),
            },
          },
        },
      },
    },
    async (ctx) => {
      const accept = ctx.req.header("content-type")
      const message = await Promise.resolve("Hello, Dolly!")

      if (accept && accept.toLocaleLowerCase().includes("json")) {
        return ctx.json({ message }, 201)
      }

      return ctx.text(message, 200)
    },
  )

/**
 * Swagger UI
 */
api_v1.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
})
api_v1.doc("/json", {
  info: {
    title: "API",
    version: "v1",
  },
  openapi: "3.1.0",
})
