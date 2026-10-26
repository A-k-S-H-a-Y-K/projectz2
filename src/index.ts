// Load environment variables before any other module reads them
import 'dotenv/config'
import { serve } from '@hono/node-server'

import app from './app.js'

// Start server
const port = parseInt(process.env.PORT || '3001', 10)

console.log(`Server is running at http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
