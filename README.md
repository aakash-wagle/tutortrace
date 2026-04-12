# TutorTrace -- Canvas Copilot

AI-powered study assistant that connects to Canvas LMS (configured for PSU). Built with React, Vite, Dexie.js (offline-first), MUI, and Gemini AI.

## Features

- **Local-First & Offline Capable** -- Data is synced and stored locally via Dexie.js (IndexedDB) for instant access.
- **Canvas OAuth2 Integration** -- Connect your Penn State Canvas account securely via a lightweight proxy.
- **Today Dashboard** -- See due assignments, recent changes, announcements, and AI recommendations.
- **My Courses** -- Browse all active courses with progress tracking and next-due assignments.
- **Course Detail** -- View all assignments for a course and launch the coach.
- **Assignment Coach** -- 3-pane view with rubric criteria, interactive checklist, and AI-powered rubric self-check.
- **AI Flashcard Generator** -- Select course content sources (modules, assignments, pages) and auto-generate flashcards with Gemini AI, then study with an interactive flip-card view.
- **Demo Mode** -- Full app experience without Canvas credentials using mock data.

## Tech Stack

- **Framework**: React 19 + Vite (SPA) + TypeScript
- **Routing**: React Router DOM v6
- **UI**: Material UI (MUI) v7 + Tailwind CSS v3
- **Database**: Dexie.js (IndexedDB)
- **Auth & Proxy**: Express.js (Thin proxy to bypass Canvas CORS & handle OAuth2)
- **AI**: Google Gemini SDK

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Install

```bash
cd studyhub
npm install
```

### 2. Configure Environment Variables

Copy the example and fill in your values:

```bash
cp .env.local.example .env
```

Required variables in `.env`:

| Variable | Description | Required |
|---|---|---|
| `SPA_ORIGIN` | App URL (`http://localhost:5173` for dev) | Yes |
| `CANVAS_BASE_URL` | Canvas instance URL (default: `https://psu.instructure.com`) | For Canvas mode |
| `CANVAS_CLIENT_ID` | Canvas Developer Key client ID | For Canvas mode |
| `CANVAS_CLIENT_SECRET` | Canvas Developer Key secret (Only needed for proxy backend) | For Canvas mode |
| `CANVAS_REDIRECT_URI` | OAuth callback URL | For Canvas mode |
| `PORT` | Proxy Server Port (`3001` for dev) | Yes |
| `VITE_CANVAS_PROXY_BASE` | URL for the SPA to hit the proxy (`http://localhost:3001`) | Yes |
| `VITE_LLM_BASE_URL` | OpenAI-compatible base URL. **Groq:** `https://api.groq.com/openai/v1`. **LiteLLM:** e.g. `http://127.0.0.1:4000/v1`, or `/api/llm/v1` with `LLM_PROXY_TARGET` in dev | For AI features |
| `VITE_LLM_MODEL` | Model id (Groq examples: `openai/gpt-oss-20b`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` — see [Groq models](https://console.groq.com/docs/models)) | For AI features |
| `VITE_LLM_API_KEY` | Bearer for the gateway (Groq: create at [API keys](https://console.groq.com/keys)) | For Groq / secured gateways |
| `LLM_PROXY_TARGET` | (Dev only, not `VITE_*`) LiteLLM origin for Vite proxy — use with `VITE_LLM_BASE_URL=/api/llm/v1` | If LiteLLM hits CORS from the dev server |

Groq gives a **single hosted API** (no LiteLLM required): set base URL and key above, pick a model from their docs. For **quality vs RPM vs context**: on paid **Developer** plans, production models are listed at **~1K RPM** and **128K context**; **`openai/gpt-oss-20b`** is the usual sweet spot (very fast tokens/sec, **65K max output**, strong quality). Use **`llama-3.3-70b-versatile`** when you want maximum reasoning (**32K max output**). Free-tier RPM/TPM are lower — see [rate limits](https://console.groq.com/docs/rate-limits).

### 3. Run the Backend Proxy

The Canvas API does not allow cross-origin requests from the browser, so a lightweight proxy is required.

```bash
npm run proxy:dev
```

### 4. Run the Frontend Development Server

In a separate terminal, start the Vite client:

```bash
npm run vite:dev
```

Open [http://localhost:5173](http://localhost:5173).

### 5. Try Demo Mode

Click **Explore Demo Mode** on the connect page to use the app with mock data -- no Canvas or Gemini keys needed.

## Pages

| Route | Description |
|---|---|
| `/connect` | Canvas connection + demo mode entry |
| `/today` | Dashboard: due soon, changes, announcements, copilot |
| `/courses` | Course grid with progress and next-due info |
| `/courses/:id` | Course detail with assignment list |
| `/courses/:courseId/assignments/:id/coach` | 3-pane assignment coach with AI rubric check |
| `/coach` | Assignment coach landing (all coachable assignments) |
| `/flashcards` | Flashcard deck list + AI deck generation |
| `/flashcards/:deckId` | Interactive flashcard study view with flip animation |
| `/calendar` | Event agenda and dates |
| `/grades` | Local grade progress |
| `/messages` | Unified inbox |

## Proxy Server API

Since the frontend runs completely local-first through Dexie.js, the backend only maintains minimal routes to satisfy OAuth2 and Canvas proxying:

| Route | Method | Description |
|---|---|---|
| `/auth/canvas/start` | GET | Initiates Canvas OAuth flow |
| `/auth/canvas/callback` | GET | Handles OAuth callback & exchanges token |
| `/auth/canvas/token` | POST | Validates a personal access token |
| `/auth/canvas/refresh` | POST | Refreshes an expired access token |
| `/canvas-proxy/*` | ANY | Forwards authorized requests securely to Canvas |
| `/health` | GET | Health check |

All Canvas proxy calls gracefully fall back to mock data when operating in demo mode or offline.

## AI Flashcard Generator

1. Navigate to `/flashcards`
2. Click **New Deck**
3. Select a course from the dropdown
4. Optionally select specific modules (or leave empty for all)
5. Click **Generate Flashcards** -- Gemini AI creates Q&A cards
6. Study with the interactive flip-card viewer
7. Mark each card as Easy / Medium / Hard
8. Shuffle and repeat

Works in demo mode with mock content when no Gemini API key is configured.

## Canvas OAuth2 Setup (PSU)

1. Contact PSU IT or use your Canvas Admin > Developer Keys
2. Create a new Developer Key (API Key)
3. Set the redirect URI to `http://localhost:3001/auth/canvas/callback` (Proxy callback)
4. Copy the Client ID and Secret into your `.env`
5. `CANVAS_BASE_URL` is already set to `https://psu.instructure.com`

## Project Structure

```
studyhub/
├── proxy/
│   └── server.ts                 # Express proxy for Canvas and OAuth2
├── src/
│   ├── components/               # UI components, AppShell, Sidebar, Topbar
│   ├── contexts/                 # Gamification and other providers
│   ├── data/mocks/               # Mock JSON for demo mode
│   ├── hooks/                    # Dexie useLiveQuery hooks
│   ├── lib/                      # dexie db schemas, canvas api helpers, util functions
│   ├── pages/                    # React Router pages (Today, Courses, Flashcards)
│   ├── router.tsx                # App route map
│   ├── main.tsx                  # Vite render entrypoint
│   ├── App.tsx                   # Main React entrypoint
│   └── theme/                    # MUI theme
├── public/
│   └── manifest.json             # PWA configuration
├── index.html                    # Vite html template
├── vite.config.ts                # Vite & PWA bundler config
└── .env.example                  # Environment variable template
```

## Setup for Production Deployment

1. **Frontend**: Deploy the static Vite build (`npm run vite:build`) to Vercel, Netlify, or Firebase Hosting.
2. **Proxy**: Deploy the `proxy/server.ts` standalone to Render, Railway, or Heroku.
3. Update production `.env` files across both deployments to ensure `SPA_ORIGIN`, `VITE_CANVAS_PROXY_BASE`, and `CANVAS_REDIRECT_URI` perfectly map to your deployed URLs.

## License

MIT
