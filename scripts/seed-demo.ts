// Creates the shared demo account (if needed) and fills it with the sample memories from
// the evaluation dataset, plus a long, detail-heavy note that only the demo has.
// Safe to re-run: it replaces the demo account's memories.
// Run with: npm run demo:seed
import 'dotenv/config';
import { db } from '../src/lib/db.js';
import { DEMO_EMAIL, DEMO_NAME } from '../src/lib/demo.js';
import { replaceMemories } from './lib/load-memories.js';
import { memories, type EvalMemory } from './eval/dataset.js';

// Kept out of the evaluation dataset so the published evaluation results stay comparable.
// Shows how retrieval copes with one long note full of names, numbers and codes.
// All details are made up.
const demoOnlyMemories: EvalMemory[] = [
  {
    key: 'europe-trip',
    title: 'Europe trip plan, June 2026',
    content:
      'Europe trip from 4 to 18 June 2026 with my cousin Arjun. Flying Air India AI 131 from Mumbai to London Heathrow on 4 June, departing at 01:55 and landing at 07:20; the return flight AI 130 leaves London on 18 June at 21:30, and the return ticket cost 62,400 rupees per person. In London we stay 3 nights at the Premier Inn Kings Cross for 118 pounds a night, booking reference PIK48291. On 7 June we take the 09:31 Eurostar to Paris, which cost 89 euros each, and stay 4 nights at an Airbnb in Montmartre for 96 euros a night. On 11 June we take the TGV to Zurich and use an 8-day Swiss Travel Pass that cost 389 Swiss francs. In Switzerland we spend 2 nights at the Balmers hostel in Interlaken at 54 francs a night, then 2 nights in Lucerne. The Jungfraujoch trip on 13 June costs 235 francs with the 25 percent pass discount. The Schengen visa appointment was at VFS Bengaluru on 18 March and the visa came through on 2 April. Travel insurance is a Tata AIG policy, number TA-77310452, which cost 4,200 rupees. I am carrying 600 euros and 300 pounds in cash, exchanged at 90.5 rupees per euro. The total budget is 3,20,000 rupees and I have spent 2,87,650 rupees so far, leaving 32,350 rupees.',
    tags: ['travel', 'family', 'planning'],
  },
];

const user = await db.user.upsert({
  where: { email: DEMO_EMAIL },
  update: {},
  // Not a real login: no password can match this hash. Visitors use POST /auth/demo.
  create: { email: DEMO_EMAIL, name: DEMO_NAME, passwordHash: '!' },
});

const allMemories = [...memories, ...demoOnlyMemories];
await replaceMemories(user.id, allMemories);
console.log(`Demo account ready with ${allMemories.length} memories.`);

await db.$disconnect();
process.exit(0);
