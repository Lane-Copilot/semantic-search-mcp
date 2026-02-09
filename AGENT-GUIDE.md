# Agent Integration Guide

How to effectively use semantic search as an AI assistant. This isn't just about the API — it's about building the **habit** of searching before reading.

## The Core Habit

```
Need past information?
  1. semantic-search "query" FIRST
  2. Review snippets returned (with file paths + line numbers)
  3. Only then: targeted read of specific lines if needed
  4. DON'T default to reading entire files
```

**Why this matters:**
- Saves context tokens (don't load 500 lines when you need 3)
- Faster than scanning files manually
- Works across your entire indexed workspace
- No API costs — runs locally

## Setup

### 1. Install & Build

```bash
cd /path/to/semantic-search
npm install
npm run build
```

### 2. Create a Wrapper Script

Create `bin/semantic-search` (or add to your PATH):

```bash
#!/bin/bash
# Wrapper that filters pthread warnings from onnxruntime
cd /path/to/semantic-search && node search.cjs "$@" 2>&1 | grep -v "pthread_setaffinity"
```

Make it executable:
```bash
chmod +x bin/semantic-search
```

### 3. Initial Index

```bash
semantic-search --reindex
```

This indexes your workspace. First run downloads the embedding model (~90MB).

## Usage Patterns

### Quick Search
```bash
semantic-search "what did Sam say about trust"
```

Returns top 5 results with file paths, line numbers, and preview snippets.

### Index a New File
```bash
semantic-search --index /path/to/file.md
```

Use after creating/updating important files.

### Full Reindex
```bash
semantic-search --reindex
```

Rebuilds the entire index. Use when files have moved or for periodic refresh.

### Check Stats
```bash
semantic-search --stats
```

Shows total chunks, indexed files, and database size.

## Workspace Integration

### AGENTS.md

Add this to your agent instructions:

```markdown
## Semantic Search (LOCAL - PRIORITIZE)

**Use this FIRST when searching memory/context!**

- Search: `semantic-search "your query"`
- Index file: `semantic-search --index /path/to/file.md`
- Reindex all: `semantic-search --reindex`
- Stats: `semantic-search --stats`

**The habit:**
Need past information? Search first, read targeted lines only.
```

### TOOLS.md

Document the tool for your reference:

```markdown
## Semantic Search

| Command | Purpose |
|---------|---------|
| `semantic-search "query"` | Search indexed files |
| `semantic-search --index <path>` | Index a specific file |
| `semantic-search --reindex` | Rebuild entire index |
| `semantic-search --stats` | View index statistics |

- **Chunks indexed:** ~600 (your count will vary)
- **Model:** all-MiniLM-L6-v2 (384 dims, local CPU)
- **Database:** LanceDB (persistent, disk-based)
```

### HEARTBEAT.md

Add maintenance tasks:

```markdown
### 🔍 Semantic Search Maintenance
- After writing diary entries or memory files, index them
- Daily full reindex runs via cron (automatic)
- If search results seem stale, run: `semantic-search --reindex`
```

## Cron Integration

### Daily Reindex (recommended)

Set up a cron job to reindex daily:

```json
{
  "name": "semantic-search-reindex",
  "schedule": {
    "kind": "cron",
    "expr": "0 4 * * *",
    "tz": "America/New_York"
  },
  "sessionTarget": "main",
  "payload": {
    "kind": "systemEvent",
    "text": "Time to reindex semantic search. Run: semantic-search --reindex"
  }
}
```

### Index After File Creation

When you create important files (diary entries, memory notes), index them immediately:

```bash
# After writing a diary entry
semantic-search --index /path/to/diaries/2026-02-09.md
```

## What Gets Indexed

By default, the indexer looks for markdown files in common workspace locations:
- `memory/` — Daily notes and context
- `diaries/` — Personal reflections  
- `.lane/plans/` — Project specs and tasks
- Root `.md` files — MEMORY.md, AGENTS.md, etc.

You can index any text file by path.

## Chunking Strategy

Documents are split intelligently:
1. By markdown headers (`##`, `###`)
2. By paragraphs (double newlines)
3. By sentences (`. ! ?`)

Max chunk size: ~1000 characters with 200-char overlap.

## Search Tips

**Be conversational:**
```bash
semantic-search "when did we discuss the trust conversation"
semantic-search "what projects are blocked"
semantic-search "Sam's feedback about personality"
```

**Use keywords for precision:**
```bash
semantic-search "Pulse v2 push notifications"
semantic-search "overnight cron sessions"
```

**Hybrid search** combines semantic similarity with keyword matching — you get the best of both.

## Troubleshooting

### "pthread_setaffinity" warnings
Use the wrapper script (see Setup section) — it filters these harmlessly.

### Stale results
Run `semantic-search --reindex` to rebuild the index.

### Model download fails
The model downloads from Hugging Face on first run. Ensure `huggingface.co` is accessible.

### "Cannot read properties of undefined"
Make sure you're using the latest version with the `--stats` fix.

## Architecture

```
┌─────────────────┐
│  search.cjs     │  CLI interface
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌───▼───┐
│Embeddings│ │Storage│
│(Transformers.js)│ │(LanceDB)│
└─────────┘ └───────┘
```

- **Embeddings:** all-MiniLM-L6-v2 (384 dimensions, ~90MB)
- **Storage:** LanceDB vector database (disk-persistent)
- **Search:** Cosine similarity with optional keyword boost

## Beyond MCP

While this started as an MCP server, the CLI (`search.cjs`) is the primary interface for most AI assistants. The MCP server is available for integrations that support the Model Context Protocol, but direct CLI usage is simpler and just as powerful.

---

*The goal isn't just to have search — it's to change how you think about accessing past context. Search first. Read targeted. Save tokens.*
