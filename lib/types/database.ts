/**
 * Database types matching the Supabase schema.
 * These use snake_case to match PostgreSQL column names.
 * Domain types in domain.ts use camelCase.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      tournaments: {
        Row: TournamentRow;
        Insert: TournamentInsert;
        Update: TournamentUpdate;
        Relationships: [];
      };
      tournament_config: {
        Row: TournamentConfigRow;
        Insert: TournamentConfigInsert;
        Update: TournamentConfigUpdate;
        Relationships: [];
      };
      tournament_groups: {
        Row: TournamentGroupRow;
        Insert: TournamentGroupInsert;
        Update: TournamentGroupUpdate;
        Relationships: [];
      };
      tournament_participants: {
        Row: TournamentParticipantRow;
        Insert: TournamentParticipantInsert;
        Update: TournamentParticipantUpdate;
        Relationships: [];
      };
      matches: {
        Row: MatchRow;
        Insert: MatchInsert;
        Update: MatchUpdate;
        Relationships: [];
      };
      match_reports: {
        Row: MatchReportRow;
        Insert: MatchReportInsert;
        Update: MatchReportUpdate;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: AuditLogInsert;
        Update: AuditLogUpdate;
        Relationships: [];
      };
      // Historical Archive
      players: {
        Row: PlayerRow;
        Insert: PlayerInsert;
        Update: PlayerUpdate;
        Relationships: [];
      };
      player_aliases: {
        Row: PlayerAliasRow;
        Insert: PlayerAliasInsert;
        Update: PlayerAliasUpdate;
        Relationships: [];
      };
      historical_imports: {
        Row: HistoricalImportRow;
        Insert: HistoricalImportInsert;
        Update: HistoricalImportUpdate;
        Relationships: [];
      };
      historical_tournaments: {
        Row: HistoricalTournamentRow;
        Insert: HistoricalTournamentInsert;
        Update: HistoricalTournamentUpdate;
        Relationships: [];
      };
      historical_groups: {
        Row: HistoricalGroupRow;
        Insert: HistoricalGroupInsert;
        Update: HistoricalGroupUpdate;
        Relationships: [];
      };
      historical_matches: {
        Row: HistoricalMatchRow;
        Insert: HistoricalMatchInsert;
        Update: HistoricalMatchUpdate;
        Relationships: [];
      };
      rating_states: {
        Row: RatingStateRow;
        Insert: RatingStateInsert;
        Update: RatingStateUpdate;
        Relationships: [];
      };
      rating_snapshots: {
        Row: RatingSnapshotRow;
        Insert: RatingSnapshotInsert;
        Update: RatingSnapshotUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ========== PROFILES ==========
export interface ProfileRow {
  id: string;
  user_id?: string | null;
  name: string;
  nickname?: string | null;
  email: string | null;
  phone: string | null;
  role: 'super_admin' | 'admin' | 'player';
  admin_status: 'none' | 'pending' | 'approved' | 'rejected';
  declared_level: number | null;
  birth_date: string | null;
  category: 'sub14' | 'plus14' | null;
  rating: number;
  rating_deviation: number;
  volatility: number;
  matches_played: number;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Omit<ProfileRow, 'created_at' | 'updated_at'>;
export type ProfileUpdate = Partial<Omit<ProfileRow, 'id' | 'created_at'>>;

// ========== TOURNAMENTS ==========
export interface TournamentRow {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'registration' | 'group_stage' | 'bracket_stage' | 'finished';
  hidden_standings: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type TournamentInsert = Omit<TournamentRow, 'id' | 'created_at' | 'updated_at'>;
export type TournamentUpdate = Partial<Omit<TournamentRow, 'id' | 'created_at' | 'created_by'>>;

// ========== TOURNAMENT CONFIG ==========
export interface TournamentConfigRow {
  id: string;
  tournament_id: string;
  total_players: number | null;
  group_count: number | null;
  group_sizes: number[] | null;
  hidden_standings: boolean;
  group_target_points: number;
  knockout_target_points: number;
  final_target_points: number;
  required_difference: number;
  qualifiers_per_group: number | null;
}

export type TournamentConfigInsert = Omit<TournamentConfigRow, 'id'>;
export type TournamentConfigUpdate = Partial<Omit<TournamentConfigRow, 'id' | 'tournament_id'>>;

// ========== TOURNAMENT GROUPS ==========
export interface TournamentGroupRow {
  id: string;
  tournament_id: string;
  category: 'sub14' | 'plus14';
  group_code: string;
  status: 'pending' | 'active' | 'completed';
  expected_matches: number;
  completed_at: string | null;
}

export type TournamentGroupInsert = Omit<TournamentGroupRow, 'id' | 'completed_at'>;
export type TournamentGroupUpdate = Partial<Omit<TournamentGroupRow, 'id' | 'tournament_id'>>;

// ========== TOURNAMENT PARTICIPANTS ==========
export interface TournamentParticipantRow {
  tournament_id: string;
  user_id: string;
  category: 'sub14' | 'plus14';
  declared_level: number | null;
  group_id: string | null;
  seed_number: number | null;
  joined_at: string;
}

export type TournamentParticipantInsert = Omit<TournamentParticipantRow, 'joined_at'>;
export type TournamentParticipantUpdate = Partial<Omit<TournamentParticipantRow, 'tournament_id' | 'user_id' | 'joined_at'>>;

// ========== MATCHES ==========
export interface MatchRow {
  id: string;
  tournament_id: string;
  category: 'sub14' | 'plus14';
  stage: 'group' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final';
  group_id: string | null;
  bracket_match_id: string | null;
  player1_id: string;
  player2_id: string;
  score_player1: number | null;
  score_player2: number | null;
  winner_id: string | null;
  reported_by: string | null;
  confirmed_by: string | null;
  status: 'pending' | 'submitted' | 'confirmed' | 'disputed';
  win_expectancy_p1: number | null;
  win_expectancy_p2: number | null;
  is_upset: boolean;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
}

export type MatchInsert = Omit<MatchRow, 'id' | 'created_at' | 'updated_at' | 'confirmed_at'>;
export type MatchUpdate = Partial<Omit<MatchRow, 'id' | 'tournament_id' | 'created_at'>>;

// ========== MATCH REPORTS ==========
export interface MatchReportRow {
  id: string;
  match_id: string;
  reported_by: string;
  score_player1: number;
  score_player2: number;
  created_at: string;
}

export type MatchReportInsert = Omit<MatchReportRow, 'id' | 'created_at'>;
export type MatchReportUpdate = Partial<Omit<MatchReportRow, 'id' | 'created_at'>>;

// ========== AUDIT LOGS ==========
export interface AuditLogRow {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export type AuditLogInsert = Omit<AuditLogRow, 'id' | 'created_at'>;
export type AuditLogUpdate = Partial<Omit<AuditLogRow, 'id' | 'created_at'>>;

// ========== HISTORICAL ARCHIVE TABLES ==========

export interface PlayerRow {
  id: string;
  canonical_name: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type PlayerInsert = Omit<PlayerRow, 'created_at' | 'updated_at'>;
export type PlayerUpdate = Partial<Omit<PlayerRow, 'id' | 'created_at'>>;

export interface PlayerAliasRow {
  id: string;
  player_id: string;
  alias: string;
  source_system: string;
  created_at: string;
}

export type PlayerAliasInsert = Omit<PlayerAliasRow, 'id' | 'created_at'>;
export type PlayerAliasUpdate = Partial<Omit<PlayerAliasRow, 'id' | 'created_at'>>;

export interface HistoricalImportRow {
  id: string;
  source_name: string;
  import_date: string;
  imported_by: string;
  raw_payload: Record<string, unknown> | null;
  status: 'pending' | 'processed' | 'failed';
  records_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type HistoricalImportInsert = Omit<HistoricalImportRow, 'id' | 'created_at'>;
export type HistoricalImportUpdate = Partial<Omit<HistoricalImportRow, 'id' | 'created_at'>>;

export interface HistoricalTournamentRow {
  id: string;
  import_id: string | null;
  name: string;
  slug: string;
  year: number;
  tournament_date: string;
  location: string | null;
  format_details: Record<string, unknown> | null;
  created_at: string;
}

export type HistoricalTournamentInsert = Omit<HistoricalTournamentRow, 'id' | 'created_at'>;
export type HistoricalTournamentUpdate = Partial<Omit<HistoricalTournamentRow, 'id' | 'created_at'>>;

export interface HistoricalGroupRow {
  id: string;
  historical_tournament_id: string;
  group_code: string;
  expected_matches: number;
  created_at: string;
}

export type HistoricalGroupInsert = Omit<HistoricalGroupRow, 'id' | 'created_at'>;
export type HistoricalGroupUpdate = Partial<Omit<HistoricalGroupRow, 'id' | 'created_at'>>;

export interface HistoricalMatchRow {
  id: string;
  historical_tournament_id: string;
  historical_group_id: string | null;
  stage: string;
  player1_id: string;
  player2_id: string;
  score_player1: number;
  score_player2: number;
  winner_id: string;
  match_date: string | null;
  source_record: Record<string, unknown> | null;
  created_at: string;
}

export type HistoricalMatchInsert = Omit<HistoricalMatchRow, 'id' | 'created_at'>;
export type HistoricalMatchUpdate = Partial<Omit<HistoricalMatchRow, 'id' | 'created_at'>>;

export interface RatingStateRow {
  player_id: string;
  rating: number;
  rating_deviation: number;
  volatility: number;
  matches_played: number;
  last_calculated_at: string;
  updated_at: string;
}

export type RatingStateInsert = RatingStateRow;
export type RatingStateUpdate = Partial<Omit<RatingStateRow, 'player_id'>>;

export interface RatingSnapshotRow {
  id: string;
  player_id: string;
  rating_period_id: string;
  period_type: 'historical_tournament' | 'live_tournament' | 'manual_adjustment';
  rating_before: number;
  rd_before: number;
  vol_before: number;
  rating_after: number;
  rd_after: number;
  vol_after: number;
  matches_in_period: number;
  calculated_at: string;
}

export type RatingSnapshotInsert = Omit<RatingSnapshotRow, 'id' | 'calculated_at'>;
export type RatingSnapshotUpdate = Partial<Omit<RatingSnapshotRow, 'id' | 'calculated_at'>>;
