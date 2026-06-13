import { OpenAPIHono } from "@hono/zod-openapi"
import { cors } from "hono/cors"
import { showRoutes } from "hono/dev"
import { logger } from "hono/logger"
import { config } from "./config.ts"
import { openapi_router } from "./routers/openapi/mod.openapi.tsx"
import { page_subserver } from "./spa_subserver/page_subserver.tsx"
import { serve_static } from "./utils/serve_static.ts"
import { api_v1 } from "./v1.ts"

const app = new OpenAPIHono()

app.use(logger()).use(
  cors({
    origin: config.UI_URL!.split(" "),
  }),
)

app.route("/", api_v1)
app.route("/openapi", openapi_router)
app.route("/", page_subserver)
app.notFound(serve_static)

Deno.serve({ port: 3000 }, app.fetch)

showRoutes(app)
