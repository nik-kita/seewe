/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */

export interface paths {
  "/v1/auth/sign-in": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: {
      parameters: {
        query?: never
        header?: never
        path?: never
        cookie?: never
      }
      requestBody: {
        content: {
          "application/json": {
            client_id: string
            code: string
            /** @enum {string} */
            auth_provider: "google"
            __redirect_uri__?: string
          }
        }
      }
      responses: {
        /** @description Success user upsert (auto sign-in/up) return fresh jwt token pair. */
        200: {
          headers: {
            [name: string]: unknown
          }
          content: {
            "application/json": {
              access_token: string
              refresh_token: string
              /** @enum {string} */
              token_type: "Bearer"
              id: number
              /** Format: email */
              email: string
              name?: string
              nik?: string
            }
          }
        }
      }
    }
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  "/v1/auth/refresh": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: {
      parameters: {
        query?: never
        header?: never
        path?: never
        cookie?: never
      }
      requestBody: {
        content: {
          "application/json": {
            refresh_token: string
          }
        }
      }
      responses: {
        /** @description Success refresh token */
        200: {
          headers: {
            [name: string]: unknown
          }
          content: {
            "application/json": {
              access_token: string
              refresh_token: string
              /** @enum {string} */
              token_type: "Bearer"
              id: number
              /** Format: email */
              email: string
              name?: string
              nik?: string
            }
          }
        }
      }
    }
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  "/v1/auth/logout": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: {
      parameters: {
        query?: never
        header?: {
          authorization?: string
        }
        path?: never
        cookie?: never
      }
      requestBody?: never
      responses: {
        /** @description Success logout (no content) */
        204: {
          headers: {
            [name: string]: unknown
          }
          content?: never
        }
      }
    }
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  "/v1/users": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: {
      parameters: {
        query?: never
        header?: never
        path?: never
        cookie?: never
      }
      requestBody?: never
      responses: {
        /** @description Return a list of users */
        200: {
          headers: {
            [name: string]: unknown
          }
          content: {
            "application/json": {
              users: {
                id?: number
                /** Format: email */
                email: string
                name?: string
                nik?: string
              }[]
            }
          }
        }
      }
    }
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  "/v1/hello-world": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: {
      parameters: {
        query?: never
        header?: never
        path?: never
        cookie?: never
      }
      requestBody?: never
      responses: {
        /** @description Text response when "Accept" is not specified as "json" */
        200: {
          headers: {
            [name: string]: unknown
          }
          content: {
            "text/html": string
          }
        }
        /** @description When "Accept: application/json" is sent, it returns a JSON object */
        201: {
          headers: {
            [name: string]: unknown
          }
          content: {
            "application/json": {
              message: string
            }
          }
        }
      }
    }
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
}
export type webhooks = Record<string, never>
export interface components {
  schemas: never
  responses: never
  parameters: never
  requestBodies: never
  headers: never
  pathItems: never
}
export type $defs = Record<string, never>
export type operations = Record<string, never>
