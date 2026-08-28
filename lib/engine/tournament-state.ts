import type { TournamentStatus, GroupStatus } from './constants';

/** Valid state transitions */
const VALID_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ['registration'],
  registration: ['group_stage'],
  group_stage: ['bracket_stage'],
  bracket_stage: ['finished'],
  finished: [],
};

/** State transition requirements */
export interface TransitionContext {
  totalPlayers: number;
  groupsGenerated: boolean;
  allGroupsCompleted: boolean;
  qualifiersConfigured: boolean;
  bracketGenerated: boolean;
  finalCompleted: boolean;
  groupStatuses: GroupStatus[];
}

/**
 * Check if a state transition is valid.
 */
export function canTransition(from: TournamentStatus, to: TournamentStatus): boolean {
  const valid = VALID_TRANSITIONS[from];
  return valid?.includes(to) ?? false;
}

/**
 * Validate all requirements for a specific state transition.
 * Returns list of unmet requirements.
 */
export function validateTransitionRequirements(
  from: TournamentStatus,
  to: TournamentStatus,
  context: TransitionContext
): { allowed: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!canTransition(from, to)) {
    errors.push(`Cannot transition from '${from}' to '${to}'`);
    return { allowed: false, errors };
  }

  switch (to) {
    case 'registration':
      // No special requirements to open registration
      break;

    case 'group_stage':
      if (context.totalPlayers < 4) {
        errors.push('Need at least 4 players to start group stage');
      }
      if (!context.groupsGenerated) {
        errors.push('Groups must be generated before starting group stage');
      }
      break;

    case 'bracket_stage':
      if (!context.allGroupsCompleted) {
        errors.push('All groups must be completed before starting bracket stage');
      }
      if (!context.qualifiersConfigured) {
        errors.push('Qualifiers per group must be configured before generating bracket');
      }
      // Check each group is completed
      for (let i = 0; i < context.groupStatuses.length; i++) {
        const status = context.groupStatuses[i];
        if (status !== 'completed') {
          errors.push(`Group ${String.fromCharCode(65 + i)} is not completed (status: ${status})`);
        }
      }
      break;

    case 'finished':
      if (!context.finalCompleted) {
        errors.push('Final match must be completed before finishing tournament');
      }
      break;
  }

  return { allowed: errors.length === 0, errors };
}

/**
 * Check if a group is complete.
 * A group is complete when all expected matches are confirmed
 * and there are no pending, submitted, or disputed matches.
 */
export function isGroupComplete(
  confirmedCount: number,
  expectedCount: number,
  pendingCount: number,
  submittedCount: number,
  disputedCount: number
): boolean {
  return (
    confirmedCount === expectedCount &&
    pendingCount === 0 &&
    submittedCount === 0 &&
    disputedCount === 0
  );
}

/**
 * Check if mystery mode should be active for a group.
 * Mystery mode is active while the group has any unresolved matches.
 */
export function isMysteryModeActive(
  pendingCount: number,
  submittedCount: number,
  disputedCount: number
): boolean {
  return pendingCount > 0 || submittedCount > 0 || disputedCount > 0;
}

/**
 * Determine if standings should be visible for a player.
 * - Admin: always visible
 * - Player: only visible when mystery mode is inactive (group complete)
 * - Hidden standings tournament config also affects this
 */
export function areStandingsVisible(
  isAdmin: boolean,
  hiddenStandings: boolean,
  mysteryModeActive: boolean
): boolean {
  if (isAdmin) return true;
  if (!hiddenStandings) return !mysteryModeActive;
  return !mysteryModeActive;
}
