import Link from 'next/link';
import type { Metadata } from 'next';
import { api, guard, requireSession } from '@/lib/api';
import { signed, when } from '@/lib/format';
import type { MatchRow } from '@/lib/types';
import { Badge, Card, Empty, ErrorBox, Page, ResultBadge } from '@/components/ui';
export const metadata: Metadata = { title: 'Matches' };
export const dynamic = 'force-dynamic';

export default async function Matches() {
  const token = await requireSession();
  const r = guard(await api<{ matches: MatchRow[] }>('/v1/matches?limit=100', { token }));
  const rows = r.data?.matches ?? [];
  return (
    <Page title="Match history" subtitle="Every match the game has uploaded to your account.">
      {!r.ok ? <ErrorBox>{r.error}</ErrorBox> : rows.length === 0 ? <Empty>No matches yet.</Empty> : (
        <Card className="overflow-x-auto p-0 sm:p-0"><table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Your matches, newest first</caption>
          <thead className="border-b border-ink-700 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Result</th><th className="px-4 py-3">Matchup</th><th className="px-4 py-3">Rounds</th><th className="px-4 py-3">Opponent</th><th className="px-4 py-3">Elo</th><th className="px-4 py-3">Played</th><th className="px-4 py-3"><span className="sr-only">Open</span></th></tr></thead>
          <tbody className="divide-y divide-ink-700">{rows.map((x) => (
            <tr key={x.id} className="hover:bg-ink-800/60"><td className="px-4 py-3"><ResultBadge r={x.result} /></td><td className="px-4 py-3 text-white">{x.character} vs {x.opponentCharacter}</td><td className="px-4 py-3">{x.roundsWon}–{x.roundsLost}</td>
              <td className="px-4 py-3">{x.opponent.username ?? x.opponent.label}</td>
              <td className="px-4 py-3">{x.rated ? <span className={(x.ratingChange ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signed(x.ratingChange ?? 0)}</span> : <Badge title="Rated only between two registered players">unrated</Badge>}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-400">{when(x.playedAt)}</td>
              <td className="px-4 py-3 text-right"><Link className="text-ember-400 underline" href={`/matches/${x.id}`}>Details{x.hasReplay ? ' + replay' : ''}</Link></td></tr>))}</tbody></table></Card>)}
    </Page>
  );
}
