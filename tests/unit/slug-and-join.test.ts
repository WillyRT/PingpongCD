import { describe, it, expect } from 'vitest';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveLookupStrategy(param: string): { type: 'uuid' | 'slug'; queryValue: string } {
  const decoded = decodeURIComponent(param).trim();
  if (UUID_REGEX.test(decoded)) {
    return { type: 'uuid', queryValue: decoded };
  }
  return { type: 'slug', queryValue: normalizeSlug(decoded) };
}

function isRegistrationAllowed(status: string): boolean {
  const st = status.toLowerCase();
  return st !== 'finished' && st !== 'completed';
}

describe('Slug Normalization and Dual Route Resolution', () => {
  it('correctly identifies UUID vs slug', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const slug = 'prueba-ping-pong-2027-m6datyye';
    const slugWithSpaces = 'Prueba Ping Pong 2027';

    expect(UUID_REGEX.test(validUuid)).toBe(true);
    expect(UUID_REGEX.test(slug)).toBe(false);
    expect(UUID_REGEX.test(slugWithSpaces)).toBe(false);
  });

  it('normalizes slugs removing accents, spaces, and punctuation', () => {
    expect(normalizeSlug('Prueba Ping Póng 2027!')).toBe('prueba-ping-pong-2027');
    expect(normalizeSlug('   Torneo   Otoño   2026   ')).toBe('torneo-otono-2026');
    expect(normalizeSlug('¡Campeonato Sub-14 & Senior!')).toBe('campeonato-sub-14-senior');
    expect(normalizeSlug('prueba-ping-pong-2027-m6datyye')).toBe('prueba-ping-pong-2027-m6datyye');
  });

  it('selects the correct lookup strategy without causing Postgres UUID cast crashes', () => {
    const res1 = resolveLookupStrategy('e9b0d39e-26f6-4552-bdae-a342416f4ad1');
    expect(res1.type).toBe('uuid');
    expect(res1.queryValue).toBe('e9b0d39e-26f6-4552-bdae-a342416f4ad1');

    const res2 = resolveLookupStrategy('prueba-ping-pong-2027-m6datyye');
    expect(res2.type).toBe('slug');
    expect(res2.queryValue).toBe('prueba-ping-pong-2027-m6datyye');

    const res3 = resolveLookupStrategy('Prueba%20Ping%20Pong%202027');
    expect(res3.type).toBe('slug');
    expect(res3.queryValue).toBe('prueba-ping-pong-2027');
  });

  it('allows registration for canonical draft, registration, and group_stage, but not finished', () => {
    expect(isRegistrationAllowed('draft')).toBe(true);
    expect(isRegistrationAllowed('DRAFT')).toBe(true);
    expect(isRegistrationAllowed('registration')).toBe(true);
    expect(isRegistrationAllowed('group_stage')).toBe(true);
    expect(isRegistrationAllowed('finished')).toBe(false);
    expect(isRegistrationAllowed('completed')).toBe(false);
  });
});

describe('Historical Player Search and Auth-less Registration', () => {
  function obfuscateEmail(email?: string | null): string {
    if (!email || !email.includes('@')) return '';
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }

  it('obfuscates emails correctly for public privacy', () => {
    expect(obfuscateEmail('richy@hotmail.com')).toBe('r***y@hotmail.com');
    expect(obfuscateEmail('carlos.ross@gmail.com')).toBe('c***s@gmail.com');
    expect(obfuscateEmail('al@tabletennis.es')).toBe('a***@tabletennis.es');
    expect(obfuscateEmail('')).toBe('');
    expect(obfuscateEmail(null)).toBe('');
    expect(obfuscateEmail('invalid-email')).toBe('');
  });

  it('matches historical players by canonical name or alias insensitively', () => {
    const historicalPlayers = [
      { id: '1', canonicalName: 'Richy', aliases: ['Ricardo', 'Richi'], rating: 1540 },
      { id: '2', canonicalName: 'Carlos Ross', aliases: ['Charlie', 'Ross'], rating: 1620 },
      { id: '3', canonicalName: 'Guillermo Rivera', aliases: ['Willy', 'Guille'], rating: 1710 },
    ];

    function searchPlayers(query: string) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return historicalPlayers.filter(
        (p) =>
          p.canonicalName.toLowerCase().includes(q) ||
          p.aliases.some((a) => a.toLowerCase().includes(q))
      );
    }

    const res1 = searchPlayers('rich');
    expect(res1).toHaveLength(1);
    expect(res1[0]?.canonicalName).toBe('Richy');
    expect(res1[0]?.rating).toBe(1540);

    const res2 = searchPlayers('charlie');
    expect(res2).toHaveLength(1);
    expect(res2[0]?.canonicalName).toBe('Carlos Ross');

    const res3 = searchPlayers('willy');
    expect(res3).toHaveLength(1);
    expect(res3[0]?.canonicalName).toBe('Guillermo Rivera');
  });

  it('permits public participant creation with decoupled UUID and null auth user_id', () => {
    interface MockProfile {
      id: string;
      user_id: string | null;
      name: string;
      email: string;
      role: 'player';
      rating: number;
    }

    const mockProfiles: MockProfile[] = [];

    function registerPublicParticipant(name: string, email: string, assignedRating: number) {
      const profile: MockProfile = {
        id: 'standalone-uuid-1234',
        user_id: null, // No auth.users row required!
        name,
        email: email.toLowerCase().trim(),
        role: 'player',
        rating: assignedRating,
      };
      mockProfiles.push(profile);
      return profile;
    }

    const created = registerPublicParticipant('Richy', 'richy@hotmail.com', 1540);
    expect(created.id).toBe('standalone-uuid-1234');
    expect(created.user_id).toBeNull();
    expect(created.rating).toBe(1540);
    expect(mockProfiles).toHaveLength(1);
  });
});
