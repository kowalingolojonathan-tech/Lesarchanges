/**
 * Utilitaire fetch unifié pour l'ensemble des modules du frontend Clinique Les Archanges.
 * Gère l'inclusion systématique de credentials: 'include' et l'en-tête Authorization: Bearer <token>
 * sans jamais tenter de modifier la propriété non-configurable window.fetch.
 */

export function getAuthHeaders(headersInit?: HeadersInit): Headers {
  const headers = new Headers(headersInit || {});
  const token = typeof window !== 'undefined' ? localStorage.getItem('archanges_auth_token') : null;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const headers = getAuthHeaders(init?.headers);
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}
