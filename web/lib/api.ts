import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const SESSION_COOKIE = 'dbz_session';
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export interface ApiResult<T> { status: number; ok: boolean; data: T | null; error?: string; details?: { path: string; message: string }[] }

export async function api<T>(path: string, opts: { token?: string | null; method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET', cache: 'no-store', signal: AbortSignal.timeout(10_000),
      headers: { ...(opts.body ? { 'content-type': 'application/json' } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const json: any = await res.json().catch(() => null);
    return res.ok ? { status: res.status, ok: true, data: json as T } : { status: res.status, ok: false, data: null, error: json?.error ?? `HTTP ${res.status}`, details: json?.details };
  } catch {
    return { status: 503, ok: false, data: null, error: 'The analytics API is not reachable right now.' };
  }
}

export async function sessionToken(): Promise<string | null> { return (await cookies()).get(SESSION_COOKIE)?.value ?? null; }

/** For pages: returns the token, or sends the visitor to /login (also when the API says the session is invalid). */
export async function requireSession(): Promise<string> {
  const t = await sessionToken();
  if (!t) redirect('/login');
  return t;
}
/** Call with any authenticated API result: an expired/invalid session goes to login. */
export function guard<T>(r: ApiResult<T>): ApiResult<T> {
  if (r.status === 401) redirect('/login');
  return r;
}

export const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 24 * 3600 };
