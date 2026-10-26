// Creates the shared demo account (if needed) and fills it with the sample memories from
// the evaluation dataset. Safe to re-run: it replaces the demo account's memories.
// Run with: npm run demo:seed
import 'dotenv/config';
import { db } from '../src/lib/db.js';
import { DEMO_EMAIL, DEMO_NAME } from '../src/lib/demo.js';
import { replaceMemories } from './lib/load-memories.js';
import { memories } from './eval/dataset.js';

const user = await db.user.upsert({
  where: { email: DEMO_EMAIL },
  update: {},
  // Not a real login: no password can match this hash. Visitors use POST /auth/demo.
  create: { email: DEMO_EMAIL, name: DEMO_NAME, passwordHash: '!' },
});

await replaceMemories(user.id, memories);
console.log(`Demo account ready with ${memories.length} memories.`);

await db.$disconnect();
process.exit(0);
