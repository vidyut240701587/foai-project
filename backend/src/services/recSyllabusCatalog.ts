import axios from 'axios';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const parsePdf = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;

export type OfficialSubject = {
  code: string;
  name: string;
  semester: number;
};

type OfficialDepartment = {
  code: string;
  name: string;
  pdfUrl: string;
};

type CachedCurriculum = {
  buffer: Buffer;
  subjects: OfficialSubject[];
};

type CurriculumCacheEntry = {
  expiresAt: number;
  request: Promise<CachedCurriculum>;
};

const officialCurricula: Record<string, OfficialDepartment[]> = {
  R2023: [
    { code: 'AERO', name: 'Aeronautical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-Aero-Curriculum_and_Syllabus.pdf' },
    { code: 'AIDS', name: 'Artificial Intelligence and Data Science', pdfUrl: 'https://cms.rajalakshmi.org/api/media/file/R2023-BTechAIDS-CurriculumandSyllabus.pdf' },
    { code: 'AIML', name: 'Artificial Intelligence and Machine Learning', pdfUrl: 'https://cms.rajalakshmi.org/api/media/file/R2023-AIML-Curriculum_and_Syllabus.pdf' },
    { code: 'AUTO', name: 'Automobile Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-Auto-Curriculum_and_Syllabus.pdf' },
    { code: 'BME', name: 'Biomedical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-BME-Curriculum_and_Syllabus.pdf' },
    { code: 'BT', name: 'Biotechnology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-BT-Curriculum_and_Syllabus.pdf' },
    { code: 'CHEM', name: 'Chemical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-Chem-Curriculum_and_Syllabus.pdf' },
    { code: 'CIVIL', name: 'Civil Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-Civil-Curriculum_and_Syllabus.pdf' },
    { code: 'CSD', name: 'Computer Science and Design', pdfUrl: 'https://cms.rajalakshmi.org/api/media/file/R2023-CSD-Curriculum_and_Syllabus.pdf' },
    { code: 'CSE', name: 'Computer Science and Engineering', pdfUrl: 'https://cms.rajalakshmi.org/api/media/file/R2023-CSE-Curriculum_and_Syllabus.pdf' },
    { code: 'CSE-CS', name: 'Computer Science and Engineering (Cyber Security)', pdfUrl: 'https://cms.rajalakshmi.org/api/media/file/R2023-CSE-CS-Curriculum_and_Syllabus.pdf' },
    { code: 'CSBS', name: 'Computer Science and Business Systems', pdfUrl: 'https://cms.rajalakshmi.org/api/media/file/R2023-CSBS-Curriculum_and_Syllabus.pdf' },
    { code: 'EEE', name: 'Electrical and Electronics Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-EEE-Curriculum_and_Syllabus.pdf' },
    { code: 'ECE', name: 'Electronics and Communication Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-ECE-Curriculum_and_Syllabus.pdf' },
    { code: 'FT', name: 'Food Technology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-FT-Curriculum_and_Syllabus.pdf' },
    { code: 'IT', name: 'Information Technology', pdfUrl: 'https://cms.rajalakshmi.org/api/media/file/R2023-IT-Curriculum_and_Syllabus.pdf' },
    { code: 'MECH', name: 'Mechanical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-Mech-Curriculum_and_Syllabus.pdf' },
    { code: 'MCT', name: 'Mechatronics', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-MCT-Curriculum_and_Syllabus.pdf' },
    { code: 'RA', name: 'Robotics and Automation', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2023/R2023-RA-Curriculum_and_Syllabus.pdf' },
  ],
  R2019: [
    { code: 'AERO', name: 'Aeronautical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-Aero-Curriculum_and_Syllabus.pdf' },
    { code: 'AIML', name: 'Artificial Intelligence and Machine Learning', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-AIML-Curriculum_and_Syllabus.pdf' },
    { code: 'AUTO', name: 'Automobile Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-Auto-Curriculum_and_Syllabus.pdf' },
    { code: 'BME', name: 'Biomedical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-BME-Curriculum_and_Syllabus.pdf' },
    { code: 'BT', name: 'Biotechnology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-BT-Curriculum_and_Syllabus.pdf' },
    { code: 'CHEM', name: 'Chemical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-Chem-Curriculum_and_Syllabus.pdf' },
    { code: 'CIVIL', name: 'Civil Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-Civil-Curriculum_and_Syllabus.pdf' },
    { code: 'CSD', name: 'Computer Science and Design', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-CSD-Curriculum_and_Syllabus.pdf' },
    { code: 'CSE', name: 'Computer Science and Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-CSE-Curriculum_and_Syllabus.pdf' },
    { code: 'CSBS', name: 'Computer Science and Business Systems', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/CSBSR2019REVISEDCURRICULUMANDSYLLABUS.pdf' },
    { code: 'EEE', name: 'Electrical and Electronics Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-EEE-Curriculum_and_Syllabus.pdf' },
    { code: 'ECE', name: 'Electronics and Communication Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-ECE-Curriculum_and_Syllabus.pdf' },
    { code: 'FT', name: 'Food Technology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-FT-Curriculum_and_Syllabus.pdf' },
    { code: 'IT', name: 'Information Technology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-IT-Curriculum_and_Syllabus.pdf' },
    { code: 'MECH', name: 'Mechanical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-Mech-Curriculum_and_Syllabus.pdf' },
    { code: 'MCT', name: 'Mechatronics', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-MCT-Curriculum_and_Syllabus.pdf' },
    { code: 'RA', name: 'Robotics and Automation', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2019/R2019-RA-Curriculum_and_Syllabus.pdf' },
  ],
  R2017: [
    { code: 'AERO', name: 'Aeronautical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-Aero-Curriculum_and_Syllabus.pdf' },
    { code: 'AUTO', name: 'Automobile Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-Auto-Curriculum_and_Syllabus.pdf' },
    { code: 'BME', name: 'Biomedical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-BME-Curriculum_and_Syllabus.pdf' },
    { code: 'BT', name: 'Biotechnology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-BT-Curriculum_and_Syllabus.pdf' },
    { code: 'CHEM', name: 'Chemical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-Chem-Curriculum_and_Syllabus.pdf' },
    { code: 'CIVIL', name: 'Civil Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-Civil-Curriculum_and_Syllabus.pdf' },
    { code: 'CSE', name: 'Computer Science and Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-CSE-Curriculum_and_Syllabus.pdf' },
    { code: 'EEE', name: 'Electrical and Electronics Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-EEE-Curriculum_and_Syllabus.pdf' },
    { code: 'ECE', name: 'Electronics and Communication Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-ECE-Curriculum_and_Syllabus.pdf' },
    { code: 'FT', name: 'Food Technology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-FT-Curriculum_and_Syllabus.pdf' },
    { code: 'IT', name: 'Information Technology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-IT-Curriculum_and_Syllabus.pdf' },
    { code: 'MECH', name: 'Mechanical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-Mech-Curriculum_and_Syllabus.pdf' },
    { code: 'MCT', name: 'Mechatronics', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2017_From2018batch/R2017-MCT-Curriculum_and_Syllabus.pdf' },
  ],
  R2013: [
    { code: 'AERO', name: 'Aeronautical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-Aero-Curriculum_and_Syllabus.pdf' },
    { code: 'AUTO', name: 'Automobile Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-Auto-Curriculum_and_Syllabus.pdf' },
    { code: 'BME', name: 'Biomedical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-BME-Curriculum_and_Syllabus.pdf' },
    { code: 'BT', name: 'Biotechnology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-BT-Curriculum_and_Syllabus.pdf' },
    { code: 'CHEM', name: 'Chemical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-Chem-Curriculum_and_Syllabus.pdf' },
    { code: 'CIVIL', name: 'Civil Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-Civil-Curriculum_and_Syllabus.pdf' },
    { code: 'CSE', name: 'Computer Science and Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-CSE-Curriculum_and_Syllabus.pdf' },
    { code: 'EEE', name: 'Electrical and Electronics Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-EEE-Curriculum_and_Syllabus.pdf' },
    { code: 'ECE', name: 'Electronics and Communication Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-ECE-Curriculum_and_Syllabus.pdf' },
    { code: 'FT', name: 'Food Technology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-FT-Curriculum_and_Syllabus.pdf' },
    { code: 'IT', name: 'Information Technology', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-IT-Curriculum_and_Syllabus.pdf' },
    { code: 'MECH', name: 'Mechanical Engineering', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-Mech-Curriculum_and_Syllabus.pdf' },
    { code: 'MCT', name: 'Mechatronics', pdfUrl: 'https://www.rajalakshmi.org/downloads/syllabus/R2013/R2013-MCT-Curriculum_and_Syllabus.pdf' },
  ],
};

const regulationPages = {
  R2023: 'https://rajalakshmi.org/reg2023',
  R2019: 'https://www.rajalakshmi.org/reg2019',
  R2017: 'https://www.rajalakshmi.org/reg2017-18-22',
  R2013: 'https://www.rajalakshmi.org/reg2013',
};

const curriculumCache = new Map<string, CurriculumCacheEntry>();
const romanSemesters: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };

export function isOfficialRecPdfUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'rajalakshmi.org' || url.hostname.endsWith('.rajalakshmi.org'));
  } catch {
    return false;
  }
}

export function parseOfficialCourseCatalog(text: string): OfficialSubject[] {
  const curriculumText = text.slice(0, 70_000).replace(/\u00a0/g, ' ');
  const semesterMatches = [...curriculumText.matchAll(/\bSEMESTER\s+(VIII|VII|VI|IV|V|III|II|I|[1-8])\b/gi)];
  const codeMatches = [...curriculumText.matchAll(/\b([A-Z]{2,4}\d{4,5})\b/g)];
  const subjects = new Map<string, OfficialSubject>();
  let semesterIndex = 0;
  let semester: number | undefined;

  for (let index = 0; index < codeMatches.length; index += 1) {
    const codeMatch = codeMatches[index];
    while (semesterIndex < semesterMatches.length && semesterMatches[semesterIndex].index! < codeMatch.index!) {
      const value = semesterMatches[semesterIndex][1].toUpperCase();
      semester = Number(value) || romanSemesters[value];
      semesterIndex += 1;
    }
    if (!semester || subjects.has(codeMatch[1])) continue;

    const afterCode = codeMatch.index! + codeMatch[0].length;
    const nextCodeIndex = codeMatches[index + 1]?.index ?? Math.min(curriculumText.length, afterCode + 420);
    const rowText = curriculumText.slice(afterCode, Math.min(nextCodeIndex, afterCode + 420));
    const category = /\b(?:HS|BS|ES|PC|PE|OE|MC|EEC)\s+\d{1,2}\b/.exec(rowText);
    if (!category) continue;

    const name = rowText.slice(0, category.index)
      .replace(/[\r\n]+/g, ' ')
      .replace(/^\s*[\d.]+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name) subjects.set(codeMatch[1], { code: codeMatch[1], name, semester });
  }

  return [...subjects.values()];
}

export const recSyllabusCatalog = {
  getRegulations() {
    return Object.keys(officialCurricula).map((code) => ({ code, sourceUrl: regulationPages[code as keyof typeof regulationPages] }));
  },

  getDepartments(regulationCode: string) {
    return officialCurricula[regulationCode] ?? [];
  },

  getDepartment(regulationCode: string, departmentCode: string) {
    return this.getDepartments(regulationCode).find((department) => department.code === departmentCode);
  },

  async getCurriculum(regulationCode: string, departmentCode: string) {
    const department = this.getDepartment(regulationCode, departmentCode);
    if (!department || !isOfficialRecPdfUrl(department.pdfUrl)) {
      throw new Error('Official syllabus is currently unavailable for this selection.');
    }

    let cacheEntry = curriculumCache.get(department.pdfUrl);
    if (!cacheEntry || cacheEntry.expiresAt <= Date.now()) {
      const request = (async () => {
        const response = await axios.get<ArrayBuffer>(department.pdfUrl, {
          responseType: 'arraybuffer',
          timeout: 45_000,
          maxContentLength: 30 * 1024 * 1024,
          validateStatus: () => true,
        });
        const buffer = Buffer.from(response.data);
        if (response.status !== 200 || buffer.subarray(0, 4).toString() !== '%PDF') {
          throw new Error('Official PDF unavailable');
        }
        const extracted = await parsePdf(buffer);
        const subjects = parseOfficialCourseCatalog(extracted.text);
        if (!subjects.length) throw new Error('Official course list unavailable');
        return { buffer, subjects };
      })();
      cacheEntry = { expiresAt: Date.now() + 5 * 60_000, request };
      curriculumCache.set(department.pdfUrl, cacheEntry);
    }

    try {
      return { department, ...(await cacheEntry.request) };
    } catch (error) {
      if (curriculumCache.get(department.pdfUrl) === cacheEntry) curriculumCache.delete(department.pdfUrl);
      throw error;
    }
  },
};