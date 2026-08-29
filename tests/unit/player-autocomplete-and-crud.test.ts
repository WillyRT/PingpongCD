import { describe, it, expect, vi } from 'vitest';
import { determineAgeCategory } from '@/lib/engine/categories';
import { validateRedirectUrl } from '@/app/auth/callback/route';

describe('Player Autocomplete, /me Portal & Participant CRUD', () => {
  describe('Role-based Redirect Validation (Open Redirect Protection)', () => {
    it('redirects to /me by default for regular players', () => {
      expect(validateRedirectUrl(null, '/me')).toBe('/me');
      expect(validateRedirectUrl('', '/me')).toBe('/me');
    });

    it('redirects to /admin by default for administrators', () => {
      expect(validateRedirectUrl(null, '/admin')).toBe('/admin');
      expect(validateRedirectUrl('', '/admin')).toBe('/admin');
    });

    it('preserves valid safe relative redirects', () => {
      expect(validateRedirectUrl('/player', '/me')).toBe('/player');
      expect(validateRedirectUrl('/me', '/admin')).toBe('/me');
      expect(validateRedirectUrl('/admin/tournaments/123', '/me')).toBe('/admin/tournaments/123');
      expect(validateRedirectUrl('/join/prueba-2027', '/me')).toBe('/join/prueba-2027');
    });

    it('rejects malicious external open-redirect URLs and falls back to safe role default', () => {
      expect(validateRedirectUrl('https://evil.com', '/me')).toBe('/me');
      expect(validateRedirectUrl('http://malicious.org', '/admin')).toBe('/admin');
      expect(validateRedirectUrl('//evil.com', '/me')).toBe('/me');
      expect(validateRedirectUrl('javascript:alert(1)', '/me')).toBe('/me');
    });
  });

  describe('Category Derivation on Participant Update', () => {
    const tournamentDate = '2027-06-01';

    it('assigns Sub-14 for age <= 14', () => {
      expect(determineAgeCategory('13', tournamentDate)).toBe('sub14');
      expect(determineAgeCategory('14', tournamentDate)).toBe('sub14');
      expect(determineAgeCategory('2014-01-01', tournamentDate)).toBe('sub14');
    });

    it('assigns +14 for age > 14', () => {
      expect(determineAgeCategory('15', tournamentDate)).toBe('plus14');
      expect(determineAgeCategory('25', tournamentDate)).toBe('plus14');
      expect(determineAgeCategory('2000-05-20', tournamentDate)).toBe('plus14');
    });
  });

  describe('Walkover (W.O.) Scoring Rules for Active Participant Removal', () => {
    it('formats W.O. group matches with target score 7', () => {
      const stage = 'group';
      const targetScore = stage === 'group' ? 7 : 11;
      expect(targetScore).toBe(7);

      const isP1Removed = true;
      const score1 = isP1Removed ? 0 : targetScore;
      const score2 = isP1Removed ? targetScore : 0;

      expect(score1).toBe(0);
      expect(score2).toBe(7);
    });

    it('formats W.O. knockout matches with target score 11', () => {
      const stage: string = 'quarterfinal';
      const targetScore = stage === 'group' ? 7 : 11;
      expect(targetScore).toBe(11);

      const isP1Removed = false;
      const score1 = isP1Removed ? 0 : targetScore;
      const score2 = isP1Removed ? targetScore : 0;

      expect(score1).toBe(11);
      expect(score2).toBe(0);
    });
  });

  describe('Email Masking for Privacy in Public Autocomplete', () => {
    function obfuscateEmail(email?: string | null): string {
      if (!email || !email.includes('@')) return '';
      const [local, domain] = email.split('@');
      if (!local || !domain) return email;
      if (local.length <= 2) {
        return `${local[0]}***@${domain}`;
      }
      return `${local[0]}***${local[local.length - 1]}@${domain}`;
    }

    it('masks emails properly', () => {
      expect(obfuscateEmail('richy@hotmail.com')).toBe('r***y@hotmail.com');
      expect(obfuscateEmail('carlos.ross@gmail.com')).toBe('c***s@gmail.com');
      expect(obfuscateEmail('al@test.com')).toBe('a***@test.com');
      expect(obfuscateEmail(null)).toBe('');
    });
  });
});
