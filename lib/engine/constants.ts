// Scoring targets
export const GROUP_TARGET = 7;
export const KNOCKOUT_TARGET = 11;
export const FINAL_TARGET = 15;
export const REQUIRED_DIFFERENCE = 2;

// Tournament structure
export const MAX_GROUPS = 4;
export const MIN_PLAYERS = 4;

// Group count thresholds
export const GROUP_THRESHOLDS = [
  { min: 4, max: 7, groups: 1 },
  { min: 8, max: 11, groups: 2 },
  { min: 12, max: 15, groups: 3 },
  { min: 16, max: Infinity, groups: 4 },
] as const;

// Rating defaults (Glicko-2)
export const DEFAULT_RATING = 1500;
export const DEFAULT_RATING_DEVIATION = 350;
export const DEFAULT_VOLATILITY = 0.06;
export const GLICKO2_TAU = 0.5;
export const GLICKO2_EPSILON = 0.000001;
export const GLICKO2_SCALE = 173.7178;

// Match stages
export const MATCH_STAGES = ['group', 'round_of_16', 'quarterfinal', 'semifinal', 'final'] as const;
export type MatchStage = typeof MATCH_STAGES[number];

// Match statuses
export const MATCH_STATUSES = [
  'pending',
  'submitted',
  'reported',
  'confirmed',
  'disputed',
  'scheduled',
  'in_progress',
  'pending_verification',
  'completed',
  'walkover',
] as const;
export type MatchStatus = typeof MATCH_STATUSES[number];

// Tournament statuses
export const TOURNAMENT_STATUSES = ['draft', 'registration', 'group_stage', 'bracket_stage', 'finished'] as const;
export type TournamentStatus = typeof TOURNAMENT_STATUSES[number];

// Group statuses
export const GROUP_STATUSES = ['pending', 'active', 'completed'] as const;
export type GroupStatus = typeof GROUP_STATUSES[number];

// Helper to get target points for a given stage
export function getTargetPointsForStage(stage: MatchStage): number {
  switch (stage) {
    case 'group': return GROUP_TARGET;
    case 'final': return FINAL_TARGET;
    default: return KNOCKOUT_TARGET; // round_of_16, quarterfinal, semifinal
  }
}

// Superadmin Principal
export const SUPER_ADMIN_EMAIL =
  process.env.ROOT_SUPERADMIN_EMAIL?.toLowerCase().trim() || 'guillermoriveraterriza@gmail.com';

