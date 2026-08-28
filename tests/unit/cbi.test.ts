import { describe, it, expect } from 'vitest';
import { calculateCompetitiveBalanceIndex } from '../../lib/engine/cbi';

describe('Competitive Balance Index (CBI)', () => {
  it('should return 100% for a single group', () => {
    const groups = [
      {
        groupIndex: 0,
        players: [{ id: 'p1', rating: 1500 }, { id: 'p2', rating: 1600 }],
      },
    ];
    const res = calculateCompetitiveBalanceIndex(groups);
    expect(res.cbiPercentage).toBe(100);
    expect(res.symmetryText).toContain('100% simétrico');
    expect(res.isVisible).toBe(false);
    expect(res.coefficientOfVariation).toBe(0);
  });

  it('should return 100% for identical group averages', () => {
    const groups = [
      {
        groupIndex: 0,
        groupCode: 'A',
        players: [{ id: 'p1', rating: 1600 }, { id: 'p2', rating: 1400 }], // mean 1500
      },
      {
        groupIndex: 1,
        groupCode: 'B',
        players: [{ id: 'p3', rating: 1700 }, { id: 'p4', rating: 1300 }], // mean 1500
      },
    ];
    const res = calculateCompetitiveBalanceIndex(groups);
    expect(res.cbiPercentage).toBe(100);
    expect(res.maxDifference).toBe(0);
    expect(res.symmetryText).toBe('Equilibrio entre grupos: 100% simétrico');
  });

  it('should calculate realistic high symmetry for well-balanced snake seeding (~97%)', () => {
    const groups = [
      {
        groupIndex: 0,
        groupCode: 'A',
        players: [{ id: 'p1', rating: 1900 }, { id: 'p2', rating: 1550 }, { id: 'p3', rating: 1200 }], // mean 1550
      },
      {
        groupIndex: 1,
        groupCode: 'B',
        players: [{ id: 'p4', rating: 1850 }, { id: 'p5', rating: 1500 }, { id: 'p6', rating: 1250 }], // mean 1533.3
      },
    ];
    const res = calculateCompetitiveBalanceIndex(groups);
    expect(res.cbiPercentage).toBeGreaterThanOrEqual(95);
    expect(res.symmetryText).toMatch(/Equilibrio entre grupos: \d+% simétrico/);
  });

  it('should reflect lower symmetry for severely unbalanced groups', () => {
    const groups = [
      {
        groupIndex: 0,
        groupCode: 'A',
        players: [{ id: 'p1', rating: 2100 }, { id: 'p2', rating: 2000 }], // mean 2050
      },
      {
        groupIndex: 1,
        groupCode: 'B',
        players: [{ id: 'p3', rating: 1200 }, { id: 'p4', rating: 1100 }], // mean 1150
      },
    ];
    const res = calculateCompetitiveBalanceIndex(groups);
    expect(res.cbiPercentage).toBeLessThan(80);
    expect(res.coefficientOfVariation).toBeGreaterThan(0.2);
    expect(res.isVisible).toBe(true);
  });
});
