# TourneyMaster AI — Database Schema & Verification Status

**Database Provider**: Supabase (PostgreSQL 15+)  
**Current Integration Status**: `YELLOW` (Application structurally ready; external live credentials required for cloud deployment)

---

## 1. Schema Tables (16 Entities)

| Table | Purpose | Primary Key | Key Constraints / Foreign Keys |
|---|---|---|---|
| `profiles` | User profiles & current Glicko-2 ratings | `id (UUID)` | References `auth.users(id)` |
| `tournaments` | Live tournaments | `id (UUID)` | `slug UNIQUE`, `status CHECK` |
| `tournament_config` | Scoring targets & mystery mode | `id (UUID)` | References `tournaments(id)` |
| `tournament_groups` | Group stage divisions | `id (UUID)` | `UNIQUE(tournament_id, group_code)` |
| `tournament_participants` | Players in tournaments | `(tournament_id, user_id)` | Composite PK, FK to `profiles` |
| `matches` | Live match records | `id (UUID)` | FK to `tournament_groups`, `profiles` |
| `match_reports` | Raw score submissions | `id (UUID)` | FK to `matches`, `profiles` |
| `audit_logs` | Audit trail | `id (UUID)` | FK to `profiles(id)` |
| `players` | Canonical player registry | `id (UUID)` | FK to `profiles(id)` (optional link) |
| `player_aliases` | Normalized player aliases | `id (UUID)` | `UNIQUE(alias, source_system)` |
| `historical_imports` | Import audit batches | `id (UUID)` | FK to `profiles(id)` |
| `historical_tournaments` | Archived tournaments (2024–2026) | `id (UUID)` | `slug UNIQUE` |
| `historical_groups` | Archived groups | `id (UUID)` | `UNIQUE(historical_tournament_id, group_code)` |
| `historical_matches` | Archived matches | `id (UUID)` | FK to `players(id)`, `historical_tournaments` |
| `rating_states` | Current calculated Glicko-2 state | `player_id (UUID)` | FK to `players(id)` |
| `rating_snapshots` | Point-in-time rating history | `id (UUID)` | FK to `players(id)` |

---

## 2. Stored Procedures & Triggers

- **`confirm_match(p_match_id, p_confirming_user_id)`**:
  - `SECURITY DEFINER` function with row-level transaction lock (`SELECT * FROM matches WHERE id = p_match_id FOR UPDATE;`).
  - Verifies reporter cannot confirm own score.
  - Automatically updates winner, sets status to `confirmed`, and records immutable audit log.
- **`update_updated_at()`**:
  - Trigger attached to `profiles`, `tournaments`, `matches`, and `players`.
- **`is_admin()`**:
  - `SECURITY DEFINER STABLE` function checking if `auth.uid()` has `role = 'admin'` in `profiles`.
