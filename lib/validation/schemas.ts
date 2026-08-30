import { z } from 'zod';

export const createTournamentSchema = z.object({
  name: z.string().min(3, 'Tournament name must be at least 3 characters').max(100),
  hiddenStandings: z.boolean().default(true),
  tournamentType: z.enum(['official', 'test']).default('official'),
});

export const reportScoreSchema = z.object({
  matchId: z.string().uuid('Invalid match ID'),
  scorePlayer1: z.number().int().nonnegative('Score must be non-negative'),
  scorePlayer2: z.number().int().nonnegative('Score must be non-negative'),
});

export const qualifiersConfigSchema = z.object({
  tournamentId: z.string().uuid('Invalid tournament ID'),
  qualifiersPerGroup: z.number().int().min(1, 'At least 1 qualifier per group required').max(8),
});

export const resolveDisputeSchema = z.object({
  matchId: z.string().uuid('Invalid match ID'),
  resolution: z.enum(['accept_score', 'modify_score', 'cancel_match', 'reopen_match']),
  scorePlayer1: z.number().int().nonnegative().optional(),
  scorePlayer2: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export const importHistoricalSchema = z.object({
  sourceName: z.string().min(1),
  records: z.array(z.object({
    tournamentName: z.string().min(1),
    year: z.number().int().min(2000).max(2100),
    tournamentDate: z.string(),
    stage: z.enum(['group', 'round_of_16', 'quarterfinal', 'semifinal', 'final']),
    groupCode: z.string().optional(),
    player1Name: z.string().min(1),
    player2Name: z.string().min(1),
    score1: z.number().int().nonnegative(),
    score2: z.number().int().nonnegative(),
    winnerName: z.string().optional(),
  })),
});
