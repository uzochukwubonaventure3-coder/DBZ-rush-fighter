import Link from 'next/link';
import { api } from '@/lib/api';
import type { LeaderRow } from '@/lib/types';
import { FadeIn } from '@/components/client';
import { Card, H2, SeedBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

const FEATURES = [
  ['Post-match coaching', 'After every match you get strengths, weaknesses and specific drills, built from your real hit, block and attack numbers.'],
  ['Playstyle classification', 'Aggressive, Defensive, Technical or Balanced, with the numbers behind the label so you can see why.'],
  ['Elo rankings', 'Beat stronger players, gain more. Ratings update after every rated match between registered players.'],
  ['Progress over time', 'Block rate, contact rate and rating charted across your matches, so you can see whether practice is working.'],
  ['Replay review', 'Saved replays are stored as button inputs, not video, so they stay tiny. Insights come from your actual inputs.'],
  ['Light on data', 'Server-rendered pages, charts drawn as plain SVG, no chart or image libraries.'],
] as const;

export default async function Home() {
  const lb = await api<{ players: LeaderRow[] }>('/v1/leaderboard?limit=5');
  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:pt-20">
        <FadeIn>
          <p className="text-sm font-semibold uppercase tracking-widest text-ember-500">Competitive fighting game analytics</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-white sm:text-6xl">Know exactly how to win your next match.</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">DBZ Rush Fighter 2.0 sends every match to a coaching platform that classifies your playstyle, explains what went wrong, and tracks your progress. Built for grassroots competitive players who have never had a coach.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-lg bg-ember-500 px-5 py-3 font-bold text-ink-950 hover:bg-ember-400">Create your account</Link>
            <Link href="/leaderboard" className="rounded-lg border border-ink-600 px-5 py-3 font-semibold text-white hover:bg-ink-800">View the leaderboard</Link>
          </div>
        </FadeIn>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-10 sm:grid-cols-2 lg:grid-cols-3" aria-label="Features">
        {FEATURES.map(([t, d], i) => (<FadeIn key={t} delay={0.05 * i}><Card className="h-full"><h2 className="font-semibold text-white">{t}</h2><p className="mt-2 text-sm text-slate-400">{d}</p></Card></FadeIn>))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10" aria-label="How it works">
        <Card>
          <H2>How it works</H2>
          <ol className="grid gap-4 text-sm text-slate-300 sm:grid-cols-4">
            <li><b className="block text-white">1. Create an account</b>You get an ingest token for the game.</li>
            <li><b className="block text-white">2. Play a match</b>The game records stats, and your inputs if you save the replay.</li>
            <li><b className="block text-white">3. Upload</b>Stats are sent after every match; the replay only if you choose.</li>
            <li><b className="block text-white">4. Review</b>Open the match here for coaching, charts and replay insights.</li>
          </ol>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6">
        <Card>
          <H2>Top players</H2>
          {!lb.ok ? <p className="text-sm text-slate-500">The leaderboard is unavailable right now.</p>
            : lb.data!.players.length === 0 ? <p className="text-sm text-slate-400">No rated matches yet. The first rated match puts you on the board.</p>
            : <ol className="divide-y divide-ink-700">{lb.data!.players.map((p) => (
              <li key={p.username} className="flex items-center justify-between py-2"><span className="flex items-center gap-3"><span className="w-6 text-slate-500">{p.rank}</span><span className="font-medium text-white">{p.username}</span>{p.seed && <SeedBadge />}</span><span className="font-bold text-ember-400">{p.rating}</span></li>))}</ol>}
        </Card>
      </section>
    </main>
  );
}
