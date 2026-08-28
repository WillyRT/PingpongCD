# TourneyMaster AI — Runtime Data Audit Report

**Date**: 2026-08-24  
**Audit Objective**: Verify runtime data provenance, eliminate static fixture dependencies in runtime views, validate historical datasets, and inspect identity reconciliation matrices.

---

## 1. Historical Dataset Verification

| Season | Groups | Players | Expected Matches | Complete Matches | Missing Matches | Season Status |
|---|---|---|---|---|---|---|
| **2024** | 3 (A, B, C) | 21 | 63 | 63 | 0 | `COMPLETE` |
| **2025** | 4 (A, B, C, D) | 29 | 91 | 91 | 0 | `COMPLETE` |
| **2026** | 4 (A, B, C, D) | 24 | 60 | 59 | 1 (Carlos Ross vs Lucia Marin) | `INCOMPLETE` |
| **Total** | 11 | **29 unique** | **214** | **213** | **1** | — |

---

## 2. Runtime Source vs Static Data Audit (Leak Fixed)

- **Previous Defect**: Runtime pages (`/leaderboard`, `/player`, `/admin/historical/diagnostics`) were importing static fixture files (`lib/data/historical-*`) rather than querying live database tables.
- **Remediation**:
  - `app/leaderboard/page.tsx`: Refactored to query `rating_states`, `players`, and `historical_matches` from Supabase. Displays dynamic rankings and provides a guided seed prompt if database tables are uninitialized.
  - `app/player/page.tsx`: Refactored to query `rating_snapshots` and `players` from Supabase.
  - `app/admin/historical/diagnostics/page.tsx`: Refactored to query `historical_tournaments`, `historical_matches`, and `player_aliases` directly from PostgreSQL tables.
  - Files under `lib/data/` remain strictly as import fixtures for initial seeding.

---

## 3. Player Identity Reconciliation

- **Canonical Entities**: 29 unique canonical players cataloged in `identity-reconciliation.json`.
- **Investigated Cases**:
  - `Javier Benito / Javi Benito`: `PROBABLE` (Requires admin confirmation before merge).
  - `Isa Planas / Isabel Planas`: `PROBABLE` (Requires admin confirmation before merge).
  - `Santi Teherán / Santiago Terán / Santi Terán`: `PROBABLE` (Requires admin confirmation before merge).
  - `Luis Valdés / Luis valdes`: `CONFIRMED` (Diacritic/case normalization).
  - `Miguel DR / Miguel de Rodrigo / Miguel Rodrigo`: `PROBABLE` (Abbreviation requires admin confirmation).
  - `Gonzalo López / González López`: `UNRESOLVED` (Distinct first/last names, kept separate).
  - `Pablo Gascon / Pablo Gascón`: `CONFIRMED` (Accent mark variation).
  - `Lucas Rebellon / Lucas Rebellón`: `CONFIRMED` (Accent mark variation).
  - `Sergio Rebellon / Sergio Rebellón`: `CONFIRMED` (Accent mark variation).
  - `Ivan / Iván Horcajada`: `CONFIRMED` (Accent mark variation).
