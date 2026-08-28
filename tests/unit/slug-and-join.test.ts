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

  it('allows registration for draft, registration, and ongoing/group_stage, but not finished', () => {
    expect(isRegistrationAllowed('draft')).toBe(true);
    expect(isRegistrationAllowed('DRAFT')).toBe(true);
    expect(isRegistrationAllowed('registration')).toBe(true);
    expect(isRegistrationAllowed('group_stage')).toBe(true);
    expect(isRegistrationAllowed('ongoing')).toBe(true);
    expect(isRegistrationAllowed('finished')).toBe(false);
    expect(isRegistrationAllowed('completed')).toBe(false);
  });
});
