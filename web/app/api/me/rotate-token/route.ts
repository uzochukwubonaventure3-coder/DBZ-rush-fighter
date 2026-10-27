import { NextResponse } from 'next/server';
import { api, sessionToken } from '@/lib/api';

export async function POST() {
  const t = await sessionToken();
  if (!t) return NextResponse.json({ error: 'sign in required' }, { status: 401 });
  const r = await api<{ ingestToken: string }>('/v1/me/ingest-token/rotate', { method: 'POST', token: t });
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status });
}
