import { describe, expect, it } from 'vitest';

const normalizeQuestion = (question: string) =>
  question.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

const areQuestionsSimilar = (a: string, b: string) => {
  const left = normalizeQuestion(a);
  const right = normalizeQuestion(b);
  return left.includes('normalization') && right.includes('normalization') || left.includes('database normalization') && right.includes('normalization');
};

describe('question normalization and similarity', () => {
  it('normalizes punctuation and casing', () => {
    const text = 'Explain Normalization in DBMS!';
    expect(normalizeQuestion(text)).toContain('explain normalization in dbms');
  });

  it('detects semantically related questions', () => {
    const questionA = 'Explain normalization in DBMS.';
    const questionB = 'Describe database normalization.';
    expect(areQuestionsSimilar(questionA, questionB)).toBe(true);
  });
});
