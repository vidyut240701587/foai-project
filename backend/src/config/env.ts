const nodeEnv = process.env.NODE_ENV || 'development';
const databaseUrl = process.env.DATABASE_URL?.trim() || '';
const jwtSecret = process.env.JWT_SECRET?.trim() || (nodeEnv === 'production' ? '' : 'dev-secret-change-me');
const frontendUrl = process.env.FRONTEND_URL?.trim() || (nodeEnv === 'production' ? '' : 'http://localhost:5173');

function isProductionFrontendUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.origin === value
      && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)
      && !/your-|example/i.test(url.hostname);
  } catch {
    return false;
  }
}

if (nodeEnv === 'production') {
  if (!databaseUrl) throw new Error('DATABASE_URL must be set in production.');
  if (jwtSecret.length < 32 || /dev-secret|replace|placeholder/i.test(jwtSecret)) {
    throw new Error('JWT_SECRET must be a strong secret of at least 32 characters in production.');
  }
  if (!isProductionFrontendUrl(frontendUrl)) {
    throw new Error('FRONTEND_URL must be the deployed HTTPS frontend origin in production.');
  }
}

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv,
  databaseUrl,
  jwtSecret,
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || '',
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
  academicAdminEmails: (process.env.ACADEMIC_ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),
  frontendUrl,
};
