import { describe, it, expect } from 'vitest';
import {
  canTransition,
  validateTransitionRequirements,
  isGroupComplete,
  isMysteryModeActive,
  areStandingsVisible,
  type TransitionContext,
} from '../../lib/engine/tournament-state';

describe('Tournament State Engine', () => {
  describe('canTransition', () => {
    it('should allow valid linear transitions', () => {
      expect(canTransition('draft', 'registration')).toBe(true);
      expect(canTransition('registration', 'group_stage')).toBe(true);
      expect(canTransition('group_stage', 'bracket_stage')).toBe(true);
      expect(canTransition('bracket_stage', 'finished')).toBe(true);
    });

    it('should reject invalid / backwards transitions', () => {
      expect(canTransition('draft', 'bracket_stage')).toBe(false);
      expect(canTransition('finished', 'draft')).toBe(false);
      expect(canTransition('bracket_stage', 'group_stage')).toBe(false);
      expect(canTransition('registration', 'finished')).toBe(false);
    });
  });

  describe('validateTransitionRequirements', () => {
    const baseContext: TransitionContext = {
      totalPlayers: 8,
      groupsGenerated: true,
      allGroupsCompleted: true,
      qualifiersConfigured: true,
      bracketGenerated: true,
      finalCompleted: true,
      groupStatuses: ['completed', 'completed'],
    };

    it('should require minimum 4 players to start group stage', () => {
      const invalid = validateTransitionRequirements('registration', 'group_stage', {
        ...baseContext,
        totalPlayers: 3,
      });
      expect(invalid.allowed).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);

      const valid = validateTransitionRequirements('registration', 'group_stage', {
        ...baseContext,
        totalPlayers: 4,
      });
      expect(valid.allowed).toBe(true);
    });

    it('should require all groups completed and qualifiers configured before bracket stage', () => {
      const notCompleted = validateTransitionRequirements('group_stage', 'bracket_stage', {
        ...baseContext,
        allGroupsCompleted: false,
        groupStatuses: ['completed', 'active'],
      });
      expect(notCompleted.allowed).toBe(false);

      const noQualifiers = validateTransitionRequirements('group_stage', 'bracket_stage', {
        ...baseContext,
        qualifiersConfigured: false,
      });
      expect(noQualifiers.allowed).toBe(false);

      const allGood = validateTransitionRequirements('group_stage', 'bracket_stage', baseContext);
      expect(allGood.allowed).toBe(true);
    });
  });

  describe('isGroupComplete', () => {
    it('should return true only when all expected matches are confirmed with zero pending/submitted/disputed', () => {
      expect(isGroupComplete(15, 15, 0, 0, 0)).toBe(true);
      expect(isGroupComplete(14, 15, 1, 0, 0)).toBe(false);
      expect(isGroupComplete(15, 15, 0, 1, 0)).toBe(false);
      expect(isGroupComplete(15, 15, 0, 0, 1)).toBe(false);
    });
  });

  describe('isMysteryModeActive', () => {
    it('should be active if there are any unresolved matches in the group', () => {
      expect(isMysteryModeActive(1, 0, 0)).toBe(true);
      expect(isMysteryModeActive(0, 1, 0)).toBe(true);
      expect(isMysteryModeActive(0, 0, 1)).toBe(true);
      expect(isMysteryModeActive(0, 0, 0)).toBe(false);
    });
  });

  describe('areStandingsVisible', () => {
    it('should always be visible to admin', () => {
      expect(areStandingsVisible(true, true, true)).toBe(true);
      expect(areStandingsVisible(true, false, true)).toBe(true);
    });

    it('should hide from players when mystery mode is active', () => {
      expect(areStandingsVisible(false, true, true)).toBe(false);
      expect(areStandingsVisible(false, false, true)).toBe(false);
    });

    it('should show to players when group is complete (mystery mode inactive)', () => {
      expect(areStandingsVisible(false, true, false)).toBe(true);
      expect(areStandingsVisible(false, false, false)).toBe(true);
    });
  });
});
