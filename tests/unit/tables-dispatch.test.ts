import { describe, it, expect } from 'vitest';
import {
  dispatchStationTables,
  getTableSemaphore,
  TOTAL_TABLES,
  type TableMatch,
  type GroupEntry,
} from '../../lib/engine/tables';

describe('4-Table Physical Station Dispatcher Suite', () => {
  it('TOTAL_TABLES constant is exactly 4', () => {
    expect(TOTAL_TABLES).toBe(4);
  });

  describe('1. Fixed 1:1 Mapping for exactly 4 groups', () => {
    const groups: GroupEntry[] = [
      { id: 'grp-a', group_code: 'A', name: 'Grupo A' },
      { id: 'grp-b', group_code: 'B', name: 'Grupo B' },
      { id: 'grp-c', group_code: 'C', name: 'Grupo C' },
      { id: 'grp-d', group_code: 'D', name: 'Grupo D' },
    ];

    const matches: TableMatch[] = [
      {
        id: 'm-a1',
        stage: 'group',
        group_id: 'grp-a',
        player1_id: 'p1',
        player2_id: 'p2',
        status: 'in_progress',
        table_number: 1,
      },
      {
        id: 'm-b1',
        stage: 'group',
        group_id: 'grp-b',
        player1_id: 'p3',
        player2_id: 'p4',
        status: 'pending_verification',
        table_number: 2,
      },
      {
        id: 'm-c1',
        stage: 'group',
        group_id: 'grp-c',
        player1_id: 'p5',
        player2_id: 'p6',
        status: 'disputed',
        table_number: 3,
        dispute_reason: 'Desacuerdo en el tanteo',
      },
      {
        id: 'm-d1',
        stage: 'group',
        group_id: 'grp-d',
        player1_id: 'p7',
        player2_id: 'p8',
        status: 'scheduled',
      },
    ];

    it('assigns Table 1 -> Group A, Table 2 -> Group B, Table 3 -> Group C, Table 4 -> Group D', () => {
      const dispatched = dispatchStationTables({ groups, matches, isPlayoffs: false });

      expect(dispatched).toHaveLength(4);

      expect(dispatched[0]!.tableNumber).toBe(1);
      expect(dispatched[0]!.assignedGroup?.group_code).toBe('A');
      expect(dispatched[0]!.currentMatch?.id).toBe('m-a1');
      expect(dispatched[0]!.statusLight).toBe('blue');

      expect(dispatched[1]!.tableNumber).toBe(2);
      expect(dispatched[1]!.assignedGroup?.group_code).toBe('B');
      expect(dispatched[1]!.currentMatch?.id).toBe('m-b1');
      expect(dispatched[1]!.statusLight).toBe('yellow');

      expect(dispatched[2]!.tableNumber).toBe(3);
      expect(dispatched[2]!.assignedGroup?.group_code).toBe('C');
      expect(dispatched[2]!.currentMatch?.id).toBe('m-c1');
      expect(dispatched[2]!.statusLight).toBe('red');

      expect(dispatched[3]!.tableNumber).toBe(4);
      expect(dispatched[3]!.assignedGroup?.group_code).toBe('D');
      expect(dispatched[3]!.currentMatch?.id).toBe('m-d1');
      expect(dispatched[3]!.statusLight).toBe('blue');
    });
  });

  describe('2. Dynamic Dispatch for tournaments with < 4 groups (e.g. 2 groups)', () => {
    const groups: GroupEntry[] = [
      { id: 'grp-a', group_code: 'A', name: 'Grupo A' },
      { id: 'grp-b', group_code: 'B', name: 'Grupo B' },
    ];

    const matches: TableMatch[] = [
      {
        id: 'm-1',
        stage: 'group',
        group_id: 'grp-a',
        player1_id: 'p1',
        player2_id: 'p2',
        status: 'in_progress',
        table_number: 1,
      },
      {
        id: 'm-2',
        stage: 'group',
        group_id: 'grp-b',
        player1_id: 'p3',
        player2_id: 'p4',
        status: 'in_progress',
        table_number: 2,
      },
      {
        id: 'm-3',
        stage: 'group',
        group_id: 'grp-a',
        player1_id: 'p5',
        player2_id: 'p6',
        status: 'scheduled',
      },
      {
        id: 'm-4',
        stage: 'group',
        group_id: 'grp-b',
        player1_id: 'p7',
        player2_id: 'p8',
        status: 'scheduled',
      },
      {
        id: 'm-5',
        stage: 'group',
        group_id: 'grp-a',
        player1_id: 'p1', // p1 is currently playing in m-1!
        player2_id: 'p9',
        status: 'scheduled',
      },
    ];

    it('dynamically fills free Tables 3 and 4 with available matches, leaving no idle tables', () => {
      const dispatched = dispatchStationTables({ groups, matches, isPlayoffs: false });

      expect(dispatched).toHaveLength(4);

      // Table 1 has m-1
      expect(dispatched[0]!.tableNumber).toBe(1);
      expect(dispatched[0]!.currentMatch?.id).toBe('m-1');

      // Table 2 has m-2
      expect(dispatched[1]!.tableNumber).toBe(2);
      expect(dispatched[1]!.currentMatch?.id).toBe('m-2');

      // Table 3 receives m-3 (p5 vs p6, both free)
      expect(dispatched[2]!.tableNumber).toBe(3);
      expect(dispatched[2]!.currentMatch?.id).toBe('m-3');
      expect(dispatched[2]!.isIdle).toBe(false);

      // Table 4 receives m-4 (p7 vs p8, both free)
      expect(dispatched[3]!.tableNumber).toBe(4);
      expect(dispatched[3]!.currentMatch?.id).toBe('m-4');
      expect(dispatched[3]!.isIdle).toBe(false);

      // Match m-5 (involving p1) was not assigned because p1 is currently busy playing in m-1!
      expect(dispatched[2]!.currentMatch?.id).not.toBe('m-5');
      expect(dispatched[3]!.currentMatch?.id).not.toBe('m-5');
    });
  });

  describe('3. Dynamic FIFO Dispatch in Playoffs (Bracket Stage)', () => {
    const groups: GroupEntry[] = [];
    const playoffMatches: TableMatch[] = [
      {
        id: 'qf-1',
        stage: 'quarterfinal',
        player1_id: 'q1',
        player2_id: 'q2',
        status: 'scheduled',
      },
      {
        id: 'qf-2',
        stage: 'quarterfinal',
        player1_id: 'q3',
        player2_id: 'q4',
        status: 'scheduled',
      },
      {
        id: 'qf-3',
        stage: 'quarterfinal',
        player1_id: 'q5',
        player2_id: 'q6',
        status: 'scheduled',
      },
      {
        id: 'qf-4',
        stage: 'quarterfinal',
        player1_id: 'q7',
        player2_id: 'q8',
        status: 'scheduled',
      },
    ];

    it('assigns the 4 quarterfinal matches to the 4 physical tables simultaneously', () => {
      const dispatched = dispatchStationTables({
        groups,
        matches: playoffMatches,
        isPlayoffs: true,
      });

      expect(dispatched).toHaveLength(4);
      expect(dispatched[0]!.currentMatch?.id).toBe('qf-1');
      expect(dispatched[1]!.currentMatch?.id).toBe('qf-2');
      expect(dispatched[2]!.currentMatch?.id).toBe('qf-3');
      expect(dispatched[3]!.currentMatch?.id).toBe('qf-4');
    });
  });

  describe('4. Semaphore Visual Signal', () => {
    it('returns green (Libre) when match is null or completed', () => {
      expect(getTableSemaphore(null)).toEqual({ light: 'green', label: 'Libre' });
      expect(getTableSemaphore({ status: 'completed' } as any)).toEqual({ light: 'green', label: 'Libre' });
      expect(getTableSemaphore({ status: 'walkover' } as any)).toEqual({ light: 'green', label: 'Libre' });
    });

    it('returns blue (En Juego) when match is in_progress or scheduled', () => {
      expect(getTableSemaphore({ status: 'in_progress' } as any)).toEqual({ light: 'blue', label: 'En Juego' });
      expect(getTableSemaphore({ status: 'scheduled' } as any)).toEqual({ light: 'blue', label: 'En Juego' });
    });

    it('returns yellow (Pendiente Confirmación) when score is submitted', () => {
      expect(getTableSemaphore({ status: 'pending_verification' } as any)).toEqual({ light: 'yellow', label: 'Pendiente Confirmación' });
      expect(getTableSemaphore({ status: 'submitted' } as any)).toEqual({ light: 'yellow', label: 'Pendiente Confirmación' });
    });

    it('returns red (En Disputa) when score is disputed', () => {
      expect(getTableSemaphore({ status: 'disputed' } as any)).toEqual({ light: 'red', label: 'En Disputa' });
    });
  });
});
