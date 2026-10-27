import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { LeaderRow } from '@/lib/types';
import { Card, Empty, ErrorBox, Page, SeedBadge } from '@/components/ui';
export const metadata: Metadata = { title: 'Global Rankings' };
export const dynamic = 'force-dynamic';

const winRate = (player: LeaderRow) => player.ratedMatches > 0 ? Math.round((player.ratedWins / player.ratedMatches) * 100) : 0;

export default async function Leaderboard() {
  const r = await api<{ players: LeaderRow[] }>('/v1/leaderboard?limit=100');
  const players = r.data?.players ?? [];
  const podium = players.slice(0, 3);
  const leader = podium[0];
  return (
    <Page title="Global Rankings" subtitle="The top fighters, ranked by Elo rating from rated matches between registered players. Everyone starts at 1200.">
      {!r.ok ? <ErrorBox>{r.error}</ErrorBox> : players.length === 0 ? <Empty>No rated matches yet.</Empty> : <>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center justify-between gap-3 border-emerald-400/20 bg-gradient-to-br from-emerald-400/[0.08] to-ink-900/90"><div><p className="text-xs uppercase tracking-wider text-slate-400">Players ranked</p><p className="mt-1 text-2xl font-bold text-white">{players.length}</p><p className="text-xs text-slate-500">Showing top {players.length}</p></div><span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/15 text-lg text-emerald-300">◎</span></Card>
          <Card className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-slate-400">Top rating</p><p className="mt-1 text-2xl font-bold text-white">{leader?.rating.toLocaleString() ?? '—'} <span className="text-sm font-medium text-emerald-300">MMR</span></p><p className="text-xs text-slate-500">{leader?.username ?? 'No ranked players yet'}</p></div><span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/15 text-lg text-amber-300">★</span></Card>
          <Card className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-slate-400">Ranking basis</p><p className="mt-1 text-2xl font-bold text-white">Elo</p><p className="text-xs text-slate-500">Registered-player matches</p></div><span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-400/15 text-lg text-sky-300">↗</span></Card>
        </div>

        {podium.length > 0 && <section aria-label="Top ranked players" className="mb-4 grid gap-3 md:grid-cols-3">
          {podium.map((player, index) => (
            <Card key={player.username} className={`relative overflow-hidden ${index === 0 ? 'border-amber-300/70 bg-gradient-to-br from-amber-300/[0.09] via-ink-900 to-ink-900 md:-translate-y-1' : 'border-ink-700 bg-ink-900/90'}`}>
              <span aria-label={`Rank ${player.rank}`} className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? 'bg-amber-300 text-ink-950' : index === 1 ? 'bg-slate-300 text-ink-950' : 'bg-orange-400 text-ink-950'}`}>{player.rank}</span>
              <div className="flex items-center gap-3 pr-10"><span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${index === 0 ? 'bg-amber-300/15 text-amber-200' : 'bg-emerald-300/10 text-emerald-200'}`}>{player.username.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-semibold text-white">{player.username}</p>{player.seed && <SeedBadge />}<p className="text-xs text-slate-500">Rank #{player.rank}</p></div></div>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-ink-700 pt-3">
                <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Wins</p><p className="mt-1 font-semibold text-white">{player.ratedWins.toLocaleString()}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Matches</p><p className="mt-1 font-semibold text-white">{player.ratedMatches.toLocaleString()}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Win rate</p><p className="mt-1 font-semibold text-white">{winRate(player)}%</p></div>
              </div>
              <p className="mt-3 text-sm text-slate-400">Rating <span className="float-right font-bold text-emerald-300">{player.rating.toLocaleString()} MMR</span></p>
            </Card>
          ))}
        </section>}

        <Card className="overflow-hidden p-0 sm:p-0">
          <div className="flex flex-wrap items-end justify-between gap-2 px-4 pb-3 pt-4 sm:px-5 sm:pt-5"><div><h2 className="text-xl font-bold text-white sm:text-2xl">Global ranking</h2><p className="mt-1 text-xs text-slate-500">Players ordered by current Elo rating.</p></div><span className="text-xs text-slate-500">Top {players.length}</span></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <caption className="sr-only">Players ranked by Elo rating</caption>
              <thead className="border-y border-ink-700 bg-ink-800/60 text-[11px] uppercase tracking-wider text-slate-400"><tr><th scope="col" className="px-4 py-3 sm:px-5">Rank</th><th scope="col" className="px-4 py-3">Player</th><th scope="col" className="px-4 py-3 text-right">Match wins</th><th scope="col" className="px-4 py-3 text-right">Rated matches</th><th scope="col" className="px-4 py-3 text-right">Win rate</th><th scope="col" className="px-4 py-3 text-right sm:px-5">Rating</th></tr></thead>
              <tbody className="divide-y divide-ink-700">{players.map((p) => (
                <tr key={p.username} className="transition hover:bg-ink-800/60">
                  <td className="px-4 py-3 sm:px-5"><span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-bold ${p.rank === 1 ? 'bg-amber-300 text-ink-950' : p.rank === 2 ? 'bg-slate-300 text-ink-950' : p.rank === 3 ? 'bg-orange-400 text-ink-950' : 'bg-ink-700 text-slate-300'}`}>{p.rank}</span></td>
                  <td className="px-4 py-3"><span className="font-medium text-white">{p.username}</span>{p.seed && <span className="ml-2"><SeedBadge /></span>}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{p.ratedWins.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{p.ratedMatches.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{winRate(p)}%</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-300 sm:px-5">{p.rating.toLocaleString()}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </Card>
        {players.some((p) => p.seed) && <p className="mt-3 text-xs text-slate-500">Rows marked DEV SEED are simulated development accounts, not real players.</p>}
      </>}
    </Page>
  );
}
