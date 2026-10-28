// Load environment variables before any other module reads them
import 'dotenv/config'
import { serve } from '@hono/node-server'

import { checkEnv } from './lib/env.js'

const problems = checkEnv()
if (problems.length > 0) {
  console.error('Server not started. Fix these settings (see .env.example):')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

// Imported after the check, because loading the app connects to the AI services
const { default: app } = await import('./app.js')

// Start server
const port = parseInt(process.env.PORT || '3001', 10)

console.log(`Server is running at http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
