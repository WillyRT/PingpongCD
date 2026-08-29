import { describe, it, expect } from 'vitest';
import {
  createPlayerSessionToken,
  verifyPlayerSessionToken,
} from '../../lib/auth/player-session';
import {
  generatePlayoffsWithByes,
  getStandardSeedingPairs,
} from '../../lib/engine/playoffs';
import { calculateBracketSize, type QualifiedPlayer } from '../../lib/engine/bracket';
import { checkSearchRateLimit } from '../../lib/auth/rate-limit';

describe('Player Session HMAC Cryptographic Security (P1)', () => {
  const validData = {
    playerId: 'usr-1234-uuid',
    email: 'competitor@tourneymaster.app',
    tournamentId: 't-9999',
  };

  it('generates a valid signed token and decodes payload correctly', async () => {
    const token = await createPlayerSessionToken(validData);
    expect(token).toContain('.');

    const payload = await verifyPlayerSessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.playerId).toBe(validData.playerId);
    expect(payload?.email).toBe(validData.email);
    expect(payload?.tournamentId).toBe(validData.tournamentId);
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects tampered payload data', async () => {
    const token = await createPlayerSessionToken(validData);
    const [payloadB64, signature] = token.split('.');

    // Tamper with payload (e.g. changing competitor ID to superadmin ID)
    const jsonStr = Buffer.from(payloadB64!, 'base64').toString('utf8');
    const tamperedObj = JSON.parse(jsonStr);
    tamperedObj.playerId = 'admin-victim-id';
    const tamperedB64 = Buffer.from(JSON.stringify(tamperedObj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const tamperedToken = `${tamperedB64}.${signature}`;
    expect(await verifyPlayerSessionToken(tamperedToken)).toBeNull();
  });

  it('rejects tampered or forged signatures', async () => {
    const token = await createPlayerSessionToken(validData);
    const [payloadB64, signature] = token.split('.');

    // Alter the first character of the signature to guarantee byte-level modification
    const forgedSignature = (signature!.startsWith('A') ? 'B' : 'A') + signature!.slice(1);
    const forgedToken = `${payloadB64}.${forgedSignature}`;

    expect(await verifyPlayerSessionToken(forgedToken)).toBeNull();
  });

  it('rejects expired player tokens', async () => {
    // Generate token with negative expiration (-10 seconds)
    const expiredToken = await createPlayerSessionToken(validData, -10);
    expect(await verifyPlayerSessionToken(expiredToken)).toBeNull();
  });

  it('rejects malformed tokens gracefully', async () => {
    expect(await verifyPlayerSessionToken('')).toBeNull();
    expect(await verifyPlayerSessionToken(null)).toBeNull();
    expect(await verifyPlayerSessionToken('no-dot-token')).toBeNull();
    expect(await verifyPlayerSessionToken('one.two.three')).toBeNull();
    expect(await verifyPlayerSessionToken('invalid_base64.signature')).toBeNull();
  });
});

describe('Playoffs Engine with Automated Byes (P0)', () => {
  it('correctly returns standard seeding pairs for bracket sizes 4 and 8', () => {
    expect(getStandardSeedingPairs(4)).toEqual([
      [1, 4],
      [2, 3],
    ]);
    expect(getStandardSeedingPairs(8)).toEqual([
      [1, 8],
      [4, 5],
      [3, 6],
      [2, 7],
    ]);
  });

  it('generates 3-player playoff with Bye for Seed 1 advancing to Final', () => {
    const qualifiers: QualifiedPlayer[] = [
      { playerId: 'p1', groupIndex: 0, groupPosition: 1, seed: 1 },
      { playerId: 'p2', groupIndex: 1, groupPosition: 1, seed: 2 },
      { playerId: 'p3', groupIndex: 0, groupPosition: 2, seed: 3 },
    ];

    const bracket = generatePlayoffsWithByes(qualifiers);
    expect(bracket.totalSlots).toBe(4);
    expect(bracket.rounds).toBe(2); // Semifinals + Final
    expect(bracket.matches.length).toBe(3);

    const semis = bracket.matches.filter((m) => m.stage === 'semifinal');
    expect(semis).toHaveLength(2);

    // Semifinal 1 has Seed 1 with Bye
    const semi1 = semis[0]!;
    expect(semi1.player1Id).toBe('p1');
    expect(semi1.player2Id).toBeNull();
    expect(semi1.isBye).toBe(true);
    expect(semi1.winnerId).toBe('p1');

    // Semifinal 2 has Seed 2 vs Seed 3
    const semi2 = semis[1]!;
    expect(semi2.player1Id).toBe('p2');
    expect(semi2.player2Id).toBe('p3');
    expect(semi2.isBye).toBe(false);

    // Final match has Seed 1 already placed due to auto-advance
    const finalMatch = bracket.matches.find((m) => m.stage === 'final')!;
    expect(finalMatch.player1Id).toBe('p1');
    expect(finalMatch.player2Id).toBeNull(); // Awaiting winner of semi 2
  });

  it('generates 5-player playoff granting Byes to Seeds 1, 2, and 3', () => {
    const qualifiers: QualifiedPlayer[] = [
      { playerId: 'p1', groupIndex: 0, groupPosition: 1, seed: 1 },
      { playerId: 'p2', groupIndex: 1, groupPosition: 1, seed: 2 },
      { playerId: 'p3', groupIndex: 2, groupPosition: 1, seed: 3 },
      { playerId: 'p4', groupIndex: 0, groupPosition: 2, seed: 4 },
      { playerId: 'p5', groupIndex: 1, groupPosition: 2, seed: 5 },
    ];

    const bracket = generatePlayoffsWithByes(qualifiers);
    expect(bracket.totalSlots).toBe(8);
    expect(bracket.rounds).toBe(3);

    const qf = bracket.matches.filter((m) => m.stage === 'quarterfinal');
    expect(qf).toHaveLength(4);

    // QF 1: Seed 1 gets Bye
    expect(qf[0]?.player1Id).toBe('p1');
    expect(qf[0]?.isBye).toBe(true);
    expect(qf[0]?.winnerId).toBe('p1');

    // QF 2: Seed 4 vs Seed 5 (lowest seeds play!)
    expect(qf[1]?.player1Id).toBe('p4');
    expect(qf[1]?.player2Id).toBe('p5');
    expect(qf[1]?.isBye).toBe(false);

    // QF 3: Seed 3 gets Bye
    expect(qf[2]?.player1Id).toBe('p3');
    expect(qf[2]?.isBye).toBe(true);
    expect(qf[2]?.winnerId).toBe('p3');

    // QF 4: Seed 2 gets Bye
    expect(qf[3]?.player1Id).toBe('p2');
    expect(qf[3]?.isBye).toBe(true);
    expect(qf[3]?.winnerId).toBe('p2');

    // Check semifinals have auto-advanced top seeds
    const sf = bracket.matches.filter((m) => m.stage === 'semifinal');
    expect(sf[0]?.player1Id).toBe('p1'); // Seed 1
    expect(sf[1]?.player1Id).toBe('p3'); // Seed 3
    expect(sf[1]?.player2Id).toBe('p2'); // Seed 2
  });

  it('generates 6-player playoff granting Byes to Seeds 1 and 2', () => {
    const qualifiers: QualifiedPlayer[] = [
      { playerId: 'p1', groupIndex: 0, groupPosition: 1, seed: 1 },
      { playerId: 'p2', groupIndex: 1, groupPosition: 1, seed: 2 },
      { playerId: 'p3', groupIndex: 2, groupPosition: 1, seed: 3 },
      { playerId: 'p4', groupIndex: 0, groupPosition: 2, seed: 4 },
      { playerId: 'p5', groupIndex: 1, groupPosition: 2, seed: 5 },
      { playerId: 'p6', groupIndex: 2, groupPosition: 2, seed: 6 },
    ];

    const bracket = generatePlayoffsWithByes(qualifiers);
    const qf = bracket.matches.filter((m) => m.stage === 'quarterfinal');

    // Seed 1 has Bye
    expect(qf[0]?.player1Id).toBe('p1');
    expect(qf[0]?.isBye).toBe(true);

    // Seed 4 vs Seed 5
    expect(qf[1]?.player1Id).toBe('p4');
    expect(qf[1]?.player2Id).toBe('p5');
    expect(qf[1]?.isBye).toBe(false);

    // Seed 3 vs Seed 6
    expect(qf[2]?.player1Id).toBe('p3');
    expect(qf[2]?.player2Id).toBe('p6');
    expect(qf[2]?.isBye).toBe(false);

    // Seed 2 has Bye
    expect(qf[3]?.player1Id).toBe('p2');
    expect(qf[3]?.isBye).toBe(true);
  });
});

describe('Match Confirmation Authorization Rules (P0)', () => {
  interface MockMatch {
    id: string;
    player1_id: string;
    player2_id: string;
    reported_by: string;
    status: 'pending' | 'submitted' | 'confirmed';
  }

  interface MockCaller {
    id: string;
    role: 'player' | 'admin' | 'super_admin';
    admin_status: 'none' | 'approved';
  }

  function validateConfirmationAuthorization(
    match: MockMatch,
    caller: MockCaller | null
  ): { allowed: boolean; error?: string } {
    if (!caller) {
      return { allowed: false, error: 'Unauthorized: Session required' };
    }

    const isAdmin =
      caller.admin_status === 'approved' &&
      (caller.role === 'admin' || caller.role === 'super_admin');

    const isParticipant =
      match.player1_id === caller.id || match.player2_id === caller.id;

    if (!isAdmin && !isParticipant) {
      return { allowed: false, error: 'Not authorized to confirm this match' };
    }

    if (!isAdmin && match.reported_by === caller.id) {
      return { allowed: false, error: 'Reporter cannot confirm their own report' };
    }

    return { allowed: true };
  }

  const sampleMatch: MockMatch = {
    id: 'm-1',
    player1_id: 'player-alpha',
    player2_id: 'player-beta',
    reported_by: 'player-alpha', // Player 1 submitted score
    status: 'submitted',
  };

  it('rejects confirmation if caller has no session', () => {
    const res = validateConfirmationAuthorization(sampleMatch, null);
    expect(res.allowed).toBe(false);
    expect(res.error).toContain('Unauthorized');
  });

  it('rejects self-confirmation by the reporting player', () => {
    const reporter: MockCaller = {
      id: 'player-alpha',
      role: 'player',
      admin_status: 'none',
    };
    const res = validateConfirmationAuthorization(sampleMatch, reporter);
    expect(res.allowed).toBe(false);
    expect(res.error).toBe('Reporter cannot confirm their own report');
  });

  it('rejects confirmation by an uninvolved third-party player', () => {
    const bystander: MockCaller = {
      id: 'player-charlie',
      role: 'player',
      admin_status: 'none',
    };
    const res = validateConfirmationAuthorization(sampleMatch, bystander);
    expect(res.allowed).toBe(false);
    expect(res.error).toBe('Not authorized to confirm this match');
  });

  it('permits confirmation by the opponent', () => {
    const opponent: MockCaller = {
      id: 'player-beta',
      role: 'player',
      admin_status: 'none',
    };
    const res = validateConfirmationAuthorization(sampleMatch, opponent);
    expect(res.allowed).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('permits confirmation by an approved admin even if not playing', () => {
    const admin: MockCaller = {
      id: 'admin-willy',
      role: 'super_admin',
      admin_status: 'approved',
    };
    const res = validateConfirmationAuthorization(sampleMatch, admin);
    expect(res.allowed).toBe(true);
  });
});

describe('Search Rate-Limiter (P1)', () => {
  it('allows 15 requests in window and blocks on 16th', () => {
    const testIp = `test-ip-${Date.now()}`;

    for (let i = 1; i <= 15; i++) {
      expect(checkSearchRateLimit(testIp, 15, 60_000)).toBe(true);
    }

    // 16th request blocked
    expect(checkSearchRateLimit(testIp, 15, 60_000)).toBe(false);

    // Another IP is not blocked
    const anotherIp = `other-ip-${Date.now()}`;
    expect(checkSearchRateLimit(anotherIp, 15, 60_000)).toBe(true);
  });
});
