# TourneyMaster AI — Security Audit & Defense-in-Depth Report

---

## 1. Row-Level Security (RLS) Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | All (public profile lookup) | Self (`auth.uid() = id`) | Self (`auth.uid() = id`) or Admin | Admin |
| `tournaments` | All (public view) | Admin only (`is_admin()`) | Admin only (`is_admin()`) | Admin |
| `tournament_config` | All | Admin only | Admin only | Admin |
| `tournament_groups` | All | Admin only | Admin only | Admin |
| `tournament_participants` | All | Self (if `status = 'registration'`) or Admin | Admin only | Admin |
| `matches` | All | Admin only | Match participants or Admin | Admin |
| `match_reports` | All | Reporter (`auth.uid() = reported_by`) | None (Immutable reports) | Admin |
| `audit_logs` | Admin only | System / Trigger | None (Immutable) | None |
| `players` | All | Admin only | Admin only | Admin |
| `player_aliases` | All | Admin only | Admin only | Admin |
| `historical_*` | All | Admin only | Admin only | Admin |
| `rating_*` | All | Admin only | Admin only | Admin |

---

## 2. Mystery Mode Server-Side Leakage Defense

- **Vulnerability**: Client-side component hiding can leak standings through network responses, devtools, or JSON props.
- **Server Guard**:
  - The function `areStandingsVisible(isAdmin, hiddenStandings, mysteryModeActive)` enforces that regular players cannot view standings while mystery mode is active.
  - Server actions and server components do not compute or serialize group ranking positions to non-admin clients while any matches in the group remain unconfirmed.

---

## 3. Concurrency & Race Condition Elimination

- **Double-Confirmation Guard**:
  - Server action `confirmMatchAction` executes an idempotency check: if `status === 'confirmed'`, returns immediately without calculating ratings.
  - Database stored procedure `confirm_match` locks the match row `FOR UPDATE`, ensuring only the first concurrent confirmation succeeds.
