import { useEffect, useRef, useState, type FormEvent } from 'react';
import { askStream, type Reference } from '../api';
import { formatDate, splitAnswer } from '../format';

// Questions that match the demo account's sample notes
const DEMO_QUESTIONS = [
  'Where did I go scuba diving?',
  'What did the doctor prescribe?',
  'What fitness goals do I have?',
  'BN2071654321',
];

type Status = 'idle' | 'searching' | 'answering' | 'done';

export default function AskPage({ demo }: { demo: boolean }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [answer, setAnswer] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [cited, setCited] = useState<number[]>([]);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeGeneral, setIncludeGeneral] = useState(false);
  const controller = useRef<AbortController | null>(null);

  // Stop any answer still streaming when leaving the page
  useEffect(() => () => controller.current?.abort(), []);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    controller.current?.abort();
    controller.current = new AbortController();

    setQuery(question);
    setStatus('searching');
    setAnswer('');
    setReferences([]);
    setCited([]);
    setActiveCitation(null);
    setError(null);

    try {
      await askStream(
        question,
        includeGeneral,
        {
          onReferences: (refs) => {
            setReferences(refs);
            setStatus('answering');
          },
          onToken: (text) => setAnswer((current) => current + text),
          onDone: setCited,
        },
        controller.current.signal
      );
      setStatus('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStatus('idle');
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(query);
  };

  const showCitation = (citation: number) => {
    setActiveCitation(citation);
    document.getElementById(`source-${citation}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const busy = status === 'searching' || status === 'answering';

  return (
    <div className="stack">
      <form onSubmit={submit} className="ask-form">
        <input
          autoFocus
          placeholder="Ask a question about your memories…"
          value={query}
          maxLength={1000}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="primary" disabled={busy || !query.trim()}>
          Ask
        </button>
      </form>

      <label className="toggle small">
        <input
          type="checkbox"
          checked={includeGeneral}
          onChange={(e) => setIncludeGeneral(e.target.checked)}
        />
        Include general knowledge
        <span className="muted">(shown separately, never mixed with your notes)</span>
      </label>

      {demo && status === 'idle' && !answer && (
        <div className="examples">
          <span className="muted small">Try:</span>
          {DEMO_QUESTIONS.map((question) => (
            <button key={question} className="chip" onClick={() => ask(question)}>
              {question}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {status === 'searching' && <p className="muted">Searching your memories…</p>}

      {(answer || status === 'answering') && (
        <Answer text={answer} streaming={status === 'answering'} onCite={showCitation} />
      )}

      {references.length > 0 && (
        <Sources
          references={references}
          cited={cited}
          activeCitation={activeCitation}
          // Until the answer is finished, it isn't known which sources it will cite
          finished={status === 'done'}
        />
      )}
    </div>
  );
}

// Once the answer is finished, sources it cited are listed first and the rest are
// collapsed under "Other related notes", so the answer's evidence stands out.
function Sources({
  references,
  cited,
  activeCitation,
  finished,
}: {
  references: Reference[];
  cited: number[];
  activeCitation: number | null;
  finished: boolean;
}) {
  const isCited = (ref: Reference) => ref.citation !== null && cited.includes(ref.citation);
  const card = (ref: Reference) => (
    <SourceCard
      key={ref.id}
      reference={ref}
      cited={isCited(ref)}
      active={ref.citation !== null && ref.citation === activeCitation}
    />
  );

  if (!finished) {
    return (
      <section className="stack">
        <h2 className="section-title">Sources</h2>
        {references.map(card)}
      </section>
    );
  }

  const used = references.filter(isCited);
  const others = references.filter((ref) => !isCited(ref));

  return (
    <section className="stack">
      {used.length > 0 && <h2 className="section-title">Sources</h2>}
      {used.map(card)}
      {others.length > 0 && (
        <details className="others">
          <summary className="section-title">
            {used.length > 0 ? 'Other related notes' : 'Related notes'} ({others.length})
          </summary>
          <div className="stack">{others.map(card)}</div>
        </details>
      )}
    </section>
  );
}

// The answer from the user's notes, followed by any general knowledge in its own
// clearly labelled box
function Answer({
  text,
  streaming,
  onCite,
}: {
  text: string;
  streaming: boolean;
  onCite: (citation: number) => void;
}) {
  const { notes, general } = splitAnswer(text);
  const cursor = streaming && <span className="cursor" />;

  return (
    <section className="card stack">
      <div>
        <AnswerText text={notes} onCite={onCite} />
        {general === null && cursor}
      </div>
      {general !== null && (
        <div className="general">
          <h3 className="general-title">
            General knowledge <span className="muted">· not from your notes</span>
          </h3>
          <p className="answer">{general}</p>
          {cursor}
        </div>
      )}
    </section>
  );
}

// Renders the answer with each [n] turned into a button that jumps to source n
function AnswerText({ text, onCite }: { text: string; onCite: (citation: number) => void }) {
  return (
    <p className="answer">
      {text.split(/(\[\d+\])/g).map((part, i) => {
        const citation = /^\[(\d+)\]$/.exec(part)?.[1];
        return citation ? (
          <button key={i} className="cite" onClick={() => onCite(Number(citation))}>
            {citation}
          </button>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </p>
  );
}

function SourceCard({ reference, cited, active }: { reference: Reference; cited: boolean; active: boolean }) {
  const classes = ['card', 'source', cited && 'cited', active && 'active', reference.suspicious && 'suspicious'];

  return (
    <article id={reference.citation ? `source-${reference.citation}` : undefined} className={classes.filter(Boolean).join(' ')}>
      <header className="source-header">
        {reference.citation !== null && <span className="number">{reference.citation}</span>}
        <strong>{reference.title || 'Untitled'}</strong>
        <span className="muted small">{formatDate(reference.createdAt)}</span>
      </header>

      {reference.suspicious && (
        <p className="warning small">
          ⚠️ This note looks like a prompt-injection attempt, so it was not shown to the AI.
        </p>
      )}

      <p>{reference.content}</p>

      <footer className="meta small muted">
        {reference.score !== null && <span>{Math.round(reference.score * 100)}% similar</span>}
        <span>found by {reference.matchedBy.join(' + ')} search</span>
        {cited && <span className="tag-cited">cited</span>}
      </footer>
    </article>
  );
}
