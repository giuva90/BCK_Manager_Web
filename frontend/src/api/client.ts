/**
 * API client — centralized fetch wrapper with cookie auth.
 */

const BASE = '/api/v1';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
    ...options,
  });

  if (res.status === 401) {
    // Try refresh
    const refreshed = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      // Retry original request
      const retry = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...((options.headers as Record<string, string>) || {}),
        },
        ...options,
      });
      if (!retry.ok) throw new ApiError(retry.status, await retry.text());
      if (retry.status === 204) return undefined as T;
      return retry.json();
    }
    // Refresh failed — redirect to login
    window.location.href = '/login';
    throw new ApiError(401, 'Session expired');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { ApiError };
