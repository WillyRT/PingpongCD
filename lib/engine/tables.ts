/**
 * 4-Table Station Dispatcher Engine
 * Handles fixed mapping for 4 groups and dynamic FIFO dispatch for < 4 groups and playoffs,
 * preventing idle tables while ensuring no player is scheduled on multiple tables simultaneously.
 */

export const TOTAL_TABLES = 4;

export interface TableMatch {
  id: string;
  stage: string;
  group_id?: string | null;
  table_number?: number | null;
  player1_id: string;
  player2_id: string;
  status: string;
  score_player1?: number | null;
  score_player2?: number | null;
  dispute_reason?: string | null;
  [key: string]: any;
}

export interface GroupEntry {
  id: string;
  group_code: string; // 'A', 'B', 'C', 'D'
  name?: string;
}

export interface TableDispatchState {
  tableNumber: number;
  assignedGroup?: GroupEntry | null;
  currentMatch: TableMatch | null;
  queuedMatches: TableMatch[];
  isIdle: boolean;
  statusLight: 'green' | 'blue' | 'yellow' | 'red';
  statusLabel: string;
}

/**
 * Computes the visual semaphore signal for a table given its current match.
 */
export function getTableSemaphore(match?: TableMatch | null): {
  light: 'green' | 'blue' | 'yellow' | 'red';
  label: string;
} {
  if (!match || match.status === 'completed' || match.status === 'confirmed' || match.status === 'walkover') {
    return { light: 'green', label: 'Libre' };
  }
  if (match.status === 'disputed') {
    return { light: 'red', label: 'En Disputa' };
  }
  if (match.status === 'pending_verification' || match.status === 'submitted') {
    return { light: 'yellow', label: 'Pendiente Confirmación' };
  }
  if (match.status === 'in_progress' || match.status === 'scheduled' || match.status === 'pending') {
    return { light: 'blue', label: 'En Juego' };
  }
  return { light: 'green', label: 'Libre' };
}

/**
 * Dispatches tournament matches across the 4 physical tables.
 *
 * Rules:
 * 1. Exactly 4 groups (group stage):
 *    - Table 1 → Group A
 *    - Table 2 → Group B
 *    - Table 3 → Group C
 *    - Table 4 → Group D
 *
 * 2. Less than 4 groups (< 4) or Bracket Stage (Playoffs):
 *    - Preserves matches with explicit table_number assignment.
 *    - Tracks busy players currently playing or awaiting verification.
 *    - Dispatches free tables dynamically among unplayed matches where BOTH players are available.
 *    - Eliminates idle tables while preventing conflicting simultaneous matches for the same player.
 */
export function dispatchStationTables({
  groups,
  matches,
  isPlayoffs,
}: {
  groups: GroupEntry[];
  matches: TableMatch[];
  isPlayoffs: boolean;
}): TableDispatchState[] {
  const result: TableDispatchState[] = [];

  // Determine if tournament has exactly 4 groups in group stage
  const isFixed4Group = !isPlayoffs && groups.length === 4;

  if (isFixed4Group) {
    // Invariante Física de 4 Mesas en Fase de Grupos:
    // Mesa 1 = Exclusiva Grupo GA
    // Mesa 2 = Exclusiva Grupo GB
    // Mesa 3 = Exclusiva Grupo GC
    // Mesa 4 = Exclusiva Grupo GD
    // Al liberarse la Mesa N, el despachador solo puede asignar el siguiente partido pendiente de su grupo.
    // Si no hay partidos disponibles en ese grupo, la mesa permanece libre (available) sin ser ocupada por otros grupos.
    for (let t = 1; t <= TOTAL_TABLES; t++) {
      const letter = String.fromCharCode(64 + t); // 'A', 'B', 'C', 'D'
      const assignedGroup = groups.find((g) => {
        const code = g.group_code?.toUpperCase();
        return code === letter || code === `G${letter}`;
      }) || (groups[t - 1] ?? null);

      // Exclusive to this group: strictly matches belonging to this group
      const groupMatches = assignedGroup
        ? matches.filter((m) => m.group_id === assignedGroup.id)
        : [];

      // 1. Check for active/ongoing match in this group (disputed > pending_verification > in_progress)
      const activeMatch =
        groupMatches.find((m) => m.table_number === t && m.status === 'disputed') ||
        groupMatches.find((m) => m.status === 'disputed') ||
        groupMatches.find((m) => m.table_number === t && (m.status === 'pending_verification' || m.status === 'submitted')) ||
        groupMatches.find((m) => m.status === 'pending_verification' || m.status === 'submitted') ||
        groupMatches.find((m) => m.table_number === t && m.status === 'in_progress') ||
        groupMatches.find((m) => m.status === 'in_progress');

      // 2. If table is available (freed), assign next pending match strictly from this group
      const nextPending = !activeMatch
        ? groupMatches.find((m) => m.status === 'scheduled' || m.status === 'pending') || null
        : null;

      const current = activeMatch || nextPending;

      // Unplayed remaining matches for this group
      const queue = groupMatches.filter(
        (m) =>
          m.id !== current?.id &&
          m.status !== 'completed' &&
          m.status !== 'confirmed' &&
          m.status !== 'walkover'
      );

      const semaphore = getTableSemaphore(current);

      result.push({
        tableNumber: t,
        assignedGroup,
        currentMatch: current,
        queuedMatches: queue,
        isIdle: current === null,
        statusLight: semaphore.light,
        statusLabel: semaphore.label,
      });
    }

    return result;
  }

  // DYNAMIC DISPATCH (< 4 groups or Playoffs)
  // Step 1: Initialize 4 tables
  const tableAssignments: (TableMatch | null)[] = [null, null, null, null];
  const busyPlayerIds = new Set<string>();

  // Step 2: Lock tables with existing active matches explicitly assigned to table_number (1..4)
  for (let t = 1; t <= TOTAL_TABLES; t++) {
    const explicitMatch = matches.find(
      (m) =>
        m.table_number === t &&
        m.status !== 'completed' &&
        m.status !== 'confirmed' &&
        m.status !== 'walkover'
    );

    if (explicitMatch) {
      tableAssignments[t - 1] = explicitMatch;
      if (explicitMatch.player1_id) busyPlayerIds.add(explicitMatch.player1_id);
      if (explicitMatch.player2_id) busyPlayerIds.add(explicitMatch.player2_id);
    }
  }

  // Step 3: Add busy players from any other active matches (disputed / pending_verification / in_progress)
  for (const m of matches) {
    if (
      m.status === 'in_progress' ||
      m.status === 'pending_verification' ||
      m.status === 'submitted' ||
      m.status === 'disputed'
    ) {
      if (m.player1_id) busyPlayerIds.add(m.player1_id);
      if (m.player2_id) busyPlayerIds.add(m.player2_id);
    }
  }

  // Step 4: Pool of candidate unplayed matches
  const candidateMatches = matches.filter(
    (m) =>
      m.status !== 'completed' &&
      m.status !== 'confirmed' &&
      m.status !== 'walkover' &&
      !tableAssignments.some((assigned) => assigned?.id === m.id) &&
      m.player1_id &&
      m.player2_id
  );

  // Step 5: Fill empty tables dynamically with available candidate matches
  const assignedCandidateIds = new Set<string>();

  for (let t = 0; t < TOTAL_TABLES; t++) {
    if (tableAssignments[t] === null) {
      // Find first candidate where neither player is busy
      const nextAvailable = candidateMatches.find((m) => {
        if (assignedCandidateIds.has(m.id)) return false;
        const p1Busy = busyPlayerIds.has(m.player1_id);
        const p2Busy = busyPlayerIds.has(m.player2_id);
        return !p1Busy && !p2Busy;
      });

      if (nextAvailable) {
        tableAssignments[t] = nextAvailable;
        assignedCandidateIds.add(nextAvailable.id);
        busyPlayerIds.add(nextAvailable.player1_id);
        busyPlayerIds.add(nextAvailable.player2_id);
      }
    }
  }

  // Step 6: Assemble final state for each table
  const unassignedQueue = candidateMatches.filter((m) => !assignedCandidateIds.has(m.id));

  for (let t = 1; t <= TOTAL_TABLES; t++) {
    const current = tableAssignments[t - 1] ?? null;
    const semaphore = getTableSemaphore(current);

    // Group association if applicable
    const assignedGroup =
      current?.group_id ? groups.find((g) => g.id === current.group_id) || null : null;

    result.push({
      tableNumber: t,
      assignedGroup,
      currentMatch: current,
      queuedMatches: unassignedQueue,
      isIdle: current === null,
      statusLight: semaphore.light,
      statusLabel: semaphore.label,
    });
  }

  return result;
}
