import { NextResponse } from 'next/server';
import { api, sessionToken } from '@/lib/api';

/** Download the stored replay file, ready for the game's `--replay` flag. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = await sessionToken();
  if (!t) return NextResponse.json({ error: 'sign in required' }, { status: 401 });
  const { id } = await ctx.params;
  const r = await api<{ match_id: string }>(`/v1/matches/${encodeURIComponent(id)}/replay`, { token: t });
  if (!r.ok || !r.data) return NextResponse.json({ error: r.error }, { status: r.status });
  const name = String(r.data.match_id).replace(/[^A-Za-z0-9_-]/g, '');
  return new NextResponse(JSON.stringify(r.data), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${name}.json"` } });
}
