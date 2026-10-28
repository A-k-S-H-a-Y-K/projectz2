import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { compress } from 'hono/compress'
import { secureHeaders } from 'hono/secure-headers'
import { bodyLimit } from 'hono/body-limit'

import auth from './routes/auth.js'
import memories from './routes/memories.js'
import ai from './routes/ai.js'
import { TimeoutError } from './lib/timeout.js'

// Comma-separated list of frontend URLs allowed to call the API
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())

const app = new Hono()

// Middleware (request logging is skipped in tests to keep their output readable)
if (process.env.NODE_ENV !== 'test') {
  app.use('*', logger())
}
app.use('*', prettyJSON())
app.use('*', compress())
app.use('*', secureHeaders())
app.use('*', cors({ origin: allowedOrigins, credentials: true }))
// The largest valid request (an 8,000-character memory with tags) is well under this
app.use(
  '*',
  bodyLimit({
    maxSize: 100 * 1024,
    onError: (c) => c.json({ error: 'Request body is too large' }, 413),
  })
)

// Routes
app.route('/auth', auth)
app.route('/memories', memories)
app.route('/ai', ai)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Error handling
app.onError((err, c) => {
  console.error(err)
  if (err instanceof TimeoutError) {
    return c.json({ error: 'The AI service took too long to respond. Please try again.' }, 504)
  }
  return c.json({ error: 'Internal Server Error' }, 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

export default app
