import { describe, expect, it } from 'vitest';

import { parseQuestionPaperText } from './academicImportService.js';

describe('question-paper parser', () => {
  it('extracts numbered question text and explicit marks', () => {
    const questions = parseQuestionPaperText('1. Define normalization. (2 marks)\n2) Explain database design. [11]');
    expect(questions).toEqual([
      { text: 'Define normalization.', marks: 2 },
      { text: 'Explain database design.', marks: 11 },
    ]);
  });
});
