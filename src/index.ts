// Load environment variables before any other module reads them
import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { compress } from 'hono/compress'
import { secureHeaders } from 'hono/secure-headers'

import auth from './routes/auth.js'
import memories from './routes/memories.js'
import ai from './routes/ai.js'
import { authMiddleware } from './middleware/auth.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', compress())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000'],
  credentials: true,
}))

// Routes
app.route('/auth', auth)
app.route('/memories', memories)
app.route('/ai', ai)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Error handling
app.onError((err, c) => {
  console.error(`${err}`)
  return c.json({ error: 'Internal Server Error' }, 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// Start server
const port = parseInt(process.env.PORT || '3001', 10)

console.log(`Server is running at http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
