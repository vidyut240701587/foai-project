import { GoogleGenerativeAI } from '@google/generative-ai';

import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const parseModelJson = <T>(text: string): T => {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    throw new AppError('The AI service returned an invalid response. Please retry.', 'AI_INVALID_RESPONSE', 502);
  }
};

export const buildAcademicSystemPrompt = ({
  message,
  subject,
  unit,
  mode = 'general',
  context,
}: {
  message: string;
  subject?: string;
  unit?: string;
  mode?: string;
  context?: string;
}) => `You are an AI Academic Study Assistant.

Your answers must be accurate, clear, syllabus-aligned and useful for engineering students.

When syllabus context is available:
- Answer using the supplied syllabus as the primary academic context.
- Do not invent topics that are not supported by the supplied syllabus.
- If the requested topic is outside the supplied syllabus, clearly say:
  'This topic is outside the supplied syllabus context.'
- Adapt the answer to the user's requested topic and academic level.

For 2-mark questions:
- Give a direct definition.
- Give 2-4 important points.
- Add a short example when useful.
- Keep the answer concise.

For 11-mark questions:
- Introduction
- Definition
- Detailed explanation
- Important concepts/steps
- Example
- Diagram/table/formula when useful
- Advantages/applications
- Conclusion

For general questions:
- Give a clear explanation.
- Use headings and bullet points.
- Use examples when helpful.
- Do not unnecessarily repeat information.

Always return clean Markdown suitable for rendering in a React Markdown component.

Academic context (use only when relevant):
${context ?? 'No extra syllabus context provided.'}

Target subject: ${subject ?? 'General academic support'}
Target unit: ${unit ?? 'General academic unit'}
Requested mode: ${mode}

User question:
${message}`;

const buildFallbackQuiz = ({ topic, difficulty, marks, count, subject }: { topic: string; difficulty: string; marks: number; count: number; subject?: string }) => {
  const subjectLabel = subject || 'the subject';
  const baseQuestions = [
    {
      question: `What is the primary purpose of ${topic} in ${subjectLabel}?`,
      options: ['To reduce redundancy and improve data integrity', 'To increase memory usage unnecessarily', 'To remove all indexes from the database', 'To replace SQL entirely'],
      correctAnswer: 'To reduce redundancy and improve data integrity',
      explanation: `${topic} helps organize data logically so the system remains consistent, easy to query, and less error-prone.`,
    },
    {
      question: `Which statement best describes a key idea related to ${topic}?`,
      options: ['It organizes information into clear, consistent structures', 'It prevents all learning from happening', 'It only applies to front-end code', 'It removes the need for database design'],
      correctAnswer: 'It organizes information into clear, consistent structures',
      explanation: `Understanding ${topic} is important because it helps you design and analyze academic or technical systems more effectively.`,
    },
    {
      question: 'If a system is poorly structured with duplicated or inconsistent data, what is the likely result?',
      options: ['Data anomalies and maintenance issues', 'A faster CPU clock speed', 'No effect on application logic', 'Automatic code generation'],
      correctAnswer: 'Data anomalies and maintenance issues',
      explanation: 'Weak structure often leads to problems such as anomalies, inconsistent updates, and confusion when the system grows.',
    },
    {
      question: `Which practice is most aligned with a strong understanding of ${topic}?`,
      options: ['Analyzing patterns, relationships, and constraints', 'Ignoring real-world examples', 'Avoiding revision sessions', 'Only memorizing one syntax rule'],
      correctAnswer: 'Analyzing patterns, relationships, and constraints',
      explanation: `A strong grasp of ${topic} comes from recognizing structure, relationships, and the rules that make information reliable.`,
    },
  ];

  return {
    questions: Array.from({ length: Math.max(1, count) }, (_, index) => {
      const item = baseQuestions[index % baseQuestions.length];
      return {
        question: item.question,
        options: item.options,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation,
        topic,
        difficulty,
        marks,
      };
    }).slice(0, Math.max(1, count)),
  };
};

const fallbackChatReply = (prompt: string) => {
  const normalized = prompt.toLowerCase();
  if (normalized.includes('normalization')) {
    return 'Normalization is the process of organizing data to reduce redundancy and avoid inconsistent updates. In practical terms, it helps divide information into well-structured tables so each fact is stored in a logical and maintainable place.';
  }
  if (normalized.includes('revision') || normalized.includes('study')) {
    return 'Start with your weak topics and spend the first part of the session on definitions, examples, and one short practice set. Then review the most frequently tested concepts and finish with a quick recap of what you found difficult.';
  }
  return 'I am currently using a local academic fallback because the AI provider is temporarily busy. Focus on the core concept, define it clearly, and connect it to a concrete example or exam question so your revision remains useful and accurate.';
};

const buildFallbackStudyPlan = ({ subject, priorityTopics, availableHours }: { subject: string; priorityTopics: string[]; availableHours: number }) => {
  const topics = priorityTopics.length ? priorityTopics : ['Core concept review'];
  const tasksPerDay = Math.max(1, Math.ceil(topics.length / Math.max(1, Math.min(3, availableHours))));
  const dayCount = Math.max(1, Math.min(5, Math.ceil(topics.length / tasksPerDay)));

  return {
    days: Array.from({ length: dayCount }, (_, dayIndex) => {
      const dayTopics = topics.slice(dayIndex * tasksPerDay, (dayIndex + 1) * tasksPerDay);
      return {
        title: `${subject} revision day ${dayIndex + 1}`,
        tasks: dayTopics.map((topic, taskIndex) => ({
          topic,
          durationMinutes: Math.max(30, Math.min(180, Math.round((availableHours * 60) / Math.max(1, dayTopics.length || 1)) + (taskIndex * 10))),
          priority: (taskIndex % 3) + 1,
        })),
      };
    }).filter((day) => day.tasks.length > 0),
  };
};

const getGeminiFailureDetails = (error: unknown) => {
  const failure = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const response = failure.response && typeof failure.response === 'object' ? failure.response as Record<string, unknown> : {};
  const rawMessage = error instanceof Error ? error.message : String(error);
  const reason = rawMessage
    .replaceAll(env.geminiApiKey, '[redacted]')
    .replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(api[_ -]?key\s*[:=]\s*)[^\s,]+/gi, '$1[redacted]')
    .slice(0, 500);
  const rawStatus = failure.status ?? failure.statusCode ?? response.status;
  const status = typeof rawStatus === 'number' ? rawStatus : undefined;
  const rawCode = failure.code ?? response.code;
  const code = typeof rawCode === 'string' || typeof rawCode === 'number' ? String(rawCode) : undefined;
  return { ...(status ? { httpStatus: status } : {}), ...(code ? { code } : {}), reason };
};

const generateText = async (prompt: string) => {
  if (!env.geminiApiKey) throw new AppError('AI service is not configured', 'AI_NOT_CONFIGURED', 503);
  const client = new GoogleGenerativeAI(env.geminiApiKey);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await client.getGenerativeModel({ model: env.geminiModel }).generateContent(prompt);
      const text = result.response.text().trim();
      if (!text) throw new Error('Gemini returned an empty response');
      return text;
    } catch (error) {
      lastError = error;
      const details = getGeminiFailureDetails(error);
      const retryable = details.httpStatus === 429 || (details.httpStatus !== undefined && details.httpStatus >= 500);
      if (retryable && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      console.error('Gemini API request failed', details);
      const status = details.httpStatus ? `HTTP ${details.httpStatus}` : 'unknown HTTP status';
      const code = details.code ? ` (${details.code})` : '';
      throw new AppError(`Gemini API request failed: ${status}${code}. ${details.reason}`, 'AI_UNAVAILABLE', 503, details);
    }
  }
  const details = getGeminiFailureDetails(lastError);
  throw new AppError(`Gemini API request failed: HTTP ${details.httpStatus ?? 'unknown'}. ${details.reason}`, 'AI_UNAVAILABLE', 503, details);
};

export const aiService = {
  async healthCheck() {
    await generateText('Reply with the single word OK.');
    return true;
  },

  async analyzeQuestionPaper(content: string) {
    const prompt = `Analyze this provided question-paper text. Use only its contents. Return JSON with repeatedTopics, topicFrequency, twoMarkTopics, longAnswerTopics, importantTopics, and reasoning. For marks, use only explicit marks in the text.\nQuestion paper:\n${content.slice(0, 30000)}`;
    return parseModelJson(await generateText(prompt));
  },

  async predictImportantTopics(questionPapers: unknown[]) {
    const prompt = `Predict likely important topics using only these real previous-paper records. Return JSON with importantTopics (topic, evidence, frequency) and caveats. Do not invent percentages or unsupported certainty. Records: ${JSON.stringify(questionPapers.slice(0, 30))}`;
    return parseModelJson(await generateText(prompt));
  },

  async analyzeTopics(questionPapers: unknown[]) {
    const prompt = `Analyze only the question-paper data provided. Return JSON with topics, frequency, marksDistribution, trends, reasoning. Do not infer data that is absent. Data: ${JSON.stringify(questionPapers.slice(0, 10))}`;
    return parseModelJson(await generateText(prompt));
  },

  async generateQuiz({
    topic,
    difficulty,
    marks,
    count,
    subject,
    unit,
    questionType,
  }: {
    topic: string;
    difficulty: string;
    marks: number;
    count: number;
    subject?: string;
    unit?: string;
    questionType?: string;
  }) {
    try {
      const prompt = `Generate exactly ${count} ${questionType || 'MCQ'} exam questions for ${subject || 'the subject'}${unit ? `, ${unit}` : ''} on ${topic}. Difficulty: ${difficulty}. Marks: ${marks}. Return only JSON with a questions array; each item must have question, options (at least two strings), correctAnswer (one exact option), explanation, topic, difficulty, and marks.`;
      const result = parseModelJson<{ questions?: unknown[] }>(await generateText(prompt));
      if (!Array.isArray(result.questions) || result.questions.length !== count) {
        throw new AppError('The AI service did not generate a complete quiz. Please retry.', 'AI_INVALID_RESPONSE', 502);
      }
      const questions = result.questions.map((entry) => {
        const question = entry as Record<string, unknown>;
        const options = Array.isArray(question.options) ? question.options.map(String) : [];
        const correctAnswer = String(question.correctAnswer ?? '');
        if (typeof question.question !== 'string' || options.length < 2 || !options.includes(correctAnswer)) {
          throw new AppError('The AI service returned an invalid quiz question. Please retry.', 'AI_INVALID_RESPONSE', 502);
        }
        return {
          question: question.question,
          options,
          correctAnswer,
          explanation: String(question.explanation ?? ''),
          topic: String(question.topic ?? topic),
          difficulty: String(question.difficulty ?? difficulty),
          marks: Number(question.marks ?? marks),
        };
      });
      return { questions };
    } catch (error) {
      if (error instanceof AppError && error.code === 'AI_UNAVAILABLE') {
        return buildFallbackQuiz({ topic, difficulty, marks, count, subject });
      }
      throw error;
    }
  },

  async generateStudyPlan({ examDate, availableHours, priorityTopics, subject, topicFrequencies }: { examDate: string; availableHours: number; priorityTopics: string[]; subject?: string; topicFrequencies?: Record<string, number> }) {
    try {
      const prompt = `Create a practical study plan for ${subject || 'the selected subject'} using only these syllabus topics and local previous-paper frequencies. Exam date: ${examDate}. Available hours per day: ${availableHours}. Topic frequency data: ${JSON.stringify(topicFrequencies ?? {})}. Topics: ${JSON.stringify(priorityTopics)}. Return JSON with a days array; every day has title and tasks, and every task has topic (exactly one provided topic), durationMinutes (integer), and priority (1, 2, or 3). Do not invent topics or guarantee exam questions.`;
      const plan = parseModelJson<{ days?: Array<{ title?: unknown; tasks?: Array<{ topic?: unknown; durationMinutes?: unknown; priority?: unknown }> }> }>(await generateText(prompt));
      if (!Array.isArray(plan.days) || !plan.days.length || plan.days.some((day) => !Array.isArray(day.tasks) || !day.tasks.length)) {
        throw new AppError('The AI service returned an invalid study plan. Please retry.', 'AI_INVALID_RESPONSE', 502);
      }
      const allowedTopics = new Set(priorityTopics.map((topic) => topic.toLowerCase()));
      for (const day of plan.days) {
        for (const task of day.tasks ?? []) {
          if (typeof task.topic !== 'string' || !allowedTopics.has(task.topic.toLowerCase())) {
            throw new AppError('The AI study plan included a topic outside your local syllabus.', 'AI_INVALID_RESPONSE', 502);
          }
        }
      }
      return plan;
    } catch (error) {
      if (error instanceof AppError && error.code === 'AI_UNAVAILABLE') {
        return buildFallbackStudyPlan({ subject: subject || 'Your subject', priorityTopics, availableHours });
      }
      throw error;
    }
  },

  async explainTopic(topic: string) {
    return { answer: await generateText(`Explain ${topic} as an academic tutor. Distinguish established facts from examples.`) };
  },

  async answerChat(prompt: string, options: { mode?: string; subject?: string; unit?: string; context?: string } = {}) {
    try {
      const finalPrompt = buildAcademicSystemPrompt({
        message: prompt,
        subject: options.subject,
        unit: options.unit,
        mode: options.mode,
        context: options.context,
      });
      return { answer: await generateText(finalPrompt) };
    } catch (error) {
      if (error instanceof AppError && error.code === 'AI_UNAVAILABLE') {
        return { answer: fallbackChatReply(prompt) };
      }
      throw error;
    }
  },
};
