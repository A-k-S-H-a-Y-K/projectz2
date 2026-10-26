import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createMemory, deleteMemory, listMemories, type Memory } from '../api';
import { formatDate } from '../format';

export default function MemoriesPage({ readOnly }: { readOnly: boolean }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', tag: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loads a page of memories; page 1 replaces the list, later pages are appended
  const load = useCallback(
    async (pageToLoad: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listMemories({ page: pageToLoad, ...filters });
        setMemories((current) => (pageToLoad === 1 ? result.memories : [...current, ...result.memories]));
        setTotal(result.pagination.total);
        setPage(pageToLoad);
        setPages(result.pagination.pages);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load memories');
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const search = (event: FormEvent) => {
    event.preventDefault();
    setFilters({ ...filters, search: searchInput.trim() });
  };

  const remove = async (memory: Memory) => {
    if (!confirm(`Delete "${memory.title || 'Untitled'}"?`)) return;
    try {
      await deleteMemory(memory.id);
      setMemories((current) => current.filter((m) => m.id !== memory.id));
      setTotal((current) => current - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the memory');
    }
  };

  return (
    <div className="stack">
      {readOnly ? (
        <p className="notice small">
          This is a shared, read-only demo account, so adding and deleting notes is turned off.
        </p>
      ) : (
        <AddMemoryForm
          onAdded={(memory) => {
            setMemories((current) => [memory, ...current]);
            setTotal((current) => current + 1);
          }}
        />
      )}

      <form onSubmit={search} className="ask-form">
        <input
          placeholder="Search notes by text…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <div className="list-header">
        <span className="muted small">
          {total} {total === 1 ? 'note' : 'notes'}
          {filters.search && ` matching "${filters.search}"`}
        </span>
        {filters.tag && (
          <button className="chip" onClick={() => setFilters({ ...filters, tag: '' })}>
            #{filters.tag} ✕
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {memories.map((memory) => (
        <article key={memory.id} className="card">
          <header className="source-header">
            <strong>{memory.title || 'Untitled'}</strong>
            <span className="muted small">{formatDate(memory.createdAt)}</span>
            {!readOnly && (
              <button className="link danger small push-right" onClick={() => remove(memory)}>
                Delete
              </button>
            )}
          </header>
          <p>{memory.content}</p>
          <div className="tags">
            {memory.tags.map((tag) => (
              <button key={tag} className="chip" onClick={() => setFilters({ ...filters, tag })}>
                #{tag}
              </button>
            ))}
          </div>
        </article>
      ))}

      {loading && <p className="muted">Loading…</p>}
      {!loading && memories.length === 0 && !error && <p className="muted">No notes yet.</p>}
      {!loading && page < pages && (
        <button onClick={() => load(page + 1)}>Load more</button>
      )}
    </div>
  );
}

function AddMemoryForm({ onAdded }: { onAdded: (memory: Memory) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const memory = await createMemory({
        title: title.trim() || undefined,
        content: content.trim(),
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      onAdded(memory);
      setTitle('');
      setContent('');
      setTags('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card stack">
      <h2 className="section-title">New note</h2>
      <input placeholder="Title (optional)" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        placeholder="What do you want to remember?"
        required
        maxLength={8000}
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <input placeholder="Tags, separated by commas" value={tags} onChange={(e) => setTags(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary" disabled={saving || !content.trim()}>
        {saving ? 'Saving…' : 'Save note'}
      </button>
    </form>
  );
}
