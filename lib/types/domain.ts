import type { MatchStage, MatchStatus, TournamentStatus, GroupStatus } from '../engine/constants';

// ============ ROLES & CATEGORIES ============
export type UserRole = 'super_admin' | 'admin' | 'player';
export type AdminStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type AgeCategory = 'sub14' | 'plus14';

// ============ PROFILES ============

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  adminStatus?: AdminStatus;
  declaredLevel?: number | null;
  birthDate?: string | null;
  category?: AgeCategory | null;
  rating: number;
  ratingDeviation: number;
  volatility: number;
  matchesPlayed: number;
  createdAt: string;
  updatedAt: string;
}

// ============ TOURNAMENTS ============

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  status: TournamentStatus;
  hiddenStandings: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentConfig {
  id: string;
  tournamentId: string;
  totalPlayers: number | null;
  groupCount: number | null;
  groupSizes: number[] | null;
  hiddenStandings: boolean;
  groupTargetPoints: number;
  knockoutTargetPoints: number;
  finalTargetPoints: number;
  requiredDifference: number;
  qualifiersPerGroup: number | null;
}

// ============ GROUPS ============

export interface TournamentGroup {
  id: string;
  tournamentId: string;
  category: AgeCategory;
  groupCode: string; // 'A', 'B', 'C', 'D'
  status: GroupStatus;
  expectedMatches: number;
  completedAt: string | null;
}

// ============ PARTICIPANTS ============

export interface TournamentParticipant {
  tournamentId: string;
  userId: string;
  category: AgeCategory;
  declaredLevel?: number | null;
  groupId: string | null;
  seedNumber: number | null;
  joinedAt: string;
  // Joined profile data (for display)
  profile?: Profile;
}

// ============ MATCHES ============

export interface Match {
  id: string;
  tournamentId: string;
  category?: AgeCategory;
  stage: MatchStage;
  groupId: string | null;
  bracketMatchId: string | null;
  player1Id: string;
  player2Id: string;
  scorePlayer1: number | null;
  scorePlayer2: number | null;
  winnerId: string | null;
  reportedBy: string | null;
  confirmedBy: string | null;
  status: MatchStatus;
  winExpectancyP1?: number | null;
  winExpectancyP2?: number | null;
  isUpset?: boolean;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  // Joined data
  player1?: Profile;
  player2?: Profile;
}

// ============ MATCH REPORTS ============

export interface MatchReport {
  id: string;
  matchId: string;
  reportedBy: string;
  scorePlayer1: number;
  scorePlayer2: number;
  createdAt: string;
}

// ============ STANDINGS ============

export interface GroupStanding {
  position: number;
  playerId: string;
  playerName: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  seed: number;
  liveRating?: number;
}

// ============ BRACKET ============

export interface BracketMatchView {
  id: string;
  round: number;
  position: number;
  stage: MatchStage;
  tournamentId?: string;
  category?: AgeCategory;
  player1?: { id: string; name: string } | null;
  player2?: { id: string; name: string } | null;
  player1Id?: string | null;
  player2Id?: string | null;
  player1Name?: string;
  player2Name?: string;
  score1?: number | null;
  score2?: number | null;
  scorePlayer1?: number | null;
  scorePlayer2?: number | null;
  winner?: { id: string; name: string } | null;
  winnerId?: string | null;
  nextMatchId?: string | null;
  nextSlot?: 1 | 2 | null;
  isBye?: boolean;
  status?: string;
}

// ============ AUDIT LOGS ============

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  actorName?: string;
}

// ============ REALTIME PAYLOADS ============

export interface RealtimeMatchPayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Match;
  old: Match | null;
}

export interface RealtimeGroupPayload {
  eventType: 'INSERT' | 'UPDATE';
  new: TournamentGroup;
  old: TournamentGroup | null;
}

export interface RealtimeTournamentPayload {
  eventType: 'UPDATE';
  new: Tournament;
  old: Tournament | null;
}

// ============ COMPOSITE VIEW TYPES ============

export interface TournamentDetailView {
  tournament: Tournament;
  config: TournamentConfig;
  groups: TournamentGroup[];
  participants: TournamentParticipant[];
  matches: Match[];
  standingsByGroup: Map<string, GroupStanding[]>;
  bracketMatches: BracketMatchView[];
  mysteryModeActive: boolean;
  isAdmin: boolean;
}

export interface PlayerDashboardView {
  profile: Profile;
  activeMatches: Match[];
  pendingReports: MatchReport[];
  tournamentHistory: {
    tournament: Tournament;
    finalPosition: number | null;
    ratingDelta: number | null;
  }[];
}

export interface MatchScoreSubmission {
  matchId: string;
  scorePlayer1: number;
  scorePlayer2: number;
}

export interface DisputeResolutionInput {
  matchId: string;
  resolution: 'accept_score' | 'modify_score' | 'cancel_match' | 'reopen_match';
  scorePlayer1?: number;
  scorePlayer2?: number;
  notes?: string;
}

export interface QualifierConfigInput {
  tournamentId: string;
  qualifiersPerGroup: number;
}
