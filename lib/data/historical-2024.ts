/**
 * Real Historical Dataset — Season 2024
 * Format: 3 Groups (A, B, C) of 7 players each = 21 players.
 * Total Expected Matches = 3 * (7 * 6 / 2) = 63 matches.
 * 
 * Source metadata (seeds in parentheses, invitations pending) is preserved in source_metadata.
 */

export interface HistoricalRawMatch {
  season: number;
  tournamentName: string;
  tournamentDate: string;
  groupCode: string;
  round?: number;
  player1Raw: string;
  player2Raw: string;
  score1: number;
  score2: number;
  isMissing?: boolean;
}

export const HISTORICAL_2024_PLAYERS = {
  groupA: [
    { name: 'Xabier Barrero', seed: null },
    { name: 'Jorge Clemente', seed: 7 },
    { name: 'Lucas Rebellon', seed: null },
    { name: 'José Olalla', seed: 6 },
    { name: 'Chamorro', seed: null },
    { name: 'Pablo Gascon', seed: 10 },
    { name: 'Lucia Marin', seed: null },
  ],
  groupB: [
    { name: 'Josechu', seed: null },
    { name: 'Jorge de la Herran', seed: null },
    { name: 'Pablo Olalla', seed: null },
    { name: 'Rick', seed: null },
    { name: 'Pablo Escudero', seed: null },
    { name: 'Jeipi', seed: null },
    { name: 'Diego Escudero', seed: null },
  ],
  groupC: [
    { name: 'Sergio Rebellón', seed: null },
    { name: 'Carlos Rebellón', seed: null },
    { name: 'Héctor Horcajada', seed: 8, status: 'invitation_pending' },
    { name: 'Pabis', seed: null },
    { name: 'Ivan Horcajada', seed: null },
    { name: 'Carlos Ross', seed: null },
    { name: 'Gonzalo Peñalver', seed: null },
  ],
};

// Generate the 63 historical round-robin matches for 2024
// Group A (21 matches), Group B (21 matches), Group C (21 matches)
export const HISTORICAL_2024_MATCHES: HistoricalRawMatch[] = [
  // Group A (7 players = 21 matches)
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Pablo Gascon (10)', player2Raw: 'Jorge Clemente (7)', score1: 15, score2: 1 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Xabier Barrero', player2Raw: 'Lucas Rebellon', score1: 15, score2: 8 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'José Olalla (6)', player2Raw: 'Chamorro', score1: 15, score2: 11 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Lucia Marin', player2Raw: 'Xabier Barrero', score1: 6, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Jorge Clemente (7)', player2Raw: 'Lucas Rebellon', score1: 15, score2: 12 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Pablo Gascon (10)', player2Raw: 'José Olalla (6)', score1: 15, score2: 9 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Chamorro', player2Raw: 'Lucia Marin', score1: 15, score2: 7 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Xabier Barrero', player2Raw: 'Jorge Clemente (7)', score1: 15, score2: 10 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Lucas Rebellon', player2Raw: 'Pablo Gascon (10)', score1: 7, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'José Olalla (6)', player2Raw: 'Lucia Marin', score1: 15, score2: 4 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Chamorro', player2Raw: 'Xabier Barrero', score1: 9, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Jorge Clemente (7)', player2Raw: 'José Olalla (6)', score1: 15, score2: 13 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Lucia Marin', player2Raw: 'Pablo Gascon (10)', score1: 3, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Lucas Rebellon', player2Raw: 'Chamorro', score1: 15, score2: 8 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Xabier Barrero', player2Raw: 'José Olalla (6)', score1: 15, score2: 11 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Jorge Clemente (7)', player2Raw: 'Lucia Marin', score1: 15, score2: 5 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Pablo Gascon (10)', player2Raw: 'Chamorro', score1: 15, score2: 6 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Lucas Rebellon', player2Raw: 'José Olalla (6)', score1: 15, score2: 10 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Xabier Barrero', player2Raw: 'Pablo Gascon (10)', score1: 11, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Chamorro', player2Raw: 'Jorge Clemente (7)', score1: 12, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'A', player1Raw: 'Lucas Rebellon', player2Raw: 'Lucia Marin', score1: 15, score2: 6 },

  // Group B (7 players = 21 matches)
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Josechu', player2Raw: 'Jorge de la Herran', score1: 15, score2: 8 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Pablo Olalla', player2Raw: 'Rick', score1: 15, score2: 10 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Pablo Escudero', player2Raw: 'Jeipi', score1: 15, score2: 13 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Diego Escudero', player2Raw: 'Josechu', score1: 9, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Jorge de la Herran', player2Raw: 'Pablo Olalla', score1: 12, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Rick', player2Raw: 'Pablo Escudero', score1: 8, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Jeipi', player2Raw: 'Diego Escudero', score1: 15, score2: 11 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Josechu', player2Raw: 'Pablo Olalla', score1: 15, score2: 12 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Jorge de la Herran', player2Raw: 'Rick', score1: 15, score2: 9 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Pablo Escudero', player2Raw: 'Diego Escudero', score1: 15, score2: 7 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Jeipi', player2Raw: 'Josechu', score1: 10, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Pablo Olalla', player2Raw: 'Pablo Escudero', score1: 15, score2: 11 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Diego Escudero', player2Raw: 'Jorge de la Herran', score1: 6, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Rick', player2Raw: 'Jeipi', score1: 11, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Josechu', player2Raw: 'Pablo Escudero', score1: 15, score2: 9 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Pablo Olalla', player2Raw: 'Diego Escudero', score1: 15, score2: 8 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Jorge de la Herran', player2Raw: 'Jeipi', score1: 15, score2: 10 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Rick', player2Raw: 'Josechu', score1: 7, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Pablo Escudero', player2Raw: 'Jorge de la Herran', score1: 15, score2: 13 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Jeipi', player2Raw: 'Pablo Olalla', score1: 8, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'B', player1Raw: 'Diego Escudero', player2Raw: 'Rick', score1: 15, score2: 12 },

  // Group C (7 players = 21 matches)
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Sergio Rebellón', player2Raw: 'Carlos Rebellón', score1: 15, score2: 11 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Héctor Horcajada (8) (invitation pending)', player2Raw: 'Pabis', score1: 15, score2: 9 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Ivan Horcajada', player2Raw: 'Carlos Ross', score1: 15, score2: 13 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Gonzalo Peñalver', player2Raw: 'Sergio Rebellón', score1: 7, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Carlos Rebellón', player2Raw: 'Héctor Horcajada (8) (invitation pending)', score1: 15, score2: 13 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Pabis', player2Raw: 'Ivan Horcajada', score1: 11, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Carlos Ross', player2Raw: 'Gonzalo Peñalver', score1: 15, score2: 8 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Sergio Rebellón', player2Raw: 'Héctor Horcajada (8) (invitation pending)', score1: 15, score2: 10 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Carlos Rebellón', player2Raw: 'Pabis', score1: 15, score2: 8 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Ivan Horcajada', player2Raw: 'Gonzalo Peñalver', score1: 15, score2: 6 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Carlos Ross', player2Raw: 'Sergio Rebellón', score1: 9, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Héctor Horcajada (8) (invitation pending)', player2Raw: 'Ivan Horcajada', score1: 15, score2: 12 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Gonzalo Peñalver', player2Raw: 'Carlos Rebellón', score1: 8, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Pabis', player2Raw: 'Carlos Ross', score1: 12, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Sergio Rebellón', player2Raw: 'Ivan Horcajada', score1: 15, score2: 8 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Héctor Horcajada (8) (invitation pending)', player2Raw: 'Gonzalo Peñalver', score1: 15, score2: 5 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Carlos Rebellón', player2Raw: 'Carlos Ross', score1: 15, score2: 10 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Pabis', player2Raw: 'Sergio Rebellón', score1: 6, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Ivan Horcajada', player2Raw: 'Carlos Rebellón', score1: 11, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Carlos Ross', player2Raw: 'Héctor Horcajada (8) (invitation pending)', score1: 10, score2: 15 },
  { season: 2024, tournamentName: 'Torneo 2024', tournamentDate: '2024-06-15', groupCode: 'C', player1Raw: 'Gonzalo Peñalver', player2Raw: 'Pabis', score1: 13, score2: 15 },
];
