import { store } from '@/store/store';
import { refreshAccessToken, clearAuth } from '@/store/authSlice';

const API_URL = 'http://localhost:2000';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const state = store.getState().auth;
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (state.accessToken) {
    headers.set('Authorization', `Bearer ${state.accessToken}`);
  }

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && state.refreshToken) {
    const result = await store.dispatch(refreshAccessToken());

    if (refreshAccessToken.fulfilled.match(result)) {
      headers.set('Authorization', `Bearer ${result.payload.accessToken}`);
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    } else {
      store.dispatch(clearAuth());
    }
  }

  return res;
}
