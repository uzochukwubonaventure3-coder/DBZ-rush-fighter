import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, api, sessionToken } from '@/lib/api';

export async function POST() {
  const t = await sessionToken();
  if (t) await api('/v1/auth/logout', { method: 'POST', token: t });   // end the session server-side too
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
