
const BASE_URL =
  (typeof window !== 'undefined' &&
    window.__ENV__ &&
    window.__ENV__.API_BASE_URL) ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8080';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  console.log('API REQUEST:', `${BASE_URL}${path}`);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    mode: 'cors',
  });

  const text = await res.text();

  console.log('API RESPONSE:', res.status, text);

  if (!res.ok) {
    throw new Error(
      `${options.method || 'GET'} ${path} failed: ${res.status} ${text}`
    );
  }

  return text ? JSON.parse(text) : null;
}

export const api = {
  login: (email, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email, password) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  catalog: () =>
    request('/api/catalog'),

  bookings: (userId) =>
    request(
      `/api/bookings?userId=${encodeURIComponent(userId)}`
    ),

  book: (userId, eventId) =>
    request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        userId: String(userId),
        eventId: Number(eventId),
      }),
    }),

  review: (bookingId, text) =>
    request(`/api/bookings//${bookingId}/review`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),


  reviews: () =>
    request('/api/reviews'),

  analyze: (text) =>
    request('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  analyticsSummary: () =>
    request('/api/analytics/summary'),
};

