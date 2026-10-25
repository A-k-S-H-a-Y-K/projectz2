-- Full-text search over each memory's title and content, kept up to date by Postgres
ALTER TABLE "Memory"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("title", '') || ' ' || "content")) STORED;

CREATE INDEX "Memory_searchVector_idx" ON "Memory" USING GIN ("searchVector");
