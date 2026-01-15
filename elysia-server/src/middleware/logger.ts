import { Elysia } from "elysia"
import { logger as log } from "../utils/logger"

export const loggerMiddleware = new Elysia()
  .onRequest(({ request }) => {
    const method = request.method
    const url = new URL(request.url)
    log.info(`${method} ${url.pathname}`)
  })
  .onAfterResponse(({ request, set }) => {
    const method = request.method
    const url = new URL(request.url)
    const status = set.status || 200
    log.info(`${method} ${url.pathname} -> ${status}`)
  })
