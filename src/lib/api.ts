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

/**
 * Client API typé standardisé pour les requêtes JSON.
 */
export const api = {
  async get<T = any>(url: string): Promise<T> {
    const res = await apiFetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }
    return res.json();
  },

  async post<T = any>(url: string, data?: any): Promise<T> {
    const headers: Record<string, string> = {};
    if (data !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await apiFetch(url, {
      method: 'POST',
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }
    return res.json();
  },

  async put<T = any>(url: string, data?: any): Promise<T> {
    const headers: Record<string, string> = {};
    if (data !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await apiFetch(url, {
      method: 'PUT',
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }
    return res.json();
  },

  async patch<T = any>(url: string, data?: any): Promise<T> {
    const headers: Record<string, string> = {};
    if (data !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await apiFetch(url, {
      method: 'PATCH',
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }
    return res.json();
  },

  async delete<T = any>(url: string): Promise<T> {
    const res = await apiFetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }
    return res.json();
  }
};
