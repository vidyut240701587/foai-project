import { describe, expect, it } from 'vitest';

import { isOfficialRecPdfUrl, parseOfficialCourseCatalog, recSyllabusCatalog } from './recSyllabusCatalog.js';

describe('REC official syllabus catalogue', () => {
  it('extracts the official course name, code, and semester from curriculum rows', () => {
    const curriculum = [
      'SEMESTER II',
      '5. CS23231 Data Structures PC 7 3 0 4 5',
      'SEMESTER III',
      '4. CS23332 Database Management Systems PC 7 3 0 4 5',
      'SEMESTER IV',
      '3. CS6201 Engineering Mathematics IV PC 5 3 0 2 4',
    ].join('\n');

    expect(parseOfficialCourseCatalog(curriculum)).toEqual([
      { code: 'CS23231', name: 'Data Structures', semester: 2 },
      { code: 'CS23332', name: 'Database Management Systems', semester: 3 },
      { code: 'CS6201', name: 'Engineering Mathematics IV', semester: 4 },
    ]);
  });

  it('lists only the official REC regulations and R2023 CSE department', () => {
    expect(recSyllabusCatalog.getRegulations().map(({ code }) => code)).toEqual(['R2023', 'R2019', 'R2017', 'R2013']);
    expect(recSyllabusCatalog.getDepartments('R2023').find(({ code }) => code === 'CSE')).toEqual({
      code: 'CSE',
      name: 'Computer Science and Engineering',
      pdfUrl: 'https://cms.rajalakshmi.org/api/media/file/R2023-CSE-Curriculum_and_Syllabus.pdf',
    });
  });

  it('accepts only HTTPS Rajalakshmi Engineering College hosts', () => {
    expect(isOfficialRecPdfUrl('https://cms.rajalakshmi.org/api/media/file/curriculum.pdf')).toBe(true);
    expect(isOfficialRecPdfUrl('https://www.rajalakshmi.org/downloads/curriculum.pdf')).toBe(true);
    expect(isOfficialRecPdfUrl('http://rajalakshmi.org/curriculum.pdf')).toBe(false);
    expect(isOfficialRecPdfUrl('https://example.com/curriculum.pdf')).toBe(false);
  });
});