import type { HistoricalRawMatch } from './historical-2024';

export const HISTORICAL_2026_PLAYERS = {
  groupA: ['Pablo Gascon', 'Lucas Rebellon', 'Carlos Ross', 'Xabier Barrero', 'Chamorro', 'Lucia Marin'],
  groupB: ['Pablo Olalla', 'Sergio Rebellón', 'Carlos Rebellón', 'Rick', 'Pablo Escudero', 'Jeipi'],
  groupC: ['Héctor Horcajada', 'José Olalla', 'Jorge de la Herran', 'Ivan Horcajada', 'Pabis', 'Diego Escudero'],
  groupD: ['Alvaro Peña', 'Jaime Martin', 'David Ruiz', 'Jorge Clemente', 'Josechu', 'Victor Gomez'],
};

// 59 supplied matches + 1 missing match in Group A (Carlos Ross vs Lucia Marin)
export const HISTORICAL_2026_MATCHES: HistoricalRawMatch[] = [
  // Group A (6 players = 15 expected, 14 supplied, 1 missing)
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Pablo Gascon', player2Raw: 'Lucas Rebellon', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Carlos Ross', player2Raw: 'Xabier Barrero', score1: 5, score2: 7 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Chamorro', player2Raw: 'Lucia Marin', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Pablo Gascon', player2Raw: 'Carlos Ross', score1: 7, score2: 2 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Lucas Rebellon', player2Raw: 'Xabier Barrero', score1: 4, score2: 7 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Pablo Gascon', player2Raw: 'Xabier Barrero', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Lucas Rebellon', player2Raw: 'Chamorro', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Carlos Ross', player2Raw: 'Chamorro', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Xabier Barrero', player2Raw: 'Lucia Marin', score1: 7, score2: 1 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Pablo Gascon', player2Raw: 'Chamorro', score1: 7, score2: 2 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Lucas Rebellon', player2Raw: 'Lucia Marin', score1: 7, score2: 2 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Pablo Gascon', player2Raw: 'Lucia Marin', score1: 7, score2: 1 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Lucas Rebellon', player2Raw: 'Carlos Ross', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Xabier Barrero', player2Raw: 'Chamorro', score1: 7, score2: 4 },
  // Explicitly tracked MISSING match (Group A)
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'A', player1Raw: 'Carlos Ross', player2Raw: 'Lucia Marin', score1: 0, score2: 0, isMissing: true },

  // Group B (6 players = 15 matches)
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Pablo Olalla', player2Raw: 'Sergio Rebellón', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Carlos Rebellón', player2Raw: 'Rick', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Pablo Escudero', player2Raw: 'Jeipi', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Pablo Olalla', player2Raw: 'Carlos Rebellón', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Sergio Rebellón', player2Raw: 'Rick', score1: 7, score2: 2 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Pablo Olalla', player2Raw: 'Rick', score1: 7, score2: 1 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Sergio Rebellón', player2Raw: 'Pablo Escudero', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Carlos Rebellón', player2Raw: 'Pablo Escudero', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Rick', player2Raw: 'Jeipi', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Pablo Olalla', player2Raw: 'Pablo Escudero', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Sergio Rebellón', player2Raw: 'Jeipi', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Pablo Olalla', player2Raw: 'Jeipi', score1: 7, score2: 2 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Sergio Rebellón', player2Raw: 'Carlos Rebellón', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Carlos Rebellón', player2Raw: 'Jeipi', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'B', player1Raw: 'Rick', player2Raw: 'Pablo Escudero', score1: 3, score2: 7 },

  // Group C (6 players = 15 matches)
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Héctor Horcajada', player2Raw: 'José Olalla', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Jorge de la Herran', player2Raw: 'Ivan Horcajada', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Pabis', player2Raw: 'Diego Escudero', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Héctor Horcajada', player2Raw: 'Jorge de la Herran', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'José Olalla', player2Raw: 'Ivan Horcajada', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Héctor Horcajada', player2Raw: 'Ivan Horcajada', score1: 7, score2: 2 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'José Olalla', player2Raw: 'Pabis', score1: 7, score2: 2 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Jorge de la Herran', player2Raw: 'Pabis', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Ivan Horcajada', player2Raw: 'Diego Escudero', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Héctor Horcajada', player2Raw: 'Pabis', score1: 7, score2: 1 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'José Olalla', player2Raw: 'Diego Escudero', score1: 7, score2: 2 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Héctor Horcajada', player2Raw: 'Diego Escudero', score1: 7, score2: 1 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'José Olalla', player2Raw: 'Jorge de la Herran', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Jorge de la Herran', player2Raw: 'Diego Escudero', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'C', player1Raw: 'Ivan Horcajada', player2Raw: 'Pabis', score1: 7, score2: 5 },

  // Group D (6 players = 15 matches)
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Alvaro Peña', player2Raw: 'Jaime Martin', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'David Ruiz', player2Raw: 'Jorge Clemente', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Josechu', player2Raw: 'Victor Gomez', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Alvaro Peña', player2Raw: 'David Ruiz', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Jaime Martin', player2Raw: 'Jorge Clemente', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Alvaro Peña', player2Raw: 'Jorge Clemente', score1: 7, score2: 2 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Jaime Martin', player2Raw: 'Josechu', score1: 7, score2: 4 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'David Ruiz', player2Raw: 'Josechu', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Jorge Clemente', player2Raw: 'Victor Gomez', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Alvaro Peña', player2Raw: 'Josechu', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Jaime Martin', player2Raw: 'Victor Gomez', score1: 7, score2: 2 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Alvaro Peña', player2Raw: 'Victor Gomez', score1: 7, score2: 1 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Jaime Martin', player2Raw: 'David Ruiz', score1: 7, score2: 5 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'David Ruiz', player2Raw: 'Victor Gomez', score1: 7, score2: 3 },
  { season: 2026, tournamentName: 'Torneo 2026', tournamentDate: '2026-02-20', groupCode: 'D', player1Raw: 'Jorge Clemente', player2Raw: 'Josechu', score1: 7, score2: 4 },
];
