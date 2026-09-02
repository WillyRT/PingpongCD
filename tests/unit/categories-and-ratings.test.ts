import { describe, it, expect } from 'vitest';
import { determineAgeCategory, getCategoryLabel } from '../../lib/engine/categories';
import { calculateProvisionalRating, FALLBACK_MIN_ELO, FALLBACK_MAX_ELO } from '../../lib/engine/rating';

describe('Age Categorization (Sub-14 vs +14)', () => {
  it('should categorize age <= 14 as sub14', () => {
    expect(determineAgeCategory(14)).toBe('sub14');
    expect(determineAgeCategory(12)).toBe('sub14');
    expect(determineAgeCategory(8)).toBe('sub14');
  });

  it('should categorize age > 14 as plus14', () => {
    expect(determineAgeCategory(15)).toBe('plus14');
    expect(determineAgeCategory(25)).toBe('plus14');
    expect(determineAgeCategory(45)).toBe('plus14');
  });

  it('should calculate category accurately from birthdate string', () => {
    // 10 years ago -> sub14
    const today = new Date();
    const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate()).toISOString().split('T')[0]!;
    expect(determineAgeCategory(tenYearsAgo)).toBe('sub14');

    // 20 years ago -> plus14
    const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate()).toISOString().split('T')[0]!;
    expect(determineAgeCategory(twentyYearsAgo)).toBe('plus14');
  });

  it('should throw an error on corrupt or invalid birth dates instead of silently falling back', () => {
    expect(() => determineAgeCategory('invalid-date')).toThrow('Fecha de nacimiento o edad inválida');
    expect(() => determineAgeCategory('not-a-date')).toThrow('Fecha de nacimiento o edad inválida');
    expect(() => determineAgeCategory(new Date('invalid'))).toThrow('Fecha de nacimiento o edad inválida');
    expect(() => determineAgeCategory('2024-99-99')).toThrow('Fecha de nacimiento o edad inválida');
  });

  it('should provide clear category labels', () => {
    expect(getCategoryLabel('sub14')).toBe('Sub-14 (Junior)');
    expect(getCategoryLabel('plus14')).toBe('Absoluta (+14 / Senior)');
  });
});

describe('Provisional Rating Calculation (0-10 Scale)', () => {
  it('should interpolate level 0.0 to MIN_ELO (1100)', () => {
    const result = calculateProvisionalRating(0);
    expect(result.rating).toBe(1100);
    expect(result.ratingDeviation).toBe(350);
    expect(result.volatility).toBe(0.06);
  });

  it('should interpolate level 10.0 to MAX_ELO (2050)', () => {
    const result = calculateProvisionalRating(10);
    expect(result.rating).toBe(2050);
  });

  it('should interpolate level 5.0 to midpoint (1575)', () => {
    const result = calculateProvisionalRating(5.0);
    expect(result.rating).toBe(1575);
  });

  it('should support dynamic minElo and maxElo query results', () => {
    const result = calculateProvisionalRating(5.0, 1000, 2000);
    expect(result.rating).toBe(1500);
  });

  it('should clamp out-of-range declared levels safely', () => {
    expect(calculateProvisionalRating(-2).rating).toBe(FALLBACK_MIN_ELO);
    expect(calculateProvisionalRating(15).rating).toBe(FALLBACK_MAX_ELO);
  });
});
