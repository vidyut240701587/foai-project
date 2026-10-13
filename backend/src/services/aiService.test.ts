import { describe, expect, it, vi } from 'vitest';

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class GoogleGenerativeAI {
    getGenerativeModel() {
      return {
        async generateContent() {
          const error = new Error('Gemini temporarily unavailable') as Error & { status?: number };
          error.status = 503;
          throw error;
        },
      };
    }
  },
}));

describe('aiService quiz fallback', () => {
  it('returns a valid local quiz when Gemini is unavailable', async () => {
    const { aiService } = await import('./aiService.js');

    const result = await aiService.generateQuiz({
      topic: 'Normalization',
      subject: 'Database Management Systems',
      difficulty: 'Medium',
      count: 2,
      marks: 2,
    });

    expect(result.questions).toHaveLength(2);
    result.questions.forEach((question) => {
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(question.options).toContain(question.correctAnswer);
      expect(question.topic).toBe('Normalization');
    });
  });

  it('includes the academic study assistant instructions in the generated prompt', async () => {
    const { buildAcademicSystemPrompt } = await import('./aiService.js');

    const prompt = buildAcademicSystemPrompt({
      message: 'What is Java?',
      subject: 'Programming Fundamentals',
      mode: 'general',
      context: JSON.stringify({ syllabus: ['Java basics', 'OOP concepts'] }),
    });

    expect(prompt).toContain('You are an AI Academic Study Assistant');
    expect(prompt).toContain('For 11-mark questions');
    expect(prompt).toContain('This topic is outside the supplied syllabus context.');
    expect(prompt).toContain('What is Java?');
  });
});
