import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, api, cookieOptions } from '@/lib/api';

export async function POST(req: Request) {
  const b: any = await req.json().catch(() => null);
  if (!b || typeof b.username !== 'string' || typeof b.password !== 'string') return NextResponse.json({ error: 'username and password required' }, { status: 400 });
  const r = await api<{ username: string; sessionToken: string; ingestToken: string }>('/v1/auth/register', { method: 'POST', body: { username: b.username, password: b.password } });
  if (!r.ok || !r.data) return NextResponse.json({ error: r.error }, { status: r.status });
  (await cookies()).set(SESSION_COOKIE, r.data.sessionToken, cookieOptions);
  return NextResponse.json({ username: r.data.username, ingestToken: r.data.ingestToken }, { status: 201 });
}
