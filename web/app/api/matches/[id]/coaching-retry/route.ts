import { NextResponse } from 'next/server';
import { api, sessionToken } from '@/lib/api';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = await sessionToken();
  if (!t) return NextResponse.json({ error: 'sign in required' }, { status: 401 });
  const { id } = await ctx.params;
  const r = await api(`/v1/matches/${encodeURIComponent(id)}/coaching/retry`, { method: 'POST', token: t });
  return r.ok ? NextResponse.json({ ok: true }, { status: 202 }) : NextResponse.json({ error: r.error }, { status: r.status });
}
