import { refreshAccessToken, clearAuth } from '@/store/authSlice';
import { store } from '@/store/store';

const API_URL = 'http://localhost:2000';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });

  const isAuthRoute = path.startsWith('/auth/');
  if (res.status === 401 && !isAuthRoute) {
    const result = await store.dispatch(refreshAccessToken());

    if (refreshAccessToken.fulfilled.match(result)) {
      res = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
    } else {
      store.dispatch(clearAuth());
      window.location.href = '/login';
      return res;
    }
  }

  return res;
}
