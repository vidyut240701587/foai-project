import { describe, expect, it } from 'vitest';

const computeImportance = (frequency: number, marksWeight: number, recency: number, crossYear: number) => {
  const score = frequency * 0.4 + marksWeight * 0.3 + recency * 0.15 + crossYear * 0.15;
  return Math.min(100, Math.max(0, score));
};

describe('importance scoring', () => {
  it('scores a repeated high-mark topic as high importance', () => {
    const score = computeImportance(12, 100, 90, 85);
    expect(score).toBeGreaterThan(50);
  });

  it('returns a normalized score within 0-100', () => {
    const score = computeImportance(2, 50, 40, 30);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
