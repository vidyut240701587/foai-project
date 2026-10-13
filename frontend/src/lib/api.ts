const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL = configuredApiBase
  ? `${configuredApiBase.replace(/\/$/, '')}${/^https?:\/\//i.test(configuredApiBase) && !new URL(configuredApiBase).pathname.replace(/\/$/, '').endsWith('/api') ? '/api' : ''}`
  : '/api';

export function getStoredToken() {
  return localStorage.getItem('smart_exam_token');
}

export function clearSession() {
  localStorage.removeItem('smart_exam_token');
  localStorage.removeItem('smart_exam_user');
}

export function saveSession(token: string, user: { id: string; email: string; name: string }) {
  localStorage.setItem('smart_exam_token', token);
  localStorage.setItem('smart_exam_user', JSON.stringify(user));
}

export function getApiUrl(path: string) {
  const normalizedBase = API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const isFormData = options.body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(getApiUrl(path), {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error('Unable to connect to the server. Please try again.');
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && token) {
    clearSession();
    if (!path.startsWith('/auth/login') && !path.startsWith('/auth/register') && typeof window !== 'undefined') {
      window.location.assign('/login');
    }
  }

  if (!response.ok || data.success === false) {
    if (typeof data?.error === 'string') throw new Error(data.error);
    const details = data?.error?.details;
    const validation = details && typeof details === 'object'
      ? Object.values(details).flat().filter((value): value is string => typeof value === 'string').join(' ')
      : '';
    throw new Error(validation || data?.error?.message || data?.message || 'Unable to complete the request. Please try again.');
  }

  return (data.data ?? data) as T;
}
