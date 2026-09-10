# DERZEN

**Still and always be DERZEN.**

DERZEN is a locally-hosted AI automation system for Windows. It combines browser
automation, offline AI processing, social-media analysis, and multi-channel
communication behind a visual, no-code pipeline builder. Everything runs on your
own machine, so your data never leaves it.

The project has two parts:

- **backend/** — a Python (FastAPI) service that does the real work: Ollama
  inference, Playwright browser automation, IMAP/SMTP email, WhatsApp Web,
  sandboxed file operations, cron scheduling, and pipeline execution.
- **src/** — a React + Vite front-end (the dashboard, visual pipeline builder,
  file manager, and scheduler) that talks to the backend over HTTP.

---

## Requirements

- Windows 10/11 (Linux/macOS also work for development)
- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.ai) for local AI inference

## 1. Backend setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows (use: source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
playwright install chromium

copy .env.example .env           # then edit .env (see below)
python main.py                   # starts the API on http://localhost:8000
```

### Configuring .env

Two values are **required** and have no defaults, for security:

- `WHITELIST_CONTACTS` — only these emails / phone numbers may trigger actions.
- `ALLOWED_BASE` — the single root directory every file operation is sandboxed to.

Email and WhatsApp are optional. Enter your own credentials in `.env`;
they are read from the environment and never stored in code.

## 2. Local AI (Ollama)

```bash
ollama pull llama3.2
ollama serve
```

## 3. Frontend setup

```bash
npm install
npm run dev                      # serves the UI on http://localhost:3000
```

Open http://localhost:3000. The UI reads the backend URL from the `VITE_API_BASE`
environment variable and defaults to `http://localhost:8000`.

---

## Visual pipeline builder

Build automations by connecting nodes on a canvas — no coding required. You can
start from scratch, or describe what you want in plain English and let the local
AI draft the pipeline for you (with a deterministic fallback if the AI is
offline). Use `{{node_id}}` or friendly names like `{{ai_answer}}` /
`{{scraped_data}}` to pass results from one step to the next.

### Node types

| Node | Purpose |
| --- | --- |
| Start / End | Pipeline entry and exit |
| Ask Local AI | Query Ollama offline |
| Browse Online AI | Drive ChatGPT / Claude / Gemini / Perplexity via the browser |
| Read Websites | Scrape one or more URLs |
| Analyze Social Media | Search a platform and summarise sentiment |
| Send an Email | Send a report/alert over SMTP |
| WhatsApp | Send a message via WhatsApp Web |
| File Save | Write a file into the sandbox |
| Wait | Pause for N seconds |
| Branch | Conditional true/false paths |

## Security model

- **Sandboxing** — every file path is validated against `ALLOWED_BASE`; traversal is refused.
- **Whitelist** — inbound email/WhatsApp senders are checked before any action runs.
- **Emergency stop** — one call halts the scheduler, tears down the browser, and refuses new work until reset.
- **No hardcoded secrets** — all configuration comes from `.env`.
- **Localhost binding & CORS** — the API binds to `127.0.0.1` and only accepts the configured origin.

## API endpoints (backend)

- `GET  /api/status` — system + AI status
- `POST /api/emergency-stop` / `POST /api/emergency-stop/reset`
- `POST /api/ai/query`
- `GET/POST /api/pipelines`, `GET/DELETE /api/pipelines/{id}`, `POST /api/pipelines/{id}/run`, `POST /api/pipelines/run`, `POST /api/pipelines/generate`
- `GET  /api/scheduler/jobs`
- `GET  /api/files/list`

## Project structure

```
backend/                 Python FastAPI service
  main.py                API entry point (python main.py)
  config.py              env-based configuration + sandbox base
  runtime.py             shared emergency-stop flag
  ai_manager.py          Ollama client
  automation.py          Playwright browser automation
  social.py              social-media search + sentiment
  email_listener.py      SMTP send + whitelisted IMAP polling
  whatsapp_listener.py   WhatsApp Web integration
  file_manager.py        sandboxed file operations
  storage.py             pipeline persistence (JSON)
  pipeline_runner.py     execution engine (vars + branching)
  scheduler.py           APScheduler cron jobs
  generator.py           plain-English -> pipeline
  requirements.txt
  .env.example
src/                     React + Vite frontend
  api.ts                 backend API client
  App.tsx, components/   dashboard, builder, scheduler, files, ...
```

## Notes & limitations

- Third-party web selectors (online AI sites, social platforms, WhatsApp Web)
  change over time and may need occasional updates.
- WhatsApp requires scanning the QR code once; Gmail requires an App Password.
- CPU-only inference is slower; smaller models (phi-2, tinyllama) trade quality
  for speed, and an NVIDIA GPU speeds things up substantially.
