// Asks a question through the streaming endpoint and prints the answer as it arrives.
// Start the server first, then run: npm run stream-demo -- "Where did I go scuba diving?"
// Logs in as DEMO_EMAIL / DEMO_PASSWORD, defaulting to the account in requests.http.
import 'dotenv/config';

const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
const email = process.env.DEMO_EMAIL || 'test@example.com';
const password = process.env.DEMO_PASSWORD || 'password123';
const query = process.argv.slice(2).join(' ') || 'Where did I go scuba diving?';

const loginResponse = await fetch(`${baseUrl}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!loginResponse.ok) {
  console.error(`Login failed (${loginResponse.status}). Is the server running and does ${email} exist?`);
  process.exit(1);
}
const { token } = (await loginResponse.json()) as { token: string };

const response = await fetch(`${baseUrl}/ai/search/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ query }),
});
if (!response.ok || !response.body) {
  console.error(`Request failed (${response.status}): ${await response.text()}`);
  process.exit(1);
}

console.log(`Q: ${query}\n`);

type ReferenceSummary = { citation: number; title: string | null; score: number };
let references: ReferenceSummary[] = [];

// SSE messages are separated by a blank line; each has "event:" and "data:" lines
function handleMessage(message: string) {
  const event = /^event: (.*)$/m.exec(message)?.[1];
  const data = [...message.matchAll(/^data: (.*)$/gm)].map((match) => match[1]).join('\n');
  if (!event || !data) return;

  const payload = JSON.parse(data);
  if (event === 'references') {
    references = payload;
    process.stdout.write('A: ');
  } else if (event === 'token') {
    process.stdout.write(payload.text);
  } else if (event === 'done') {
    console.log('\n\nSources:');
    for (const ref of references) {
      const mark = payload.cited.includes(ref.citation) ? '*' : ' ';
      console.log(` ${mark} [${ref.citation}] ${ref.title ?? 'Untitled'} (score ${ref.score.toFixed(2)})`);
    }
    if (references.length === 0) console.log('   none');
    console.log('\n * = cited in the answer');
  } else if (event === 'error') {
    console.error(`\nError: ${payload.error}`);
  }
}

const decoder = new TextDecoder();
let buffer = '';
for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true });
  const messages = buffer.split('\n\n');
  buffer = messages.pop() ?? '';
  messages.forEach(handleMessage);
}
