# TourneyMaster AI 🏓

> **Master Tournament Management System for Table Tennis Competitions**  
> Built with Next.js 15 (App Router, Strict TypeScript), Tailwind CSS, Supabase (PostgreSQL, Realtime, RLS), and Glicko-2 Rating Engine.

---

## ⚡ Key Capabilities

- **Player Registration & QR Check-In**: Instant self-registration with mobile QR code scanning.
- **Historical Archive (2024, 2025, 2026)**: Canonical player identities, alias resolution, immutable historical records, and batch Glicko-2 chronological replay.
- **Snake Seeding & Balanced Groups**: Automatic group count (1–4) and deterministic snake seeding by historical rating.
- **Real-Time Cross-Validation**: Mobile score entry with opponent confirmation and dispute filing.
- **Mystery Mode / Hidden Standings**: Server-side enforced standings lock until all matches in a group are confirmed.
- **Official Tiebreakers**: Wins → Head-to-Head (2-way) → Mini-League (3+ way) → Point Difference → Points For → Seed.
- **Dynamic Elimination Bracket**: Single-elimination bracket generation with cross-group pairings (e.g. A1 vs B2, C1 vs D2).
- **Admin Control & Audit Trail**: Full dispute resolution, manual overrides, and comprehensive audit logs.
- **Progressive Web App (PWA)**: Installable on iOS/Android, mobile-optimized touch UI, and offline fallback.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 15** (App Router, TypeScript strict) |
| Styling | **Tailwind CSS v4** (Dark sport-themed UI) |
| Database & Auth | **Supabase** (PostgreSQL, RLS, Realtime) |
| Client Libs | `@supabase/ssr`, `qrcode.react`, `zod`, `clsx`, `tailwind-merge` |
| Rating Algorithm | **Glicko-2** with Illinois numerical root-finding |
| Testing | **Vitest** (167 Unit/Integration tests) |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 20+ / 24+
- Supabase Project (or local Supabase instance)

### 2. Installation
```bash
# Clone & install dependencies
cd tourneymaster-ai
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Database Setup
Run the SQL migration in `supabase/migrations/001_initial_schema.sql` in your Supabase SQL Editor.

### 5. Running the Application
```bash
# Start development server
npm run dev

# Run unit tests
npm test

# Check TypeScript types
npm run typecheck

# Build for production
npm run build
```

---

## 🧪 Testing

The test suite contains **181 tests** across 11 test suites verifying:
- Table tennis scoring rules (target 7 for groups, 11 for knockout, 15 for finals, 2-point lead rule)
- Group balancing & snake seeding
- Round-robin schedule generation (no duplicates, no self-matches)
- Standings & all tiebreaker scenarios (head-to-head, 3-way circular mini-league)
- Glicko-2 rating updates & volatility (benchmark validated against Mark Glickman's published paper)
- Dynamic bracket generation, cross-group matchups, and byes
- Full 8-player tournament end-to-end simulation lifecycle
- Historical tournament replay (2024–2026) and rating snapshots
- Scalability tests (4 to 100 players)

```bash
# Run unit & integration tests
npm test

# Run Playwright E2E tests
npm run test:e2e
```

---

## 📂 Project Structure

```
tourneymaster-ai/
├── app/
│   ├── (auth)/login/       # Passwordless magic-link authentication
│   ├── (auth)/callback/    # Supabase auth callback
│   ├── admin/              # Admin dashboard & tournament management
│   ├── player/             # Player dashboard & score entry
│   ├── t/[slug]/           # Tournament QR target landing page
│   ├── globals.css         # Tailwind v4 dark theme styles
│   └── layout.tsx          # Root layout & PWA metadata
├── components/
│   ├── bracket/            # Interactive tournament bracket
│   ├── matches/            # MatchCard & mobile ScoreInput
│   ├── standings/          # StandingsTable & MysteryModeBlock
│   └── tournament/         # QRCodeView
├── hooks/                  # Realtime & Auth hooks
├── lib/
│   ├── actions/            # Next.js Server Actions (mutations)
│   ├── engine/             # Pure TypeScript domain logic (no side-effects)
│   │   ├── bracket.ts      # Elimination bracket generation
│   │   ├── constants.ts    # Scoring constants & status enums
│   │   ├── groups.ts       # Group calculation (1-4) & balancing
│   │   ├── historical.ts   # Historical archive & Glicko-2 replay
│   │   ├── rating.ts       # Glicko-2 rating engine
│   │   ├── schedule.ts     # Round-robin pairings
│   │   ├── scoring.ts      # Score validation (7/11/15)
│   │   ├── seeding.ts      # Deterministic snake seeding
│   │   ├── standings.ts    # Group standings & tiebreakers
│   │   └── tournament-state.ts # State machine transitions & guards
│   ├── supabase/           # SSR-safe Supabase clients & middleware
│   ├── types/              # Database & domain type definitions
│   └── validation/         # Zod schemas
├── public/                 # PWA manifest, icons & offline page
├── supabase/migrations/    # Complete database migration SQL
└── tests/unit/             # Vitest unit test suites
```
