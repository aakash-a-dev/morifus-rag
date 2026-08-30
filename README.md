# Document Intelligence System

Upload PDF, DOCX, MD, or TXT documents into a workspace, ask questions about them
through a RAG chatbot with source citations, and automatically surface contradictions
across documents as you query them.

**Live demo:** https://morifus.aakashdev.in
**RabbitMQ queue view:** https://mq.morifus.aakashdev.in

Full internals, pipelines, schema, and design tradeoffs are documented in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Stack

| Layer | Choice |
|---|---|
| Backend | Express + TypeScript |
| Database | PostgreSQL + pgvector (HNSW index) |
| ORM | Prisma |
| Ingestion queue | RabbitMQ |
| Cache, rate limiter, pub/sub | Redis |
| LLM + embeddings | Gemini (pluggable, Bedrock also implemented) |
| Frontend | Next.js + shadcn/ui |
| Orchestration | Docker Compose |
| Production reverse proxy + TLS | Caddy |

## Prerequisites

- Docker + Docker Compose
- Node.js 20+ (only for local `npm run dev`, not required for the Docker path)
- A Gemini API key: https://aistudio.google.com/app/apikey (free, instant, no approval wait)

## Quick start (Docker Compose)

```bash
cp backend/.env.example backend/.env
# edit backend/.env and set GEMINI_API_KEY

docker-compose up --build
```

This starts Postgres with pgvector, Redis, RabbitMQ, the backend API (`:4000`), the
ingestion worker, and the Next.js frontend (`:3000`).

On first run, apply the database migrations (creates the pgvector extension, tables,
vector index, workspaces, and the document preview column):

```bash
docker-compose exec backend npx prisma migrate deploy
```

Open **http://localhost:3000**. You will land on a workspace picker: open the featured
demo workspace, or create your own. Inside a workspace, go to **Upload** and click
**Load Demo Data** to seed 6 synthetic HR and finance documents with intentionally
planted contradictions, no need to source your own files to see the system work end
to end.

## Running locally without Docker (backend and frontend as separate processes)

```bash
# Infra only
docker-compose up postgres redis rabbitmq

# Backend API
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev

# Backend ingestion worker (separate terminal)
cd backend
npm run dev:worker

# Frontend (separate terminal)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

## Provider setup (LLM and embeddings)

The backend never depends on a specific vendor SDK, every consumer (ingestion, chat,
contradiction detection) talks only to the `LLMProvider` and `EmbeddingProvider`
interfaces in `backend/src/providers/*.interface.ts`. Swapping vendors is an
environment variable change plus one class in `providers/index.ts`, nothing else in
the codebase changes.

**Default: Gemini.** Set in `backend/.env`:

```
LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
GEMINI_LLM_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

Gemini's free tier is rate-limited (a handful of requests per minute depending on the
model), the app's shared Redis token bucket (`BEDROCK_RATE_LIMIT_PER_MINUTE` in
`.env`, the name predates the Gemini switch) throttles calls to stay under that
instead of bursting into errors. Lower it further if you're on a stricter model, raise
it if you move to a paid tier.

**Also implemented: AWS Bedrock** (`backend/src/providers/bedrock/`), Claude for
generation and Titan Embeddings V2 for vectors, selected via
`LLM_PROVIDER=bedrock` / `EMBEDDING_PROVIDER=bedrock` plus AWS credentials. This was
the original default. It was moved off as the primary path after the AWS account used
to build this had Anthropic model access blocked with no quick resolution path, a
concrete demonstration of why the provider interface exists in the first place: the
switch took two new files and two environment variables, zero changes to business
logic.

## Demo script

1. Open a workspace, go to **Upload**, click **Load Demo Data**. Watch real time
   ingestion progress (Server-Sent Events) as documents are parsed, chunked, embedded,
   and indexed.
2. Go to **Chat** and ask a suggested question, for example *"How many PTO days are
   employees entitled to?"*. The answer is grounded in retrieved chunks, cited inline,
   and tagged with a confidence badge. Hover a citation to preview the exact source
   excerpt. Expand "How I found this" to see the retrieval chain of thought.
3. The same query also triggers contradiction detection over the retrieved and
   semantically similar cross document chunks. Go to **Contradictions** to see planted
   conflicts (PTO day counts, expense approval thresholds, remote work eligibility, and
   in the finance demo set, revenue growth projections, market size estimates, and buy
   versus sell analyst ratings), each with severity, reasoning, and an expandable
   evidence trace. Mark one **Resolved** and one **False positive** to see the
   workflow.
4. Go to **Library** to see every uploaded document, its status, and chunk count.
   Click the eye icon to **preview** a document, the original file (rendered inline
   for PDF and text, downloadable for DOCX) alongside its extracted text. Delete a
   document to see cascading removal of its chunks and contradictions.
5. Create a second workspace from the home screen, upload the same demo file into it,
   and upload it again a second time, the second attempt is deduplicated instantly by
   content hash instead of re-running the ingestion pipeline.

## Deploying to your own server

`docker-compose.prod.yml` and `Caddyfile` run the identical six services behind
Caddy, which handles automatic TLS and reverse proxies a domain to the frontend and
API, plus a second subdomain straight to RabbitMQ's management UI, all on a single
small EC2 instance. See `.env.prod.example` for the required variables. Details and
reasoning for this choice are in `ARCHITECTURE.md`.

## Repository layout

```
morifus code/
├── docker-compose.yml
├── docker-compose.prod.yml
├── Caddyfile
├── .env.prod.example
├── backend/           (Express API + ingestion worker)
│   ├── src/
│   ├── prisma/
│   └── seed/          (demo HR/policy documents)
└── frontend/          (Next.js app)
```
