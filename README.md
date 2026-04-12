# TutorTrace -- Canvas Copilot

AI-powered study assistant that connects to Canvas LMS (configured for PSU). Built with Next.js, React, MUI, and Gemini AI.

## Features

- **Canvas OAuth2 Integration** -- Connect your Penn State Canvas account securely
- **Today Dashboard** -- See due assignments, recent changes, announcements, and AI recommendations
- **My Courses** -- Browse all active courses with progress tracking and next-due assignments
- **Course Detail** -- View all assignments for a course and launch the coach
- **Assignment Coach** -- 3-pane view with rubric criteria, interactive checklist, and AI-powered rubric self-check
- **AI Flashcard Generator** -- Select course content sources (modules, assignments, pages) and auto-generate flashcards with Gemini AI, then study with an interactive flip-card view
- **Demo Mode** -- Full app experience without Canvas credentials using mock data

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: Material UI (MUI) v7 + Emotion
- **Auth**: Canvas OAuth2 + iron-session
- **Database**: Prisma + SQLite (dev) / Postgres (production)
- **AI**: Google Gemini 1.5 Flash
- **Data Fetching**: SWR
- **Deployment**: Vercel

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
cp .env.local.example .env.local
```

Required variables in `.env.local`:

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | App URL (`http://localhost:3000` for dev) | Yes |
| `CANVAS_BASE_URL` | Canvas instance URL (default: `https://psu.instructure.com`) | For Canvas mode |
| `CANVAS_CLIENT_ID` | Canvas Developer Key client ID | For Canvas mode |
| `CANVAS_CLIENT_SECRET` | Canvas Developer Key secret | For Canvas mode |
| `CANVAS_REDIRECT_URI` | OAuth callback URL | For Canvas mode |
| `SESSION_SECRET` | Random 32+ char string for cookie encryption | Yes |
| `DATABASE_URL` | Database connection string | Yes |
| `GOOGLE_GEMINI_API_KEY` | Gemini API key from Google AI Studio | For AI features |

### 3. Set Up Database

```bash
# SQLite for local development (already configured)
npx prisma db push
```

For production (Postgres via Supabase), update the provider in `prisma/schema.prisma` to `"postgresql"` and set `DATABASE_URL` accordingly.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Try Demo Mode

Click **Explore Demo Mode** on the connect page to use the app with mock data -- no Canvas or Gemini keys needed.

## Pages

| Route | Description |
|---|---|
| `/connect` | Canvas connection + demo mode entry |
| `/today` | Dashboard: due soon, changes, announcements, copilot |
| `/courses` | Course grid with progress and next-due info |
| `/courses/[id]` | Course detail with assignment list |
| `/courses/[id]/assignments/[aid]/coach` | 3-pane assignment coach with AI rubric check |
| `/coach` | Assignment coach landing (all coachable assignments) |
| `/flashcards` | Flashcard deck list + AI deck generation |
| `/flashcards/[deckId]` | Interactive flashcard study view with flip animation |
| `/calendar` | Coming soon |
| `/grades` | Coming soon |
| `/messages` | Coming soon |

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/auth/canvas/start` | GET | Initiates Canvas OAuth flow |
| `/api/auth/canvas/callback` | GET | Handles OAuth callback |
| `/api/auth/session` | GET | Returns current session info (demo/connected status) |
| `/api/canvas/courses` | GET | List user's courses |
| `/api/canvas/courses/[id]/assignments` | GET | List course assignments |
| `/api/canvas/courses/[id]/assignments/[aid]` | GET | Get single assignment |
| `/api/canvas/courses/[id]/modules` | GET | List course modules with items |
| `/api/canvas/courses/[id]/activity` | GET | Course activity stream |
| `/api/canvas/courses/[id]/announcements` | GET | Course announcements |
| `/api/dashboard/assignments` | GET | All assignments across courses |
| `/api/ai/rubric-check` | POST | AI rubric analysis via Gemini |
| `/api/flashcards` | GET | List flashcard decks |
| `/api/flashcards/generate` | POST | Generate a new deck with AI |
| `/api/flashcards/[deckId]` | GET/DELETE | Get or delete a deck |
| `/api/flashcards/[deckId]/cards/[cardId]` | PATCH | Update card difficulty |

All Canvas routes fall back to mock data in demo mode or on error.

## AI Flashcard Generator

1. Navigate to `/flashcards`
2. Click **New Deck**
3. Select a course from the dropdown
4. Optionally select specific modules (or leave empty for all)
5. Click **Generate Flashcards** -- Gemini AI creates 15-20 Q&A cards
6. Study with the interactive flip-card viewer
7. Mark each card as Easy / Medium / Hard
8. Shuffle and repeat

Works in demo mode with mock content when no Gemini API key is configured.

## Canvas OAuth2 Setup (PSU)

1. Contact PSU IT or use your Canvas Admin > Developer Keys
2. Create a new Developer Key (API Key)
3. Set the redirect URI to `http://localhost:3000/api/auth/canvas/callback`
4. Copy the Client ID and Secret into your `.env.local`
5. `CANVAS_BASE_URL` is already set to `https://psu.instructure.com`

## Project Structure

```
studyhub/
├── prisma/schema.prisma          # DB schema (UserSession, FlashcardDeck, Flashcard)
├── src/
│   ├── app/
│   │   ├── connect/              # Canvas connection page
│   │   ├── today/                # Dashboard
│   │   ├── courses/              # Course list + detail + coach
│   │   ├── coach/                # Coach landing page
│   │   ├── flashcards/           # Flashcard decks + study view
│   │   ├── calendar/grades/messages/  # Stub pages
│   │   └── api/                  # All backend routes
│   ├── components/               # Sidebar, Topbar, AppShell, ProgressRing, etc.
│   ├── data/mocks/               # Mock JSON for demo mode
│   ├── hooks/                    # SWR hooks
│   ├── lib/                      # ai.ts, canvas.ts, db.ts, demo.ts, session.ts
│   └── theme/                    # MUI theme
└── .env.local.example            # Environment variable template
```

## Deploying to Vercel

1. Push repo to GitHub
2. Import into Vercel
3. Set up Postgres (Supabase free tier)
4. Update `prisma/schema.prisma` provider to `"postgresql"`
5. Add all env vars in Vercel dashboard
6. Set `CANVAS_REDIRECT_URI` to your production callback URL
7. Deploy -- `postinstall` runs `prisma generate` automatically

## License

MIT
