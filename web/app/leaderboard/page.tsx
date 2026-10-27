import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { LeaderRow } from '@/lib/types';
import { Card, Empty, ErrorBox, Page, SeedBadge } from '@/components/ui';
export const metadata: Metadata = { title: 'Leaderboard' };
export const dynamic = 'force-dynamic';

export default async function Leaderboard() {
  const r = await api<{ players: LeaderRow[] }>('/v1/leaderboard?limit=100');
  const players = r.data?.players ?? [];
  return (
    <Page title="Leaderboard" subtitle="Elo ratings from rated matches between registered players. Everyone starts at 1200.">
      {!r.ok ? <ErrorBox>{r.error}</ErrorBox> : players.length === 0 ? <Empty>No rated matches yet.</Empty> : (
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[420px] text-left text-sm">
            <caption className="sr-only">Players ranked by Elo rating</caption>
            <thead className="border-b border-ink-700 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Player</th><th className="px-4 py-3 text-right">Rating</th><th className="px-4 py-3 text-right">Rated matches</th><th className="px-4 py-3 text-right">Win rate</th></tr></thead>
            <tbody className="divide-y divide-ink-700">{players.map((p) => (
              <tr key={p.username}><td className="px-4 py-3 text-slate-500">{p.rank}</td><td className="px-4 py-3"><span className="font-medium text-white">{p.username}</span> {p.seed && <SeedBadge />}</td><td className="px-4 py-3 text-right font-bold text-ember-400">{p.rating}</td><td className="px-4 py-3 text-right">{p.ratedMatches}</td><td className="px-4 py-3 text-right">{Math.round((p.ratedWins / p.ratedMatches) * 100)}%</td></tr>))}</tbody>
          </table>
        </Card>)}
      {players.some((p) => p.seed) && <p className="mt-3 text-xs text-slate-500">Rows marked DEV SEED are simulated development accounts, not real players.</p>}
    </Page>
  );
}
